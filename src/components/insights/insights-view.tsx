"use client";

import { useState } from "react";
import {
  generateInsights,
  generateScenarioProjections,
  updateHypothesisStatus,
} from "@/app/(dashboard)/clients/[clientId]/insights/actions";
import { ScenarioScorecard } from "@/components/insights/scenario-scorecard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Lightbulb, TrendingUp, DollarSign, Cog, MapPin, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { SourceLink, OriginPill } from "@/components/ui/citation-badge";
import type { Driver } from "@/lib/db/schema/drivers";
import type { Hypothesis } from "@/lib/db/schema/hypotheses";
import type { ResearchFinding } from "@/lib/db/schema/research-findings";
import type { SupportingEvidence, StoredProjectionData } from "@/types";

interface InsightsViewProps {
  clientId: string;
  drivers: Driver[];
  hypotheses: Hypothesis[];
  scenarioProjections: StoredProjectionData | null;
  findings?: ResearchFinding[];
}

const DRIVER_CONFIG = {
  revenue: { label: "Revenue Drivers", icon: TrendingUp, color: "text-green-600" },
  cost: { label: "Cost Drivers", icon: DollarSign, color: "text-red-600" },
  operational: { label: "Operational Drivers", icon: Cog, color: "text-blue-600" },
  space: { label: "Space Drivers", icon: MapPin, color: "text-purple-600" },
};

export function InsightsView({
  clientId,
  drivers: initialDrivers,
  hypotheses: initialHypotheses,
  scenarioProjections,
  findings = [],
}: InsightsViewProps) {
  const findingsMap = new Map(findings.map((f) => [f.id, f]));
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingProjections, setIsGeneratingProjections] = useState(false);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const result = await generateInsights(clientId);
      toast.success(
        `Generated ${result.driversCount} drivers, updated ${result.updatesCount} hypotheses`
      );
      router.refresh();
    } catch {
      toast.error("Failed to generate insights");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerateProjections() {
    setIsGeneratingProjections(true);
    try {
      await generateScenarioProjections(clientId);
      toast.success("Scenario projections generated");
      router.refresh();
    } catch {
      toast.error("Failed to generate projections");
    } finally {
      setIsGeneratingProjections(false);
    }
  }

  async function handleStatusChange(
    hypothesisId: string,
    status: "proposed" | "confirmed" | "rejected"
  ) {
    try {
      await updateHypothesisStatus(hypothesisId, status);
      router.refresh();
    } catch {
      toast.error("Failed to update");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end gap-3">
        <Button onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Lightbulb className="mr-2 h-4 w-4" />
          )}
          {initialDrivers.length > 0 ? "Regenerate Insights" : "Generate Insights"}
        </Button>
        <Button
          onClick={handleGenerateProjections}
          disabled={isGeneratingProjections}
          variant="outline"
        >
          {isGeneratingProjections ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <BarChart3 className="mr-2 h-4 w-4" />
          )}
          {scenarioProjections ? "Regenerate Projections" : "Generate Projections"}
        </Button>
      </div>

      {/* Scenario Projections Chart */}
      {scenarioProjections && <ScenarioScorecard data={scenarioProjections} clientId={clientId} />}

      {initialDrivers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <Lightbulb className="h-8 w-8 text-muted-foreground" />
            <div>
              <h3 className="font-medium">No insights yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Generate AI-powered insights from all collected data to identify
                key revenue, cost, operational, and space drivers.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {(Object.keys(DRIVER_CONFIG) as Array<keyof typeof DRIVER_CONFIG>).map(
            (type) => {
              const config = DRIVER_CONFIG[type];
              const typeDrivers = initialDrivers.filter(
                (d) => d.type === type
              );

              return (
                <div key={type}>
                  <div className="mb-3 flex items-center gap-2">
                    <config.icon className={`h-5 w-5 ${config.color}`} />
                    <h3 className="font-semibold">{config.label}</h3>
                    <Badge variant="outline">{typeDrivers.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {typeDrivers.map((driver) => (
                      <Card key={driver.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <h4 className="font-medium">{driver.title}</h4>
                            <Badge
                              variant={
                                driver.impact === "high"
                                  ? "default"
                                  : driver.impact === "medium"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {driver.impact}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {driver.description}
                          </p>
                          {driver.supportingEvidence ? (
                            <div className="mt-2 space-y-1">
                              {(
                                driver.supportingEvidence as SupportingEvidence[]
                              ).map((e, i) => {
                                const linkedFinding = e.findingId ? findingsMap.get(e.findingId) : null;
                                return (
                                  <div
                                    key={i}
                                    className="rounded bg-muted/50 px-2 py-1 text-xs"
                                  >
                                    {linkedFinding ? (
                                      <SourceLink
                                        sourceName={linkedFinding.sourceName || e.source}
                                        sourceUrl={linkedFinding.sourceUrl}
                                        confidence={linkedFinding.confidence}
                                        className="font-medium"
                                      />
                                    ) : (
                                      <span className="font-medium">
                                        {e.source}:
                                      </span>
                                    )}{" "}
                                    {e.quote}
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    ))}
                    {typeDrivers.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No {type} drivers identified
                      </p>
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      {/* Hypothesis Panel */}
      {initialHypotheses.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">Hypothesis Panel</h3>
          <div className="space-y-3">
            {initialHypotheses.map((h) => (
              <Card key={h.id}>
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{h.type}</Badge>
                      {h.source && <OriginPill source={h.source} />}
                      {h.confidenceScore != null && (
                        <Badge variant="secondary" className="text-[10px]">
                          {h.confidenceScore}%
                        </Badge>
                      )}
                      <Select
                        defaultValue={h.status}
                        onValueChange={(value) =>
                          handleStatusChange(
                            h.id,
                            value as "proposed" | "confirmed" | "rejected"
                          )
                        }
                      >
                        <SelectTrigger className="h-7 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="proposed">Proposed</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-sm">{h.statement}</p>
                    {h.scoringReasoning && (
                      <p className="text-xs text-muted-foreground">
                        {h.scoringReasoning}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <DimensionBar
                      label="EBITDA"
                      value={h.dimensionScoreEbitda}
                    />
                    <DimensionBar label="NPV" value={h.dimensionScoreNpv} />
                    <DimensionBar
                      label="Cost"
                      value={h.dimensionScoreCost}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DimensionBar({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  if (value === null || value === undefined) return null;

  let bgColor = "bg-red-500";
  if (value >= 76) bgColor = "bg-blue-500";
  else if (value >= 51) bgColor = "bg-green-500";
  else if (value >= 26) bgColor = "bg-yellow-500";

  return (
    <div className="w-16 space-y-1">
      <div className="text-center text-[10px] font-medium text-muted-foreground">
        {label}
      </div>
      <div className="h-16 rounded bg-muted">
        <div
          className={`rounded ${bgColor} transition-all`}
          style={{
            height: `${value}%`,
            marginTop: `${100 - value}%`,
          }}
        />
      </div>
      <div className="text-center text-xs font-semibold">{value}</div>
    </div>
  );
}
