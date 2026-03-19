"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  interviewTemplates,
  brokerInsights,
  brokerInterviews,
  researchFindings,
  hypotheses,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAnthropicClient } from "@/lib/ai/client";
import { buildInterviewQuestionsPrompt } from "@/lib/ai/prompts/interview-builder";
import { getClient } from "../../actions";
import type { InterviewSection } from "@/types";

export async function getInterviewTemplate(clientId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const result = await db
    .select()
    .from(interviewTemplates)
    .where(eq(interviewTemplates.clientId, clientId))
    .limit(1);

  return result[0] || null;
}

export async function generateInterviewQuestions(clientId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const client = await getClient(clientId);

  // Gather context
  const interviews = await db
    .select()
    .from(brokerInterviews)
    .where(eq(brokerInterviews.clientId, clientId))
    .limit(1);

  let insightsList: string[] = [];
  if (interviews[0]) {
    const insights = await db
      .select()
      .from(brokerInsights)
      .where(eq(brokerInsights.brokerInterviewId, interviews[0].id));
    insightsList = insights.map((i) => `[${i.category}] ${i.insight}`);
  }

  const findings = await db
    .select()
    .from(researchFindings)
    .where(eq(researchFindings.clientId, clientId));
  const findingsList = findings.map(
    (f) => `[${f.category}] ${f.title}: ${f.summary}`
  );

  const existingHypotheses = await db
    .select()
    .from(hypotheses)
    .where(eq(hypotheses.clientId, clientId));
  const hypothesesList = existingHypotheses.map(
    (h) => `[${h.type}/${h.status}] ${h.statement}`
  );

  const prompt = buildInterviewQuestionsPrompt(
    client,
    insightsList,
    findingsList,
    hypothesesList
  );

  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");

  const parsed = JSON.parse(jsonMatch[0]);

  // Check for existing template
  const existing = await getInterviewTemplate(clientId);

  if (existing) {
    await db
      .update(interviewTemplates)
      .set({
        sections: parsed.sections,
        version: (existing.version || 1) + 1,
        updatedAt: new Date(),
      })
      .where(eq(interviewTemplates.id, existing.id));
  } else {
    await db.insert(interviewTemplates).values({
      clientId,
      sections: parsed.sections,
      createdBy: userId,
    });
  }

  revalidatePath(`/clients/${clientId}/interview-builder`);
  return parsed.sections;
}

export async function updateTemplateSections(
  clientId: string,
  sections: InterviewSection[]
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const template = await getInterviewTemplate(clientId);
  if (!template) throw new Error("No template found");

  await db
    .update(interviewTemplates)
    .set({ sections, updatedAt: new Date() })
    .where(eq(interviewTemplates.id, template.id));

  revalidatePath(`/clients/${clientId}/interview-builder`);
}

export async function finalizeTemplate(clientId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const template = await getInterviewTemplate(clientId);
  if (!template) throw new Error("No template found");

  await db
    .update(interviewTemplates)
    .set({ status: "finalized", updatedAt: new Date() })
    .where(eq(interviewTemplates.id, template.id));

  revalidatePath(`/clients/${clientId}/interview-builder`);
}
