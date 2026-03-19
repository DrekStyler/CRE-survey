"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  clientInterviews,
  interviewTemplates,
  hypotheses,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAnthropicClient } from "@/lib/ai/client";
import type { InterviewResponse } from "@/types";

export async function getClientInterview(clientId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const result = await db
    .select()
    .from(clientInterviews)
    .where(eq(clientInterviews.clientId, clientId))
    .limit(1);

  return result[0] || null;
}

export async function startClientInterview(clientId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Get finalized template
  const [template] = await db
    .select()
    .from(interviewTemplates)
    .where(eq(interviewTemplates.clientId, clientId))
    .limit(1);

  if (!template) throw new Error("No interview template found");

  const existing = await getClientInterview(clientId);
  if (existing) return existing;

  const [interview] = await db
    .insert(clientInterviews)
    .values({
      clientId,
      templateId: template.id,
      conductedBy: userId,
      responses: [],
    })
    .returning();

  revalidatePath(`/clients/${clientId}/client-interview`);
  return interview;
}

export async function saveResponse(
  clientId: string,
  response: InterviewResponse
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const interview = await getClientInterview(clientId);
  if (!interview) throw new Error("No active interview");

  const existingResponses = (interview.responses as InterviewResponse[]) || [];
  const idx = existingResponses.findIndex(
    (r) => r.questionId === response.questionId
  );

  let updatedResponses: InterviewResponse[];
  if (idx >= 0) {
    updatedResponses = [...existingResponses];
    updatedResponses[idx] = response;
  } else {
    updatedResponses = [...existingResponses, response];
  }

  await db
    .update(clientInterviews)
    .set({
      responses: updatedResponses,
      updatedAt: new Date(),
    })
    .where(eq(clientInterviews.id, interview.id));

  revalidatePath(`/clients/${clientId}/client-interview`);
}

export async function completeInterview(clientId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const interview = await getClientInterview(clientId);
  if (!interview) throw new Error("No active interview");

  await db
    .update(clientInterviews)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(clientInterviews.id, interview.id));

  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/client-interview`);
}

export async function suggestFollowUp(
  clientId: string,
  questionText: string,
  responseText: string
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const existingHypotheses = await db
    .select()
    .from(hypotheses)
    .where(eq(hypotheses.clientId, clientId));

  const anthropic = getAnthropicClient();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: `You are a CRE interview consultant. Based on the client's response to a question, suggest 1-3 follow-up questions that dig deeper.

Respond with valid JSON:
{
  "followUps": [
    { "question": "string", "reasoning": "string" }
  ]
}`,
    messages: [
      {
        role: "user",
        content: `Question asked: ${questionText}
Client's response: ${responseText}

Current hypotheses being tested:
${existingHypotheses.map((h) => `- [${h.type}] ${h.statement}`).join("\n")}

Suggest follow-up questions.`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");

  return JSON.parse(jsonMatch[0]);
}
