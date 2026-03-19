import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";

export const enrichmentStatusEnum = pgEnum("enrichment_status", [
  "pending",
  "in_progress",
  "completed",
  "failed",
]);

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  legalName: varchar("legal_name", { length: 255 }).notNull(),
  commonName: varchar("common_name", { length: 255 }),
  website: varchar("website", { length: 500 }),
  emailDomain: varchar("email_domain", { length: 255 }),
  canonicalDomain: varchar("canonical_domain", { length: 255 }),
  industry: varchar("industry", { length: 255 }),
  hqLocation: varchar("hq_location", { length: 500 }),
  employeeEstimate: integer("employee_estimate"),
  enrichmentStatus: enrichmentStatusEnum("enrichment_status").default(
    "pending"
  ),
  enrichmentData: text("enrichment_data"), // JSON blob of enriched fields
  scenarioProjections: text("scenario_projections"), // JSON blob of scenario projection data
  entityMatchConfidence: integer("entity_match_confidence"), // 0-100
  confirmedByBroker: boolean("confirmed_by_broker").default(false),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
