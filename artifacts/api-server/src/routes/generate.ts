import { Router, type IRouter } from "express";
import { resolve as dnsResolve } from "node:dns/promises";
import axios from "axios";
import * as cheerio from "cheerio";
import { z } from "zod/v4";
import { getTextModel, getGeminiApiKey } from "../lib/gemini";
import { eq } from "drizzle-orm";
import { db, generationsTable } from "@workspace/db";
import { GeneratePinAssetsBody } from "@workspace/api-zod";

const router: IRouter = Router();

const ProductAISchema = z.object({
  title: z.string().min(1),
  price: z.string().optional().default(""),
  description: z.string().optional().default(""),
  imageUrl: z.string().optional().default(""),
});

const VisionAnalysisSchema = z.object({
  technicalDescription: z.string().min(1),
  imagePrompt: z.string().min(1),
});

const SEOPackSchema = z.object({
  titles: z.array(z.string()).min(1),
  description: z.string().min(1),
  altText: z.string().min(1),
  urgencyOverlays: z.array(z.string()),
  hashtags: z.string(),
});

function parseAIJson<T>(schema: z.ZodType<T>, raw: string): T {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = schema.safeParse(JSON.parse(cleaned));
  if (!parsed.success) {
    throw new Error(`AI response schema mismatch: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((re) => re.test(ip));
}

async function validatePublicUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL inválida");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Apenas URLs http e https são suportadas");
  }

  const hostname = parsed.hostname;

  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error("URL aponta para endereço privado");
    }
    return;
  }

  let addresses: string[];
  try {
    addresses = await dnsResolve(hostname);
  } catch {
    throw new Error("Não foi possível resolver o domínio");
  }

  for (const addr of addresses) {
    if (isPrivateIp(addr)) {
      throw new Error("URL resolve para endereço privado");
    }
  }
}

async function scrapeProduct(url: string) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  };

  let currentUrl = url;
  let data: string | undefined;

  for (let hop = 0; hop < 10; hop++) {
    await validatePublicUrl(currentUrl);
    const response = await axios.get(currentUrl, {
      headers,
      timeout: 20000,
      maxRedirects: 0,
      validateStatus: (status) => status < 500,
      responseType: "text",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers["location"] as string | undefined;
      if (!location) break;
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    data = response.data as string;
    break;
  }

  if (!data) {
    throw new Error("Too many redirects or no response");
  }

  const $ = cheerio.load(data);

  let title =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $("h1").first().text().trim() ||
    $("title").text().trim();

  let price =
    $('[class*="price"][class*="current"]').first().text().trim() ||
    $('[class*="price-value"]').first().text().trim() ||
    $('[class*="precio"]').first().text().trim() ||
    $('[itemprop="price"]').attr("content") ||
    $('[data-testid*="price"]').first().text().trim() ||
    $('[class*="price"]').first().text().trim() ||
    "";

  let description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="twitter:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    $('[itemprop="description"]').first().text().trim() ||
    "";

  let imageUrl =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[property="og:image:url"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $('[itemprop="image"]').attr("src") ||
    $('img[class*="product"]').first().attr("src") ||
    "";

  title = title.substring(0, 200).trim();
  description = description.substring(0, 1000).trim();
  price = price.replace(/\s+/g, " ").substring(0, 50).trim();

  if (imageUrl && !imageUrl.startsWith("http")) {
    const urlObj = new URL(url);
    imageUrl = imageUrl.startsWith("/")
      ? `${urlObj.protocol}//${urlObj.host}${imageUrl}`
      : `${urlObj.protocol}//${urlObj.host}/${imageUrl}`;
  }

  return { title, price, description, imageUrl, originalUrl: url };
}

async function generateFromUrlWithAI(url: string) {
  const model = getTextModel();
  const result = await model.generateContent(
    `Você é um especialista em análise de produtos de e-commerce. A partir desta URL de produto, gere informações plausíveis sobre o produto para criação de conteúdo para Pinterest.

URL: ${url}

Baseie-se no domínio e caminho da URL para inferir o produto. Retorne um JSON com:
{
  "title": "Nome do produto inferido da URL",
  "price": "Preço estimado (se possível inferir)",
  "description": "Descrição detalhada do produto inferido",
  "imageUrl": ""
}

Retorne APENAS o JSON, sem markdown.`,
  );

  const content = result.response.text();
  const data = parseAIJson(ProductAISchema, content);
  return {
    title: data.title || url,
    price: data.price,
    description: data.description,
    imageUrl: "",
    originalUrl: url,
  };
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

async function fetchImageAsBase64(
  imageUrl: string,
): Promise<{ data: string; mimeType: string } | null> {
  try {
    await validatePublicUrl(imageUrl);

    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
      maxRedirects: 0,
      validateStatus: (status) => status < 500,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "image/*",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers["location"] as string | undefined;
      if (location) {
        await validatePublicUrl(new URL(location, imageUrl).toString());
      }
      return null;
    }

    const contentType =
      (response.headers["content-type"] as string | undefined)?.split(";")[0]?.trim() ||
      "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return null;
    }

    const buffer = response.data as ArrayBuffer;
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return null;
    }

    const data = Buffer.from(buffer).toString("base64");
    return { data, mimeType: contentType };
  } catch {
    return null;
  }
}

