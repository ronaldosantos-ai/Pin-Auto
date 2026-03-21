import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const generationsTable = pgTable("generations", {
  id: serial("id").primaryKey(),
  originalUrl: text("original_url").notNull(),
  productTitle: text("product_title").notNull(),
  productPrice: text("product_price"),
  productDescription: text("product_description"),
  productImageUrl: text("product_image_url"),
  visionAnalysis: jsonb("vision_analysis").notNull(),
  lifestyleImageUrl: text("lifestyle_image_url"),
  seoPack: jsonb("seo_pack").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGenerationSchema = createInsertSchema(generationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type Generation = typeof generationsTable.$inferSelect;
