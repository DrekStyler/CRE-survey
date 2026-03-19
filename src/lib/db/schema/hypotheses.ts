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

export const hypothesisStatusEnum = pgEnum("hypothesis_status", [
  "proposed",
  "confirmed",
  "rejected",
]);

export const hypothesisTypeEnum = pgEnum("hypothesis_type", [
  "revenue",
  "cost",
  "operational",
  "space",
  "growth",
  "risk",
]);

export const hypotheses = pgTable("hypotheses", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  type: hypothesisTypeEnum("type").notNull(),
  statement: text("statement").notNull(),
  confidenceScore: integer("confidence_score"), // 0-100
  supportingFindings: text("supporting_findings"),
  status: hypothesisStatusEnum("status").default("proposed").notNull(),
  dimensionScoreNpv: integer("dimension_score_npv"), // 0-100
  dimensionScoreCost: integer("dimension_score_cost"), // 0-100
  dimensionScoreEbitda: integer("dimension_score_ebitda"), // 0-100
  scoringReasoning: text("scoring_reasoning"),
  source: varchar("source", { length: 50 }), // broker_interview, research, client_interview, ai
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Hypothesis = typeof hypotheses.$inferSelect;
export type NewHypothesis = typeof hypotheses.$inferInsert;
