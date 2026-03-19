import type { Client } from "@/lib/db/schema/clients";

export function buildResearchPrompt(
  client: Client,
  brokerInsights: string[],
  existingHypotheses: string[]
) {
  return {
    system: `You are a commercial real estate research analyst. Generate research findings for a client's space strategy analysis.

You MUST respond with valid JSON matching this structure:
{
  "findings": [
    {
      "category": "hiring_trends" | "industry_benchmarks" | "workforce_growth" | "office_density" | "talent_geography" | "financial" | "general",
      "title": "string - concise finding title",
      "summary": "string - 2-4 sentence summary of the finding",
      "sourceName": "string - name of source (e.g., 'Bureau of Labor Statistics')",
      "sourceUrl": "string - plausible URL for the source",
      "confidence": number 0-100
    }
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

Rules:
- Generate 6-10 findings across different categories
- Each finding must have a realistic source citation
- Confidence reflects your certainty about the information
- Generate 2-4 hypotheses based on the research
- Dimension scores: 0-25 weak, 26-50 moderate, 51-75 strong, 76-100 dominant
- Focus on information relevant to the client's real estate and space strategy
- Note: Your findings are based on training data, not live web search. Be transparent about confidence levels.`,
    user: `Research the following client for CRE space strategy analysis:

Company: ${client.legalName}
Industry: ${client.industry || "Unknown"}
HQ: ${client.hqLocation || "Unknown"}
Employees: ${client.employeeEstimate || "Unknown"}
Website: ${client.website || "Unknown"}

Broker Insights:
${brokerInsights.length > 0 ? brokerInsights.map((i) => `- ${i}`).join("\n") : "None yet"}

Existing Hypotheses:
${existingHypotheses.length > 0 ? existingHypotheses.map((h) => `- ${h}`).join("\n") : "None yet"}

Generate comprehensive research findings and updated hypotheses.`,
  };
}
