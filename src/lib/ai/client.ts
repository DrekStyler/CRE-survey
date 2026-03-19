import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";

let anthropicClient: Anthropic | null = null;

function getApiKey(): string {
  // process.env.ANTHROPIC_API_KEY may be empty (e.g., inherited from Claude CLI).
  // Fall back to reading .env.local directly if the system env var is empty.
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) return envKey;

  // Load from .env.local with override to get the actual value
  const result = config({ path: ".env.local", override: true });
  const key = result.parsed?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set in .env.local or environment");
  }
  return key;
}

export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: getApiKey(),
    });
  }
  return anthropicClient;
}