async function analyzeProductWithAI(product: {
  title: string;
  price: string;
  description: string;
  imageUrl: string;
  originalUrl: string;
}) {
  const model = getTextModel();

  const systemPrompt = `Você é um especialista em análise de produtos para Pinterest. Analise este produto e gere uma descrição técnica detalhada da imagem para ser usada como prompt de geração de imagem lifestyle.

Produto: ${product.title}
Preço: ${product.price || "N/A"}
Descrição: ${product.description || "N/A"}
URL: ${product.originalUrl}

Retorne um JSON com:
{
  "technicalDescription": "descrição técnica extremamente detalhada da peça/produto: materiais, cores, forma, detalhes visuais marcantes, acabamentos, etc.",
  "imagePrompt": "prompt em inglês para gerar uma imagem lifestyle fotorrealista com uma pessoa usando/segurando/interagindo com o produto em um ambiente moderno e aspiracional."
}

Retorne APENAS o JSON, sem markdown ou explicações.`;

  type Part =
    | { text: string }
    | { inlineData: { data: string; mimeType: string } };

  const parts: Part[] = [{ text: systemPrompt }];

  if (product.imageUrl) {
    const imageData = await fetchImageAsBase64(product.imageUrl);
    if (imageData) {
      parts.push({ inlineData: { data: imageData.data, mimeType: imageData.mimeType } });
    }
  }

  const result = await model.generateContent(parts);
  const content = result.response.text();
  return parseAIJson(VisionAnalysisSchema, content);
}

async function generateSEOPack(product: {
  title: string;
  price: string;
  description: string;
  originalUrl: string;
  visionAnalysis: { technicalDescription: string };
}) {
  const model = getTextModel();
  const result = await model.generateContent(
    `Você é um especialista em SEO para Pinterest e copywriting de alta conversão em português brasileiro. 

Produto: ${product.title}
Preço: ${product.price || "N/A"}
Descrição: ${product.description || "N/A"}
Análise técnica: ${product.visionAnalysis.technicalDescription}

Crie um pacote SEO completo para Pinterest. Retorne APENAS um JSON com esta estrutura:
{
  "titles": [
    "Título 1 otimizado SEO para Pinterest (máx 100 chars)",
    "Título 2 alternativo com gatilho emocional (máx 100 chars)",
    "Título 3 com foco em tendência/lifestyle (máx 100 chars)"
  ],
  "description": "Descrição completa do pin com gatilhos de conversão, benefícios emocionais, prova social implícita e CTA urgente. Máximo 500 caracteres.",
  "altText": "Alt text descritivo da imagem para acessibilidade e SEO. Máximo 150 caracteres.",
  "urgencyOverlays": [
    "Overlay de urgência 1 curto",
    "Overlay de urgência 2 curto"
  ],
  "hashtags": "#hashtag1 #hashtag2 #hashtag3 #hashtag4 #hashtag5 #hashtag6 #hashtag7 #hashtag8"
}

Retorne APENAS o JSON, sem markdown.`,
  );

  const content = result.response.text();
  return parseAIJson(SEOPackSchema, content);
}

interface GeminiInlineData {
  mimeType: string;
  data: string;
}

