import { Router, type IRouter } from "express";
import { db, generationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/history", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: generationsTable.id,
        productTitle: generationsTable.productTitle,
        productImageUrl: generationsTable.productImageUrl,
        originalUrl: generationsTable.originalUrl,
        createdAt: generationsTable.createdAt,
      })
      .from(generationsTable)
      .orderBy(desc(generationsTable.createdAt))
      .limit(50);

    res.json(
      rows.map((r) => ({
        id: r.id,
        productTitle: r.productTitle,
        productImageUrl: r.productImageUrl || undefined,
        originalUrl: r.originalUrl,
        createdAt: r.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get history");
    res.status(500).json({ error: "SERVER_ERROR", message: "Falha ao buscar histórico." });
  }
});

router.get("/history/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "INVALID_ID", message: "ID inválido." });
      return;
    }

    const [row] = await db
      .select()
      .from(generationsTable)
      .where(eq(generationsTable.id, id))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "NOT_FOUND", message: "Geração não encontrada." });
      return;
    }

    const visionAnalysis = row.visionAnalysis as { technicalDescription: string; imagePrompt: string };
    const seoPack = row.seoPack as { titles: string[]; description: string; altText: string; urgencyOverlays: string[]; hashtags: string };

    res.json({
      id: row.id,
      product: {
        title: row.productTitle,
        price: row.productPrice || undefined,
        description: row.productDescription || undefined,
        imageUrl: row.productImageUrl || undefined,
        originalUrl: row.originalUrl,
      },
      visionAnalysis,
      lifestyleImageUrl: row.lifestyleImageUrl || undefined,
      seoPack,
      createdAt: row.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get generation by id");
    res.status(500).json({ error: "SERVER_ERROR", message: "Falha ao buscar geração." });
  }
});

export default router;
