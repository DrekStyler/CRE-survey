import type { Client } from "@/lib/db/schema/clients";

export function buildInsightGenerationPrompt(
  client: Client,
  brokerInterviewSummary: string,
  researchFindings: { id: string; text: string }[] | string[],
  interviewResponses: string[],
  hypotheses: string[]
) {
  return {
    system: `You are a strategic CRE advisor performing comprehensive analysis to identify key drivers for a client's space strategy. Analyze ALL provided data to generate actionable insights.

You MUST respond with valid JSON matching this structure:
{
  "drivers": [
    {
      "type": "revenue" | "cost" | "operational" | "space",
      "title": "string - concise driver title",
      "description": "string - 2-3 sentence explanation of this driver",
      "impact": "high" | "medium" | "low",
      "supportingEvidence": [
        {
          "source": "string - where this evidence came from (broker interview, research, client interview)",
          "quote": "string - specific supporting data point or quote",
          "findingId": "string | null - if evidence comes from a research finding, include its ID from the findings list below"
        }
      ]
    }
  ],
  "hypothesisUpdates": [
    {
      "statement": "string - the hypothesis statement",
      "status": "confirmed" | "rejected" | "proposed",
      "dimensionScoreNpv": number 0-100,
      "dimensionScoreCost": number 0-100,
      "dimensionScoreEbitda": number 0-100,
      "scoringReasoning": "string - why these scores"
    }
  ]
}

Driver Categories:
- Revenue Drivers: How space impacts revenue generation (e.g., patient rooms, retail frontage, client-facing areas)
- Cost Drivers: Major cost factors (rent, buildout, operating costs, consolidation opportunities)
- Operational Drivers: How space affects operations (workflow efficiency, collaboration, technology needs)
- Space Drivers: Physical space requirements (density, growth capacity, location strategy, flexibility)

Rules:
- Generate 3-5 drivers per category (12-20 total)
- Each driver must cite specific evidence from the provided data
- Impact levels: high = material effect on business outcomes, medium = significant but not critical, low = notable but manageable
- Dimension scores: 0-25 weak signal, 26-50 moderate, 51-75 strong, 76-100 dominant
- Be specific and actionable, not generic
- Connect drivers to hypotheses where relevant
- When citing a research finding, include its ID in the findingId field so the UI can link back to the source`,
    user: `Generate comprehensive insight analysis for:

Company: ${client.legalName}
Industry: ${client.industry || "Unknown"}
Employees: ${client.employeeEstimate || "Unknown"}
HQ: ${client.hqLocation || "Unknown"}

=== BROKER INTERVIEW SUMMARY ===
${brokerInterviewSummary || "No broker interview data"}

=== RESEARCH FINDINGS ===
${researchFindings.length > 0 ? researchFindings.map((f) => typeof f === "string" ? `- ${f}` : `- [${f.id}] ${f.text}`).join("\n") : "No research findings"}

=== CLIENT INTERVIEW RESPONSES ===
${interviewResponses.length > 0 ? interviewResponses.map((r) => `- ${r}`).join("\n") : "No client interview responses"}

=== CURRENT HYPOTHESES ===
${hypotheses.length > 0 ? hypotheses.map((h) => `- ${h}`).join("\n") : "No hypotheses"}

Analyze all data and generate drivers and hypothesis updates.`,
  };
}
