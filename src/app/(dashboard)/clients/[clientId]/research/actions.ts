"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  researchFindings,
  brokerInsights,
  hypotheses,
  brokerInterviews,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAnthropicClient } from "@/lib/ai/client";
import { buildResearchPrompt } from "@/lib/ai/prompts/research";
import { getClient } from "../../actions";

export async function getResearchFindings(clientId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db
    .select()
    .from(researchFindings)
    .where(eq(researchFindings.clientId, clientId));
}

export async function getHypotheses(clientId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db
    .select()
    .from(hypotheses)
    .where(eq(hypotheses.clientId, clientId));
}

export async function runResearch(clientId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const client = await getClient(clientId);

  // Get broker insights
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

  // Get existing hypotheses
  const existingHypotheses = await db
    .select()
    .from(hypotheses)
    .where(eq(hypotheses.clientId, clientId));
  const hypothesesList = existingHypotheses.map(
    (h) => `[${h.type}] ${h.statement} (confidence: ${h.confidenceScore}%)`
  );

  const prompt = buildResearchPrompt(client, insightsList, hypothesesList);

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

  // Store findings
  if (parsed.findings?.length > 0) {
    await db.insert(researchFindings).values(
      parsed.findings.map(
        (f: {
          category: string;
          title: string;
          summary: string;
          sourceName?: string;
          sourceUrl?: string;
          confidence: number;
        }) => ({
          clientId,
          category: f.category as
            | "hiring_trends"
            | "industry_benchmarks"
            | "workforce_growth"
            | "office_density"
            | "talent_geography"
            | "financial"
            | "general",
          title: f.title,
          summary: f.summary,
          sourceName: f.sourceName,
          sourceUrl: f.sourceUrl,
          retrievalDate: new Date(),
          confidence: f.confidence,
        })
      )
    );
  }

  // Store new hypotheses
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
          source: "research",
        })
      )
    );
  }

  revalidatePath(`/clients/${clientId}/research`);
  return {
    findingsCount: parsed.findings?.length || 0,
    hypothesesCount: parsed.hypotheses?.length || 0,
  };
}
