import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { brokerInterviews } from "./broker-interviews";

export const brokerInsights = pgTable("broker_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  brokerInterviewId: uuid("broker_interview_id")
    .notNull()
    .references(() => brokerInterviews.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 100 }).notNull(),
  insight: text("insight").notNull(),
  derivedFrom: text("derived_from"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BrokerInsight = typeof brokerInsights.$inferSelect;
export type NewBrokerInsight = typeof brokerInsights.$inferInsert;
