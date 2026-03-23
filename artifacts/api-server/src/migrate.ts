import { pool } from "@workspace/db";
import { logger } from "./lib/logger";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    logger.info("Running database migrations...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS generations (
        id SERIAL PRIMARY KEY,
        original_url TEXT NOT NULL,
        product_title TEXT NOT NULL,
        product_price TEXT,
        product_description TEXT,
        product_image_url TEXT,
        vision_analysis JSONB NOT NULL,
        lifestyle_image_url TEXT,
        seo_pack JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    logger.info("Migrations complete.");
  } finally {
    client.release();
  }
}
