"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Check, RotateCcw } from "lucide-react";
import { updateClient } from "@/app/(dashboard)/clients/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { Client } from "@/lib/db/schema/clients";

interface EnrichmentReviewProps {
  client: Client;
}

interface EnrichmentData {
  legalName?: string;
  commonName?: string;
  industry?: string;
  hqAddress?: string;
  employeeEstimate?: number;
  employeeRange?: string;
  description?: string;
  keyFacts?: string[];
  confidence?: number;
}

export function EnrichmentReview({ client }: EnrichmentReviewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEnriching, setIsEnriching] = useState(false);

  const enrichmentData: EnrichmentData | null = client.enrichmentData
    ? JSON.parse(client.enrichmentData)
    : null;

  async function triggerEnrichment() {
    setIsEnriching(true);
    try {
      const res = await fetch("/api/ai/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id }),
      });

      if (!res.ok) throw new Error("Enrichment failed");

      router.refresh();
      toast.success("Enrichment complete");
    } catch {
      toast.error("Enrichment failed. Please try again.");
    } finally {
      setIsEnriching(false);
    }
  }

  function confirmEnrichment() {
    if (!enrichmentData) return;
    startTransition(async () => {
      try {
        await updateClient(client.id, {
          confirmedByBroker: true,
          commonName: enrichmentData.commonName || client.commonName || undefined,
          industry: enrichmentData.industry || client.industry || undefined,
          hqLocation: enrichmentData.hqAddress || client.hqLocation || undefined,
          employeeEstimate: enrichmentData.employeeEstimate || client.employeeEstimate || undefined,
        });
        toast.success("Client data confirmed");
        router.refresh();
      } catch {
        toast.error("Failed to confirm");
      }
    });
  }

  if (client.enrichmentStatus === "pending" || client.enrichmentStatus === "failed") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <Sparkles className="h-8 w-8 text-muted-foreground" />
          <div className="text-center">
            <h3 className="font-medium">AI Enrichment Available</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Let AI enrich this client profile with additional data.
            </p>
          </div>
          {client.enrichmentStatus === "failed" && (
            <Badge variant="destructive">Previous enrichment failed</Badge>
          )}
          <Button onClick={triggerEnrichment} disabled={isEnriching}>
            {isEnriching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {isEnriching ? "Enriching..." : "Run Enrichment"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (client.enrichmentStatus === "in_progress") {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-3 p-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p>Enriching client data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!enrichmentData) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Enrichment Results
          </CardTitle>
          <Badge variant="outline">
            {enrichmentData.confidence}% confidence
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {enrichmentData.description && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Description
            </p>
            <p className="mt-1 text-sm">{enrichmentData.description}</p>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <EnrichmentField
            label="Legal Name"
            original={client.legalName}
            enriched={enrichmentData.legalName}
          />
          <EnrichmentField
            label="Common Name"
            original={client.commonName}
            enriched={enrichmentData.commonName}
          />
          <EnrichmentField
            label="Industry"
            original={client.industry}
            enriched={enrichmentData.industry}
          />
          <EnrichmentField
            label="HQ Location"
            original={client.hqLocation}
            enriched={enrichmentData.hqAddress}
          />
          <EnrichmentField
            label="Employees"
            original={client.employeeEstimate?.toString()}
            enriched={
              enrichmentData.employeeRange ||
              enrichmentData.employeeEstimate?.toString()
            }
          />
        </div>

        {enrichmentData.keyFacts && enrichmentData.keyFacts.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Key Facts
            </p>
            <ul className="mt-1 space-y-1">
              {enrichmentData.keyFacts.map((fact, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  - {fact}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!client.confirmedByBroker && (
          <div className="flex gap-3 pt-2">
            <Button onClick={confirmEnrichment} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Confirm & Apply
            </Button>
            <Button
              variant="outline"
              onClick={triggerEnrichment}
              disabled={isEnriching}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Re-run
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EnrichmentField({
  label,
  original,
  enriched,
}: {
  label: string;
  original?: string | null;
  enriched?: string | null;
}) {
  const hasChange = enriched && enriched !== original;

  return (
    <div className="rounded-md border p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1">
        {hasChange ? (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground line-through">
              {original || "Not set"}
            </p>
            <p className="text-sm font-medium text-green-600">{enriched}</p>
          </div>
        ) : (
          <p className="text-sm">{original || enriched || "Not set"}</p>
        )}
      </div>
    </div>
  );
}
