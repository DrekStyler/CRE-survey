"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  drivers,
  hypotheses,
  brokerInterviews,
  brokerInsights,
  researchFindings,
  clientInterviews,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAnthropicClient } from "@/lib/ai/client";
import { buildInsightGenerationPrompt } from "@/lib/ai/prompts/insight-generation";
import {
  buildScenarioProjectionPrompt,
  buildMultiLocationScenarioPrompt,
} from "@/lib/ai/prompts/scenario-projection";
import { clients } from "@/lib/db/schema/clients";
import { officeLocations } from "@/lib/db/schema/office-locations";
import { getClient } from "../../actions";
import type {
  InterviewResponse,
  ScenarioProjectionData,
  StoredProjectionData,
  MultiLocationProjectionData,
  LocationProjection,
} from "@/types";

export async function getDrivers(clientId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db.select().from(drivers).where(eq(drivers.clientId, clientId));
}

export async function getFindings(clientId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db.select().from(researchFindings).where(eq(researchFindings.clientId, clientId));
}

export async function getHypotheses(clientId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  return db
    .select()
    .from(hypotheses)
    .where(eq(hypotheses.clientId, clientId));
}

export async function generateInsights(clientId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const client = await getClient(clientId);

  // Gather all data
  const [interviews, findings, existingHypotheses, interviewData] =
    await Promise.all([
      db
        .select()
        .from(brokerInterviews)
        .where(eq(brokerInterviews.clientId, clientId))
        .limit(1),
      db
        .select()
        .from(researchFindings)
        .where(eq(researchFindings.clientId, clientId)),
      db
        .select()
        .from(hypotheses)
        .where(eq(hypotheses.clientId, clientId)),
      db
        .select()
        .from(clientInterviews)
        .where(eq(clientInterviews.clientId, clientId))
        .limit(1),
    ]);

  // Build broker interview summary
  let brokerSummary = "";
  if (interviews[0]) {
    const interview = interviews[0];
    const insights = await db
      .select()
      .from(brokerInsights)
      .where(eq(brokerInsights.brokerInterviewId, interview.id));

    brokerSummary = [
      interview.brokerHypothesis && `Hypothesis: ${interview.brokerHypothesis}`,
      interview.knownClientIssues && `Issues: ${interview.knownClientIssues}`,
      interview.marketConstraints && `Market: ${interview.marketConstraints}`,
      interview.budgetSignals && `Budget: ${interview.budgetSignals}`,
      interview.painPoints && `Pain Points: ${interview.painPoints}`,
      interview.growthExpectations && `Growth: ${interview.growthExpectations}`,
      insights.length > 0 &&
        `Extracted Insights:\n${insights.map((i) => `  [${i.category}] ${i.insight}`).join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const findingsList = findings.map((f) => ({
    id: f.id,
    text: `[${f.category}] ${f.title}: ${f.summary} (${f.confidence}% confidence)`,
  }));

  const interviewResponses: string[] = [];
  if (interviewData[0]) {
    const responses = (interviewData[0].responses as InterviewResponse[]) || [];
    responses.forEach((r) => {
      interviewResponses.push(`Q: ${r.questionId} -> A: ${r.response}`);
    });
  }

  const hypothesesList = existingHypotheses.map(
    (h) =>
      `[${h.type}/${h.status}] ${h.statement} (EBITDA:${h.dimensionScoreEbitda}, NPV:${h.dimensionScoreNpv}, Cost:${h.dimensionScoreCost})`
  );

  const prompt = buildInsightGenerationPrompt(
    client,
    brokerSummary,
    findingsList,
    interviewResponses,
    hypothesesList
  );

  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 6000,
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");

  const parsed = JSON.parse(jsonMatch[0]);

  // Store drivers
  if (parsed.drivers?.length > 0) {
    // Delete old drivers first
    await db.delete(drivers).where(eq(drivers.clientId, clientId));

    await db.insert(drivers).values(
      parsed.drivers.map(
        (d: {
          type: string;
          title: string;
          description: string;
          impact?: string;
          supportingEvidence?: { source: string; quote: string; findingId?: string }[];
        }) => ({
          clientId,
          type: d.type as "revenue" | "cost" | "operational" | "space",
          title: d.title,
          description: d.description,
          impact: d.impact,
          supportingEvidence: d.supportingEvidence,
        })
      )
    );
  }

  // Update hypotheses
  if (parsed.hypothesisUpdates?.length > 0) {
    for (const update of parsed.hypothesisUpdates) {
      // Try to match existing hypothesis by statement
      const existing = existingHypotheses.find(
        (h) =>
          h.statement.toLowerCase().includes(update.statement?.toLowerCase()?.slice(0, 30) || "")
      );

      if (existing) {
        await db
          .update(hypotheses)
          .set({
            status: update.status,
            dimensionScoreNpv: update.dimensionScoreNpv,
            dimensionScoreCost: update.dimensionScoreCost,
            dimensionScoreEbitda: update.dimensionScoreEbitda,
            scoringReasoning: update.scoringReasoning,
            updatedAt: new Date(),
          })
          .where(eq(hypotheses.id, existing.id));
      }
    }
  }

  revalidatePath(`/clients/${clientId}/insights`);
  return {
    driversCount: parsed.drivers?.length || 0,
    updatesCount: parsed.hypothesisUpdates?.length || 0,
  };
}

export async function updateHypothesisStatus(
  hypothesisId: string,
  status: "proposed" | "confirmed" | "rejected"
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  await db
    .update(hypotheses)
    .set({ status, updatedAt: new Date() })
    .where(eq(hypotheses.id, hypothesisId));
}

export async function getScenarioProjections(
  clientId: string
): Promise<StoredProjectionData | null> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [client] = await db
    .select({ scenarioProjections: clients.scenarioProjections })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client?.scenarioProjections) return null;

  try {
    return JSON.parse(client.scenarioProjections) as StoredProjectionData;
  } catch {
    return null;
  }
}

function normalizeConfidence(raw: number): number {
  if (raw > 0 && raw <= 1) return Math.round(raw * 100);
  return Math.round(raw || 0);
}

function parseAiProjectionResponse(text: string) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");
  const parsed = JSON.parse(jsonMatch[0]);

  // Enforce cost invariants: cost = leaseCost + operationalCost, netProfit = revenue - cost
  for (const scenarioKey of [
    "npvOptimized",
    "costOptimized",
    "ebitdaOptimized",
  ]) {
    const scenario = parsed.scenarios?.[scenarioKey];
    if (!scenario?.yearlyProjections) continue;
    for (const yr of scenario.yearlyProjections) {
      if (yr.leaseCost != null && yr.operationalCost != null) {
        yr.cost = yr.leaseCost + yr.operationalCost;
        yr.netProfit = yr.revenue - yr.cost;
      }
    }
  }

  return parsed;
}

export async function generateScenarioProjections(clientId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const client = await getClient(clientId);

  // Gather data in parallel (including office locations)
  const [interviews, driversList, hypothesesList, locations] =
    await Promise.all([
      db
        .select()
        .from(brokerInterviews)
        .where(eq(brokerInterviews.clientId, clientId))
        .limit(1),
      db.select().from(drivers).where(eq(drivers.clientId, clientId)),
      db.select().from(hypotheses).where(eq(hypotheses.clientId, clientId)),
      db
        .select()
        .from(officeLocations)
        .where(eq(officeLocations.clientId, clientId)),
    ]);

  // Build broker summary
  let brokerSummary = "";
  if (interviews[0]) {
    const interview = interviews[0];
    const insights = await db
      .select()
      .from(brokerInsights)
      .where(eq(brokerInsights.brokerInterviewId, interview.id));

    brokerSummary = [
      interview.brokerHypothesis &&
        `Hypothesis: ${interview.brokerHypothesis}`,
      interview.knownClientIssues &&
        `Issues: ${interview.knownClientIssues}`,
      interview.marketConstraints &&
        `Market: ${interview.marketConstraints}`,
      interview.budgetSignals && `Budget: ${interview.budgetSignals}`,
      interview.painPoints && `Pain Points: ${interview.painPoints}`,
      interview.growthExpectations &&
        `Growth: ${interview.growthExpectations}`,
      insights.length > 0 &&
        `Extracted Insights:\n${insights.map((i) => `  [${i.category}] ${i.insight}`).join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const driverSummaries = driversList.map((d) => ({
    type: d.type,
    title: d.title,
    description: d.description,
    impact: d.impact || "medium",
  }));

  const hypothesisSummaries = hypothesesList.map((h) => ({
    statement: h.statement,
    type: h.type,
    dimensionScoreNpv: h.dimensionScoreNpv,
    dimensionScoreCost: h.dimensionScoreCost,
    dimensionScoreEbitda: h.dimensionScoreEbitda,
  }));

  const anthropic = getAnthropicClient();
  let storedData: StoredProjectionData;

  if (locations.length >= 2) {
    // Multi-location path: parallel AI calls per location (max 10)
    const cappedLocations = locations.slice(0, 10);

    const locationResults = await Promise.all(
      cappedLocations.map(async (location): Promise<LocationProjection> => {
        const prompt = buildMultiLocationScenarioPrompt(
          client,
          location,
          brokerSummary,
          driverSummaries,
          hypothesisSummaries,
          cappedLocations
        );

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 6000,
          system: prompt.system,
          messages: [{ role: "user", content: prompt.user }],
        });

        const content = response.content[0];
        if (content.type !== "text") throw new Error("Unexpected response");

        const parsed = parseAiProjectionResponse(content.text);

        return {
          location: {
            locationId: location.id,
            name: location.name || "Unnamed",
            city: location.city || null,
            state: location.state || null,
            locationType: location.locationType || null,
          },
          assumptions: parsed.assumptions,
          scenarios: parsed.scenarios,
          confidence: normalizeConfidence(parsed.confidence),
        };
      })
    );

    storedData = {
      version: 2,
      generatedAt: new Date().toISOString(),
      locations: locationResults,
    } satisfies MultiLocationProjectionData;
  } else {
    // Single-location path (existing behavior)
    const prompt = buildScenarioProjectionPrompt(
      client,
      brokerSummary,
      driverSummaries,
      hypothesisSummaries
    );

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 6000,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected response");

    const parsed = parseAiProjectionResponse(content.text);

    storedData = {
      generatedAt: new Date().toISOString(),
      assumptions: parsed.assumptions,
      scenarios: parsed.scenarios,
      confidence: normalizeConfidence(parsed.confidence),
    } satisfies ScenarioProjectionData;
  }

  await db
    .update(clients)
    .set({
      scenarioProjections: JSON.stringify(storedData),
      updatedAt: new Date(),
    })
    .where(eq(clients.id, clientId));

  revalidatePath(`/clients/${clientId}/insights`);
  return storedData;
}
