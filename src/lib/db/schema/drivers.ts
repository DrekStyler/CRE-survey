import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { clients } from "./clients";

export const driverTypeEnum = pgEnum("driver_type", [
  "revenue",
  "cost",
  "operational",
  "space",
]);

export const drivers = pgTable("drivers", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  type: driverTypeEnum("type").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  impact: varchar("impact", { length: 50 }), // high, medium, low
  supportingEvidence: jsonb("supporting_evidence"), // [{ source, quote, findingId }]
  linkedHypothesisIds: jsonb("linked_hypothesis_ids").default("[]"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Driver = typeof drivers.$inferSelect;
export type NewDriver = typeof drivers.$inferInsert;
