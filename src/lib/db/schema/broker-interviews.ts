import { pgTable, uuid, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { clients } from "./clients";

export const brokerInterviews = pgTable("broker_interviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  brokerHypothesis: text("broker_hypothesis"),
  knownClientIssues: text("known_client_issues"),
  marketConstraints: text("market_constraints"),
  currentFootprint: jsonb("current_footprint"), // { locations, sqft, lease_details }
  budgetSignals: text("budget_signals"),
  timing: text("timing"),
  painPoints: text("pain_points"),
  growthExpectations: text("growth_expectations"),
  additionalNotes: text("additional_notes"),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BrokerInterview = typeof brokerInterviews.$inferSelect;
export type NewBrokerInterview = typeof brokerInterviews.$inferInsert;
