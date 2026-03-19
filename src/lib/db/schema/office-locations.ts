import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { clients } from "./clients";

export const officeLocations = pgTable("office_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }),
  address: varchar("address", { length: 500 }),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }),
  postalCode: varchar("postal_code", { length: 20 }),
  squareFeet: integer("square_feet"),
  headcount: integer("headcount"),
  leaseExpiration: timestamp("lease_expiration"),
  monthlyRent: numeric("monthly_rent", { precision: 12, scale: 2 }),
  locationType: varchar("location_type", { length: 100 }), // HQ, regional, satellite, coworking
  source: varchar("source", { length: 50 }), // broker_input, enrichment, research
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OfficeLocation = typeof officeLocations.$inferSelect;
export type NewOfficeLocation = typeof officeLocations.$inferInsert;
