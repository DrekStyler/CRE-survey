import type { Client } from "@/lib/db/schema/clients";

export function buildInterviewQuestionsPrompt(
  client: Client,
  brokerInsights: string[],
  researchFindings: string[],
  hypotheses: string[]
) {
  return {
    system: `You are a senior CRE consultant preparing for a C-level client interview. Generate targeted interview questions designed to validate hypotheses and uncover space strategy insights.

You MUST respond with valid JSON matching this structure:
{
  "sections": [
    {
      "id": "string - kebab-case section id",
      "title": "string - section title",
      "description": "string - why this section matters",
      "questions": [
        {
          "id": "string - unique question id (e.g., 'growth-1')",
          "text": "string - the interview question",
          "type": "open_ended" | "scale" | "multiple_choice" | "yes_no",
          "purpose": "string - what this question aims to validate or discover",
          "order": number
        }
      ]
    }
  ]
}

Fixed sections (generate questions for each):
1. Growth Expectations - Understanding future headcount, revenue growth, expansion plans
2. Team Structure - Current org structure, remote/hybrid/in-office mix, departmental needs
3. Talent Strategy - Hiring plans, talent market, retention challenges, location preferences
4. Capital Constraints - Budget limitations, capital vs operating expense preferences, investment timeline
5. Operations & Workflows - Day-to-day space usage patterns, collaboration needs, technology requirements
6. Culture & Goals - Workplace culture aspirations, brand expression through space, employee experience

Rules:
- Generate 4-6 questions per section
- Questions should be open-ended and non-leading
- Each question should connect to at least one hypothesis or insight
- Prioritize questions that validate or invalidate existing hypotheses
- Questions should be appropriate for a C-level executive audience
- Include the purpose/reasoning so the broker understands why each question matters`,
    user: `Generate interview questions for:

Company: ${client.legalName}
Industry: ${client.industry || "Unknown"}
Employees: ${client.employeeEstimate || "Unknown"}

Broker Insights:
${brokerInsights.length > 0 ? brokerInsights.map((i) => `- ${i}`).join("\n") : "No broker insights yet"}

Research Findings:
${researchFindings.length > 0 ? researchFindings.map((f) => `- ${f}`).join("\n") : "No research findings yet"}

Active Hypotheses:
${hypotheses.length > 0 ? hypotheses.map((h) => `- ${h}`).join("\n") : "No hypotheses yet"}

Generate targeted interview questions across all 6 sections.`,
  };
}