interface GeminiPart {
  text?: string;
  inlineData?: GeminiInlineData;
}

interface GeminiImageResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: {
    message?: string;
  };
}

async function generateLifestyleImage(imagePrompt: string): Promise<string | null> {
  try {
    const apiKey = getGeminiApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ role: "user", parts: [{ text: imagePrompt }] }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    };

    const response = await axios.post<GeminiImageResponse>(url, body, {
      timeout: 60000,
      headers: { "Content-Type": "application/json" },
    });

    const parts = response.data.candidates?.[0]?.content?.parts;
    if (!parts) return null;

    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith("image/") && part.inlineData.data) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

router.post("/regenerate-image/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ error: "INVALID_ID", message: "ID inválido" });
    return;
  }

  try {
    const [generation] = await db
      .select()
      .from(generationsTable)
      .where(eq(generationsTable.id, id))
      .limit(1);

    if (!generation) {
      res.status(404).json({ error: "NOT_FOUND", message: "Geração não encontrada" });
      return;
    }

    const visionAnalysis = generation.visionAnalysis as { imagePrompt: string };
    const imagePrompt = visionAnalysis?.imagePrompt;

    if (!imagePrompt) {
      res.status(400).json({ error: "NO_PROMPT", message: "Prompt de imagem não disponível" });
      return;
    }

    req.log.info({ id }, "Regenerating lifestyle image");
    const lifestyleImageUrl = await generateLifestyleImage(imagePrompt);

    await db
      .update(generationsTable)
      .set({ lifestyleImageUrl: lifestyleImageUrl || null })
      .where(eq(generationsTable.id, id));

    res.json({ lifestyleImageUrl: lifestyleImageUrl || null });
  } catch (err) {
    req.log.error({ err }, "Regeneration failed");
    res.status(500).json({ error: "REGENERATION_FAILED", message: "Falha ao regenerar imagem. Tente novamente." });
  }
});

router.post("/generate", async (req, res) => {
  try {
    const parsed = GeneratePinAssetsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "INVALID_REQUEST", message: "URL inválida" });
      return;
    }

    const { url } = parsed.data;

    try {
      await validatePublicUrl(url);
    } catch (validationErr) {
      res.status(400).json({
        error: "INVALID_URL",
        message: validationErr instanceof Error ? validationErr.message : "URL inválida",
      });
      return;
    }

    req.log.info({ url }, "Starting generation");

    let product;

    try {
      product = await scrapeProduct(url);
      if (!product.title || product.title.length < 3) {
        throw new Error("Title too short or empty from scraping");
      }
    } catch (scrapeErr) {
      req.log.warn({ err: scrapeErr }, "Scraping failed, falling back to AI inference");
      product = await generateFromUrlWithAI(url);
    }

    if (!product.title) {
      res.status(400).json({
        error: "SCRAPE_FAILED",
        message: "Não foi possível extrair informações do produto desta URL.",
      });
      return;
    }

    const visionAnalysis = await analyzeProductWithAI(product);

    const [lifestyleImageUrl, seoPack] = await Promise.all([
      generateLifestyleImage(visionAnalysis.imagePrompt),
      generateSEOPack({
        title: product.title,
        price: product.price,
        description: product.description,
        originalUrl: product.originalUrl,
        visionAnalysis,
      }),
    ]);

    const [inserted] = await db
      .insert(generationsTable)
      .values({
        originalUrl: url,
        productTitle: product.title,
        productPrice: product.price || null,
        productDescription: product.description || null,
        productImageUrl: product.imageUrl || null,
        visionAnalysis,
        lifestyleImageUrl: lifestyleImageUrl || null,
        seoPack,
      })
      .returning();

    res.json({
      id: inserted.id,
      product: {
        title: product.title,
        price: product.price || undefined,
        description: product.description || undefined,
        imageUrl: product.imageUrl || undefined,
        originalUrl: product.originalUrl,
      },
      visionAnalysis,
      lifestyleImageUrl: lifestyleImageUrl || undefined,
      seoPack,
      createdAt: inserted.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Generation failed");
    res.status(500).json({
      error: "GENERATION_FAILED",
      message: "Falha ao gerar os ativos. Tente novamente.",
    });
  }
});

export default router;
