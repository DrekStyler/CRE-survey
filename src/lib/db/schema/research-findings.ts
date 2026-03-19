import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { clients } from "./clients";

export const researchCategoryEnum = pgEnum("research_category", [
  "hiring_trends",
  "industry_benchmarks",
  "workforce_growth",
  "office_density",
  "talent_geography",
  "financial",
  "general",
]);

export const researchFindings = pgTable("research_findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  category: researchCategoryEnum("category").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  summary: text("summary").notNull(),
  sourceUrl: varchar("source_url", { length: 1000 }),
  sourceName: varchar("source_name", { length: 255 }),
  retrievalDate: timestamp("retrieval_date").notNull(),
  confidence: integer("confidence").notNull(), // 0-100
  rawContent: text("raw_content"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ResearchFinding = typeof researchFindings.$inferSelect;
export type NewResearchFinding = typeof researchFindings.$inferInsert;
