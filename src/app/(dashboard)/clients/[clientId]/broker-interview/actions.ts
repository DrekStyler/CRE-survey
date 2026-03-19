"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { brokerInterviews, brokerInsights, hypotheses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAnthropicClient } from "@/lib/ai/client";
import { getClient } from "../../actions";
import type { BrokerInterviewInput } from "@/lib/validators/broker-interview";

export async function getBrokerInterview(clientId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const result = await db
    .select()
    .from(brokerInterviews)
    .where(eq(brokerInterviews.clientId, clientId))
    .limit(1);

  return result[0] || null;
}

export async function saveBrokerInterview(
  clientId: string,
  data: BrokerInterviewInput
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Verify client ownership
  await getClient(clientId);

  const existing = await getBrokerInterview(clientId);

  if (existing) {
    await db
      .update(brokerInterviews)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(brokerInterviews.id, existing.id));
  } else {
    await db.insert(brokerInterviews).values({
      clientId,
      ...data,
      createdBy: userId,
    });
  }

  revalidatePath(`/clients/${clientId}/broker-interview`);
}

export async function completeBrokerInterview(clientId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const client = await getClient(clientId);
  const interview = await getBrokerInterview(clientId);

  if (!interview) throw new Error("No broker interview found");

  // Use AI to extract insights and generate hypotheses
  const anthropic = getAnthropicClient();

  const interviewSummary = [
    interview.brokerHypothesis && `Hypothesis: ${interview.brokerHypothesis}`,
    interview.knownClientIssues && `Known Issues: ${interview.knownClientIssues}`,
    interview.marketConstraints && `Market Constraints: ${interview.marketConstraints}`,
    interview.budgetSignals && `Budget Signals: ${interview.budgetSignals}`,
    interview.painPoints && `Pain Points: ${interview.painPoints}`,
    interview.growthExpectations && `Growth: ${interview.growthExpectations}`,
    interview.timing && `Timing: ${interview.timing}`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    system: `You are a CRE analyst. Analyze the broker's interview data and extract structured insights and initial hypotheses.

Respond with valid JSON:
{
  "insights": [
    { "category": "string", "insight": "string", "derivedFrom": "string" }
  ],
  "hypotheses": [
    {
      "type": "revenue" | "cost" | "operational" | "space" | "growth" | "risk",
      "statement": "string",
      "confidenceScore": number 0-100,
      "dimensionScoreNpv": number 0-100,
      "dimensionScoreCost": number 0-100,
      "dimensionScoreEbitda": number 0-100,
      "scoringReasoning": "string"
    }
  ]
}

Scoring guide: 0-25 weak, 26-50 moderate, 51-75 strong, 76-100 dominant.`,
    messages: [
      {
        role: "user",
        content: `Client: ${client.legalName} (${client.industry || "Unknown industry"})
Location: ${client.hqLocation || "Unknown"}
Employees: ${client.employeeEstimate || "Unknown"}

Broker Interview Data:
${interviewSummary}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");

  const parsed = JSON.parse(jsonMatch[0]);

  // Store insights
  if (parsed.insights?.length > 0) {
    await db.insert(brokerInsights).values(
      parsed.insights.map((i: { category: string; insight: string; derivedFrom?: string }) => ({
        brokerInterviewId: interview.id,
        category: i.category,
        insight: i.insight,
        derivedFrom: i.derivedFrom,
      }))
    );
  }

  // Store hypotheses
  if (parsed.hypotheses?.length > 0) {
    await db.insert(hypotheses).values(
      parsed.hypotheses.map(
        (h: {
          type: string;
          statement: string;
          confidenceScore?: number;
          dimensionScoreNpv?: number;
          dimensionScoreCost?: number;
          dimensionScoreEbitda?: number;
          scoringReasoning?: string;
        }) => ({
          clientId,
          type: h.type as "revenue" | "cost" | "operational" | "space" | "growth" | "risk",
          statement: h.statement,
          confidenceScore: h.confidenceScore,
          dimensionScoreNpv: h.dimensionScoreNpv,
          dimensionScoreCost: h.dimensionScoreCost,
          dimensionScoreEbitda: h.dimensionScoreEbitda,
          scoringReasoning: h.scoringReasoning,
          source: "broker_interview",
        })
      )
    );
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/broker-interview`);

  return { insights: parsed.insights, hypotheses: parsed.hypotheses };
}
