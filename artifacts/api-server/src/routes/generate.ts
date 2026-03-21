import { Router, type IRouter } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, generationsTable } from "@workspace/db";
import { GeneratePinAssetsBody } from "@workspace/api-zod";

const router: IRouter = Router();

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

  const { data } = await axios.get(url, {
    headers,
    timeout: 20000,
    maxRedirects: 10,
    validateStatus: (status) => status < 500,
  });

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
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `Você é um especialista em análise de produtos de e-commerce. A partir desta URL de produto, gere informações plausíveis sobre o produto para criação de conteúdo para Pinterest.

URL: ${url}

Baseie-se no domínio e caminho da URL para inferir o produto. Retorne um JSON com:
{
  "title": "Nome do produto inferido da URL",
  "price": "Preço estimado (se possível inferir)",
  "description": "Descrição detalhada do produto inferido",
  "imageUrl": ""
}

Retorne APENAS o JSON, sem markdown.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content || "{}";
  const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
  const data = JSON.parse(cleaned);
  return {
    title: data.title || url,
    price: data.price || "",
    description: data.description || "",
    imageUrl: "",
    originalUrl: url,
  };
}

async function analyzeProductWithAI(product: {
  title: string;
  price: string;
  description: string;
  imageUrl: string;
  originalUrl: string;
}) {
  const messages: Array<{
    role: "user" | "system";
    content:
      | string
      | Array<{
          type: string;
          text?: string;
          image_url?: { url: string };
        }>;
  }> = [];

  if (product.imageUrl) {
    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: `Você é um especialista em análise de produtos para Pinterest. Analise este produto e gere uma descrição técnica detalhada da imagem para ser usada como prompt de geração de imagem lifestyle.

Produto: ${product.title}
Preço: ${product.price || "N/A"}
Descrição: ${product.description || "N/A"}
URL: ${product.originalUrl}

Analise a imagem do produto e retorne um JSON com:
{
  "technicalDescription": "descrição técnica extremamente detalhada da peça/produto: materiais, cores, forma, detalhes visuais marcantes, acabamentos, etc.",
  "imagePrompt": "prompt em inglês para gerar uma imagem lifestyle fotorrealista com uma pessoa usando/segurando/interagindo com o produto em um ambiente moderno e aspiracional. O prompt deve ser muito específico sobre o produto e criar uma cena lifestyle atraente para Pinterest."
}

Retorne APENAS o JSON, sem markdown ou explicações.`,
        },
        {
          type: "image_url",
          image_url: { url: product.imageUrl },
        },
      ],
    });
  } else {
    messages.push({
      role: "user",
      content: `Você é um especialista em análise de produtos para Pinterest. Analise este produto e gere uma descrição técnica e um prompt de imagem lifestyle.

Produto: ${product.title}
Preço: ${product.price || "N/A"}
Descrição: ${product.description || "N/A"}
URL: ${product.originalUrl}

Retorne um JSON com:
{
  "technicalDescription": "descrição técnica detalhada do produto baseada nas informações disponíveis: materiais, cores, forma, detalhes visuais marcantes, acabamentos, etc.",
  "imagePrompt": "prompt em inglês para gerar uma imagem lifestyle fotorrealista com uma pessoa usando/segurando/interagindo com o produto em um ambiente moderno e aspiracional."
}

Retorne APENAS o JSON, sem markdown ou explicações.`,
    });
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages,
  });

  const content = response.choices[0]?.message?.content || "{}";
  const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned);
}

async function generateSEOPack(product: {
  title: string;
  price: string;
  description: string;
  originalUrl: string;
  visionAnalysis: { technicalDescription: string };
}) {
  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `Você é um especialista em SEO para Pinterest e copywriting de alta conversão em português brasileiro. 

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
      },
    ],
  });

  const content = response.choices[0]?.message?.content || "{}";
  const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned);
}

async function generateLifestyleImage(imagePrompt: string): Promise<string | null> {
  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: imagePrompt,
      size: "1024x1024",
    } as Parameters<typeof openai.images.generate>[0]);

    const b64 = (response.data[0] as { b64_json?: string })?.b64_json;
    if (b64) {
      return `data:image/png;base64,${b64}`;
    }
    return null;
  } catch {
    return null;
  }
}

router.post("/generate", async (req, res) => {
  try {
    const parsed = GeneratePinAssetsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "INVALID_REQUEST", message: "URL inválida" });
      return;
    }

    const { url } = parsed.data;

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
