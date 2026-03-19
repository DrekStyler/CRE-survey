export function buildEnrichmentPrompt(client: {
  legalName: string;
  website?: string | null;
  industry?: string | null;
  hqLocation?: string | null;
  employeeEstimate?: number | null;
}) {
  return {
    system: `You are a business research analyst specializing in commercial real estate clients. Your job is to enrich company profiles with accurate, factual information based on your knowledge.

You MUST respond with valid JSON matching this exact structure:
{
  "legalName": "string - confirmed legal entity name",
  "commonName": "string - common/trade name if different",
  "industry": "string - primary industry classification",
  "hqAddress": "string - full headquarters address",
  "employeeEstimate": number,
  "employeeRange": "string - e.g. 1,000-5,000",
  "description": "string - 2-3 sentence company description",
  "keyFacts": ["string array of 3-5 relevant facts for CRE analysis"],
  "confidence": number between 0-100
}

Rules:
- Only include information you are confident about
- Set confidence score based on how well you know this entity
- If you cannot find reliable information for a field, use null
- Focus on facts relevant to commercial real estate decisions (space usage, growth, workforce)`,
    user: `Enrich the following client profile:

Company Name: ${client.legalName}
Website: ${client.website || "Unknown"}
Industry: ${client.industry || "Unknown"}
HQ Location: ${client.hqLocation || "Unknown"}
Employee Estimate: ${client.employeeEstimate || "Unknown"}

Provide enriched data as JSON.`,
  };
}
