import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { clients } from "./clients";

export const interviewTemplates = pgTable("interview_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  version: integer("version").default(1),
  status: varchar("status", { length: 50 }).default("draft"),
  sections: jsonb("sections").notNull(),
  // sections shape: [{ id, title, description, questions: [{ id, text, type, purpose, order }] }]
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InterviewTemplate = typeof interviewTemplates.$inferSelect;
export type NewInterviewTemplate = typeof interviewTemplates.$inferInsert;
