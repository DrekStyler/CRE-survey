import { pgTable, uuid, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { clients } from "./clients";
import { interviewTemplates } from "./interview-templates";

export const clientInterviews = pgTable("client_interviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  templateId: uuid("template_id")
    .notNull()
    .references(() => interviewTemplates.id, { onDelete: "restrict" }),
  status: varchar("status", { length: 50 }).default("in_progress"),
  responses: jsonb("responses").notNull().default("[]"),
  // responses shape: [{ questionId, sectionId, response, notes, followUps: [...] }]
  unresolvedQuestions: jsonb("unresolved_questions").default("[]"),
  conductedBy: varchar("conducted_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ClientInterview = typeof clientInterviews.$inferSelect;
export type NewClientInterview = typeof clientInterviews.$inferInsert;
