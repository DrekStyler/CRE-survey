import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/ai/client";
import { buildEnrichmentPrompt } from "@/lib/ai/prompts/enrichment";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  let clientId = "";
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    clientId = body.clientId as string;
    if (!clientId) {
      return NextResponse.json({ error: "clientId required" }, { status: 400 });
    }

    // Get client
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client || client.createdBy !== userId) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Mark as in progress
    await db
      .update(clients)
      .set({ enrichmentStatus: "in_progress" })
      .where(eq(clients.id, clientId));

    const anthropic = getAnthropicClient();
    const prompt = buildEnrichmentPrompt(client);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Parse the JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const enrichmentData = JSON.parse(jsonMatch[0]);

    // Normalize confidence to 0-100 integer (API may return 0-1 or 0-100)
    let confidence = enrichmentData.confidence || 0;
    if (confidence > 0 && confidence <= 1) {
      confidence = Math.round(confidence * 100);
    } else {
      confidence = Math.round(confidence);
    }

    // Store enrichment data
    await db
      .update(clients)
      .set({
        enrichmentStatus: "completed",
        enrichmentData: JSON.stringify(enrichmentData),
        entityMatchConfidence: confidence,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId));

    return NextResponse.json({ success: true, data: enrichmentData });
  } catch (error) {
    console.error("[enrich] failed:", error);

    if (clientId) {
      try {
        await db
          .update(clients)
          .set({ enrichmentStatus: "failed" })
          .where(eq(clients.id, clientId));
      } catch {
        // ignore cleanup errors
      }
    }

    return NextResponse.json(
      { error: "Enrichment failed" },
      { status: 500 }
    );
  }
}
