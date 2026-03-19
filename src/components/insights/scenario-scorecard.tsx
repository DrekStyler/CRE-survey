"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MapPin, Check, Loader2, ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { CollapsibleSection, ReasoningText, OriginPill } from "@/components/ui/citation-badge";
import { FinancialTable } from "@/components/insights/financial-table";
import { updateScenarioProjections } from "@/app/(dashboard)/clients/[clientId]/insights/actions";
import type {
  StoredProjectionData,
  ScenarioProjectionData,
  MultiLocationProjectionData,
  LocationProjection,
  YearProjection,
} from "@/types";

type ScenarioKey = "npvOptimized" | "costOptimized" | "ebitdaOptimized";
type EditableMetric = "revenue" | "leaseCost" | "operationalCost";

const SCENARIO_CONFIG: Record<
  ScenarioKey,
  { label: string; color: string; shortLabel: string; optimizes: string }
> = {
  npvOptimized: { label: "NPV Optimized", color: "#3b82f6", shortLabel: "NPV", optimizes: "Net Present Value" },
  costOptimized: { label: "Cost Optimized", color: "#22c55e", shortLabel: "Cost", optimizes: "Lowest Occupancy Cost" },
  ebitdaOptimized: { label: "EBITDA Optimized", color: "#f59e0b", shortLabel: "EBITDA", optimizes: "Operating Income" },
};

function formatDollar(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatDollarFull(value: number): string {
  return value < 0
    ? `-$${Math.abs(value).toLocaleString()}`
    : `$${value.toLocaleString()}`;
}

function formatCostPsf(totalCost: number, sqft: number, years: number): string {
  if (!sqft || !years) return "—";
  return `$${((totalCost / sqft) / years).toFixed(0)}`;
}

function isMultiLocation(
  data: StoredProjectionData
): data is MultiLocationProjectionData {
  return "version" in data && data.version === 2;
}

function normalizeToLocations(data: StoredProjectionData): LocationProjection[] {
  if (isMultiLocation(data)) {
    return data.locations;
  }
  const legacy = data as ScenarioProjectionData;
  return [
    {
      location: {
        locationId: null,
        name: "Primary",
        city: null,
        state: null,
        locationType: null,
      },
      assumptions: legacy.assumptions,
      scenarios: legacy.scenarios,
      confidence: legacy.confidence,
    },
  ];
}

function cloneData(data: StoredProjectionData): StoredProjectionData {
  return JSON.parse(JSON.stringify(data));
}

function rebuildFromLocations(
  original: StoredProjectionData,
  locations: LocationProjection[]
): StoredProjectionData {
  if (isMultiLocation(original)) {
    return { ...original, locations };
  }
  const loc = locations[0];
  return {
    generatedAt: (original as ScenarioProjectionData).generatedAt,
    assumptions: loc.assumptions,
    scenarios: loc.scenarios,
    confidence: loc.confidence,
  };
}

// --- InlineEdit ---
function InlineEdit({
  value,
  onCommit,
  format,
  parse,
  className,
}: {
  value: number;
  onCommit: (newValue: number) => void;
  format: (v: number) => string;
  parse?: (s: string) => number;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEdit() {
    setDraft(String(value));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const parseFn = parse || parseFloat;
    const parsed = parseFn(draft);
    if (!isNaN(parsed) && parsed !== value && parsed > 0) {
      onCommit(parsed);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-24 rounded border bg-background px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className={`cursor-pointer rounded px-2 py-1 text-sm tabular-nums hover:bg-muted/60 ${className || ""}`}
    >
      {format(value)}
    </button>
  );
}

// --- Save status indicator ---
type SaveStatus = "idle" | "saving" | "saved";

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving…
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="h-3 w-3 text-green-500" />
          Saved
        </>
      )}
    </span>
  );
}

// --- Main Component ---
interface ScenarioScorecardProps {
  data: StoredProjectionData;
  clientId: string;
}

export function ScenarioScorecard({ data: initialData, clientId }: ScenarioScorecardProps) {
  const [editableData, setEditableData] = useState<StoredProjectionData>(() =>
    cloneData(initialData)
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<ScenarioKey | null>(null);

  const locations = useMemo(() => normalizeToLocations(editableData), [editableData]);
  const isMultiLoc = locations.length > 1;

  const [selectedLocationIdx, setSelectedLocationIdx] = useState(0);
  const [activeScenarios, setActiveScenarios] = useState<Set<ScenarioKey>>(
    new Set(["npvOptimized", "costOptimized", "ebitdaOptimized"])
  );

  const currentLocation = locations[selectedLocationIdx] || locations[0];
  const { scenarios, confidence, assumptions } = currentLocation;

  const hasBreakdown = useMemo(
    () =>
      Object.values(scenarios).some((s) =>
        s?.yearlyProjections?.some(
          (yr) => yr.leaseCost != null && yr.operationalCost != null
        )
      ),
    [scenarios]
  );

  // Compute scenario summaries for the comparison table
  const scenarioSummaries = useMemo(() => {
    const summaries: Record<ScenarioKey, {
      totalRevenue: number;
      totalLeaseCost: number;
      totalOpex: number;
      totalCost: number;
      totalNoi: number;
      avgAnnualNoi: number;
      yr1Noi: number;
      steadyStateNoi: number;
      costPerSqft: string;
      noiPerSqft: string;
      paybackYears: number | null;
    }> = {} as Record<ScenarioKey, ReturnType<() => typeof summaries[ScenarioKey]>>;

    for (const key of Object.keys(SCENARIO_CONFIG) as ScenarioKey[]) {
      const scenario = scenarios[key];
      if (!scenario) continue;
      const p = scenario.yearlyProjections;
      const totalRevenue = p.reduce((s, yr) => s + yr.revenue, 0);
      const totalLeaseCost = p.reduce((s, yr) => s + (yr.leaseCost ?? 0), 0);
      const totalOpex = p.reduce((s, yr) => s + (yr.operationalCost ?? 0), 0);
      const totalCost = p.reduce((s, yr) => s + yr.cost, 0);
      const totalNoi = p.reduce((s, yr) => s + yr.netProfit, 0);
      const avgAnnualNoi = p.length > 0 ? totalNoi / p.length : 0;
      const yr1Noi = p[0]?.netProfit ?? 0;
      const steadyStateNoi = p.length >= 3 ? p[p.length - 1].netProfit : yr1Noi;

      // Payback: first year where cumulative NOI > 0
      let cumulative = 0;
      let paybackYears: number | null = null;
      for (let i = 0; i < p.length; i++) {
        cumulative += p[i].netProfit;
        if (cumulative > 0 && paybackYears === null) {
          paybackYears = i + 1;
        }
      }

      summaries[key] = {
        totalRevenue,
        totalLeaseCost,
        totalOpex,
        totalCost,
        totalNoi,
        avgAnnualNoi,
        yr1Noi,
        steadyStateNoi,
        costPerSqft: formatCostPsf(totalCost, scenario.idealSqft, p.length),
        noiPerSqft: formatCostPsf(totalNoi, scenario.idealSqft, p.length),
        paybackYears,
      };
    }
    return summaries;
  }, [scenarios]);

  // Find the "recommended" scenario (highest total NOI)
  const recommendedScenario = useMemo(() => {
    let best: ScenarioKey = "npvOptimized";
    let bestNoi = -Infinity;
    for (const key of Object.keys(scenarioSummaries) as ScenarioKey[]) {
      if (scenarioSummaries[key].totalNoi > bestNoi) {
        bestNoi = scenarioSummaries[key].totalNoi;
        best = key;
      }
    }
    return best;
  }, [scenarioSummaries]);

  // Debounced auto-save
  const scheduleSave = useCallback(
    (newData: StoredProjectionData) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

      saveTimerRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          await updateScenarioProjections(clientId, newData);
          setSaveStatus("saved");
          savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
        } catch {
          setSaveStatus("idle");
        }
      }, 1000);
    },
    [clientId]
  );

  function handleProjectionChange(
    scenarioKey: ScenarioKey,
    yearIndex: number,
    field: EditableMetric,
    value: number
  ) {
    setEditableData((prev) => {
      const next = cloneData(prev);
      const nextLocations = normalizeToLocations(next);
      const loc = nextLocations[selectedLocationIdx];
      const yr = loc.scenarios[scenarioKey].yearlyProjections[yearIndex];

      if (field === "revenue") yr.revenue = value;
      else if (field === "leaseCost") yr.leaseCost = value;
      else if (field === "operationalCost") yr.operationalCost = value;

      if (!yr.sources) yr.sources = {};
      yr.sources[field] = "user";

      if (yr.leaseCost != null && yr.operationalCost != null) {
        yr.cost = yr.leaseCost + yr.operationalCost;
      }
      yr.netProfit = yr.revenue - yr.cost;

      const rebuilt = rebuildFromLocations(prev, nextLocations);
      scheduleSave(rebuilt);
      return rebuilt;
    });
  }

  // Scale all yearly projections proportionally and recalculate derived values
  function scaleProjections(
    scenario: { yearlyProjections: YearProjection[] },
    fields: { revenue?: number; leaseCost?: number; operationalCost?: number }
  ) {
    for (const yr of scenario.yearlyProjections) {
      if (fields.revenue != null) {
        yr.revenue = Math.round(yr.revenue * fields.revenue);
        if (!yr.sources) yr.sources = {};
        yr.sources.revenue = "user";
      }
      if (fields.leaseCost != null && yr.leaseCost != null) {
        yr.leaseCost = Math.round(yr.leaseCost * fields.leaseCost);
        if (!yr.sources) yr.sources = {};
        yr.sources.leaseCost = "user";
      }
      if (fields.operationalCost != null && yr.operationalCost != null) {
        yr.operationalCost = Math.round(yr.operationalCost * fields.operationalCost);
        if (!yr.sources) yr.sources = {};
        yr.sources.operationalCost = "user";
      }
      // Recalculate derived
      if (yr.leaseCost != null && yr.operationalCost != null) {
        yr.cost = yr.leaseCost + yr.operationalCost;
      }
      yr.netProfit = yr.revenue - yr.cost;
    }
  }

  // Recompute yearly growth from year 1 base using a new growth rate
  function reapplyGrowthRate(
    scenario: { yearlyProjections: YearProjection[] },
    newRate: number
  ) {
    const p = scenario.yearlyProjections;
    if (p.length < 2) return;
    const base = p[0];
    for (let i = 1; i < p.length; i++) {
      const factor = Math.pow(1 + newRate, i);
      p[i].revenue = Math.round(base.revenue * factor);
      if (base.leaseCost != null && p[i].leaseCost != null) {
        p[i].leaseCost = Math.round(base.leaseCost * Math.pow(1.03, i));
      }
      if (base.operationalCost != null && p[i].operationalCost != null) {
        p[i].operationalCost = Math.round(base.operationalCost * Math.pow(1.03, i));
      }
      if (p[i].leaseCost != null && p[i].operationalCost != null) {
        p[i].cost = p[i].leaseCost! + p[i].operationalCost!;
      }
      p[i].netProfit = p[i].revenue - p[i].cost;
      if (!p[i].sources) p[i].sources = {};
      p[i].sources!.revenue = "user";
    }
  }

  function handleScenarioParamChange(
    scenarioKey: ScenarioKey,
    param: "idealSqft" | "leaseTerm",
    value: number
  ) {
    setEditableData((prev) => {
      const next = cloneData(prev);
      const nextLocations = normalizeToLocations(next);
      const loc = nextLocations[selectedLocationIdx];
      const scenario = loc.scenarios[scenarioKey];

      if (param === "idealSqft") {
        const oldSqft = scenario.idealSqft;
        const newSqft = Math.round(value);
        if (oldSqft > 0 && newSqft !== oldSqft) {
          const ratio = newSqft / oldSqft;
          // Scale all sqft-dependent metrics proportionally
          scaleProjections(scenario, {
            revenue: ratio,
            leaseCost: ratio,
            operationalCost: ratio,
          });
        }
        scenario.idealSqft = newSqft;
      } else if (param === "leaseTerm") {
        const newTerm = Math.round(value);
        const oldTerm = scenario.yearlyProjections.length;

        if (newTerm > oldTerm) {
          const lastYear = scenario.yearlyProjections[oldTerm - 1];
          const growthRate = loc.assumptions.annualGrowthRate || 0.03;
          for (let i = oldTerm; i < newTerm; i++) {
            const factor = 1 + growthRate;
            const newYr: YearProjection = {
              year: i + 1,
              revenue: Math.round(lastYear.revenue * Math.pow(factor, i - oldTerm + 1)),
              leaseCost: lastYear.leaseCost != null
                ? Math.round(lastYear.leaseCost * Math.pow(1.03, i - oldTerm + 1))
                : undefined,
              operationalCost: lastYear.operationalCost != null
                ? Math.round(lastYear.operationalCost * Math.pow(1.03, i - oldTerm + 1))
                : undefined,
              cost: 0,
              netProfit: 0,
              sources: { revenue: "user", leaseCost: "user", operationalCost: "user" },
            };
            newYr.cost = (newYr.leaseCost ?? 0) + (newYr.operationalCost ?? 0);
            newYr.netProfit = newYr.revenue - newYr.cost;
            scenario.yearlyProjections.push(newYr);
          }
        } else if (newTerm < oldTerm && newTerm >= 1) {
          scenario.yearlyProjections = scenario.yearlyProjections.slice(0, newTerm);
        }
        scenario.leaseTerm = newTerm;
      }

      const rebuilt = rebuildFromLocations(prev, nextLocations);
      scheduleSave(rebuilt);
      return rebuilt;
    });
  }

  function handleAssumptionChange(
    field: "currentSqft" | "marketRentPsf" | "employeeCount" | "annualGrowthRate",
    value: number
  ) {
    setEditableData((prev) => {
      const next = cloneData(prev);
      const nextLocations = normalizeToLocations(next);
      const loc = nextLocations[selectedLocationIdx];

      const oldAssumptions = { ...loc.assumptions };

      if (field === "currentSqft") loc.assumptions.currentSqft = value;
      else if (field === "marketRentPsf") loc.assumptions.marketRentPsf = value;
      else if (field === "employeeCount") loc.assumptions.employeeCount = value;
      else if (field === "annualGrowthRate") loc.assumptions.annualGrowthRate = value;

      // Cascade assumption changes to all scenarios
      for (const key of ["npvOptimized", "costOptimized", "ebitdaOptimized"] as const) {
        const scenario = loc.scenarios[key];
        if (!scenario) continue;

        if (field === "marketRentPsf" && oldAssumptions.marketRentPsf && oldAssumptions.marketRentPsf > 0) {
          // Market rent directly affects lease cost
          const ratio = value / oldAssumptions.marketRentPsf;
          scaleProjections(scenario, { leaseCost: ratio });
        } else if (field === "employeeCount" && oldAssumptions.employeeCount && oldAssumptions.employeeCount > 0) {
          // Employee count affects revenue (more people = more productivity/patients)
          const ratio = value / oldAssumptions.employeeCount;
          scaleProjections(scenario, { revenue: ratio });
        } else if (field === "annualGrowthRate") {
          // Growth rate recomputes the escalation curve from year 1
          reapplyGrowthRate(scenario, value);
        }
        // currentSqft is informational — idealSqft on each scenario drives the actual scaling
      }

      const fieldLabels: Record<string, string> = {
        currentSqft: "Current Sqft",
        marketRentPsf: "Market Rent PSF",
        employeeCount: "Employee Count",
        annualGrowthRate: "Annual Growth Rate",
      };
      if (!loc.assumptions.assumptionSources) {
        loc.assumptions.assumptionSources = [];
      }
      const existing = loc.assumptions.assumptionSources.find(
        (s) => s.assumption === fieldLabels[field]
      );
      if (existing) {
        existing.source = "user";
        existing.detail = "User override";
      } else {
        loc.assumptions.assumptionSources.push({
          assumption: fieldLabels[field],
          source: "user",
          detail: "User override",
        });
      }

      const rebuilt = rebuildFromLocations(prev, nextLocations);
      scheduleSave(rebuilt);
      return rebuilt;
    });
  }

  const activeKeys = (Object.keys(SCENARIO_CONFIG) as ScenarioKey[]).filter(
    (k) => activeScenarios.has(k) && scenarios[k]
  );

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3">
          {/* Location selector */}
          {isMultiLoc && (
            <div className="flex items-center gap-2 overflow-x-auto">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              {locations.map((loc, idx) => (
                <button
                  key={loc.location.locationId ?? idx}
                  onClick={() => setSelectedLocationIdx(idx)}
                  className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
                    idx === selectedLocationIdx
                      ? "border-foreground bg-foreground text-background shadow-sm"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  }`}
                >
                  {loc.location.name}
                  {loc.location.locationType && (
                    <span className="ml-1 opacity-60">
                      ({loc.location.locationType})
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                Scenario Comparison
                {isMultiLoc && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    — {currentLocation.location.name}
                  </span>
                )}
              </CardTitle>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                Click any value to edit
                <span className="text-xs">({confidence}% confidence)</span>
                <SaveIndicator status={saveStatus} />
              </p>
            </div>
            {/* Scenario toggles */}
            <div className="flex gap-2">
              {(Object.keys(SCENARIO_CONFIG) as ScenarioKey[]).map((key) => {
                const cfg = SCENARIO_CONFIG[key];
                const isActive = activeScenarios.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setActiveScenarios((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) {
                          if (next.size > 1) next.delete(key);
                        } else {
                          next.add(key);
                        }
                        return next;
                      });
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      isActive
                        ? "text-white shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                    style={isActive ? { backgroundColor: cfg.color } : undefined}
                  >
                    {cfg.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Executive Comparison Table ── */}
        <div className="overflow-x-auto rounded-lg border">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[160px]" />
              {activeKeys.map((key) => (
                <col key={key} />
              ))}
            </colgroup>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[160px]">Metric</TableHead>
                {activeKeys.map((key) => {
                  const cfg = SCENARIO_CONFIG[key];
                  const isRecommended = key === recommendedScenario;
                  return (
                    <TableHead key={key} className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        {isRecommended && (
                          <Badge variant="default" className="gap-1 text-[10px]">
                            <Trophy className="h-2.5 w-2.5" />
                            Top
                          </Badge>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: cfg.color }}
                          />
                          <span className="font-semibold">{cfg.shortLabel}</span>
                        </div>
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Strategy */}
              <TableRow>
                <TableCell className="text-xs font-medium text-muted-foreground">Strategy</TableCell>
                {activeKeys.map((key) => (
                  <TableCell key={key} className="text-center text-xs text-muted-foreground">
                    {SCENARIO_CONFIG[key].optimizes}
                  </TableCell>
                ))}
              </TableRow>

              {/* Space & Term */}
              <TableRow className="border-t">
                <TableCell className="text-sm font-medium">Lease Size</TableCell>
                {activeKeys.map((key) => (
                  <TableCell key={key} className="text-center">
                    <InlineEdit
                      value={scenarios[key].idealSqft}
                      onCommit={(v) => handleScenarioParamChange(key, "idealSqft", v)}
                      format={(v) => `${v.toLocaleString()} SF`}
                      parse={(s) => parseInt(s, 10)}
                      className="font-medium"
                    />
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="text-sm font-medium">Lease Term</TableCell>
                {activeKeys.map((key) => (
                  <TableCell key={key} className="text-center">
                    <InlineEdit
                      value={scenarios[key].leaseTerm}
                      onCommit={(v) => handleScenarioParamChange(key, "leaseTerm", v)}
                      format={(v) => `${v} years`}
                      parse={(s) => parseInt(s, 10)}
                      className="font-medium"
                    />
                  </TableCell>
                ))}
              </TableRow>

              {/* Financial Summary */}
              <TableRow className="border-t bg-muted/10">
                <TableCell className="text-sm font-medium">Total Revenue</TableCell>
                {activeKeys.map((key) => (
                  <TableCell key={key} className="text-center text-sm font-medium tabular-nums text-green-600 dark:text-green-400">
                    {formatDollar(scenarioSummaries[key].totalRevenue)}
                  </TableCell>
                ))}
              </TableRow>
              {hasBreakdown && (
                <>
                  <TableRow className="bg-muted/10">
                    <TableCell className="pl-6 text-sm text-muted-foreground">Lease Cost</TableCell>
                    {activeKeys.map((key) => (
                      <TableCell key={key} className="text-center text-sm tabular-nums text-destructive">
                        ({formatDollar(scenarioSummaries[key].totalLeaseCost)})
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow className="bg-muted/10">
                    <TableCell className="pl-6 text-sm text-muted-foreground">Operating Expenses</TableCell>
                    {activeKeys.map((key) => (
                      <TableCell key={key} className="text-center text-sm tabular-nums text-destructive">
                        ({formatDollar(scenarioSummaries[key].totalOpex)})
                      </TableCell>
                    ))}
                  </TableRow>
                </>
              )}
              <TableRow className="border-t bg-muted/20">
                <TableCell className="text-sm font-bold">Total NOI</TableCell>
                {activeKeys.map((key) => {
                  const isTop = key === recommendedScenario;
                  return (
                    <TableCell key={key} className={`text-center text-sm font-bold tabular-nums ${isTop ? "text-foreground" : ""}`}>
                      {formatDollar(scenarioSummaries[key].totalNoi)}
                    </TableCell>
                  );
                })}
              </TableRow>

              {/* Key Ratios */}
              <TableRow className="border-t">
                <TableCell className="text-sm font-medium">Avg Annual NOI</TableCell>
                {activeKeys.map((key) => (
                  <TableCell key={key} className="text-center text-sm font-medium tabular-nums">
                    {formatDollar(scenarioSummaries[key].avgAnnualNoi)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="text-sm font-medium">Year 1 NOI</TableCell>
                {activeKeys.map((key) => (
                  <TableCell key={key} className="text-center text-sm tabular-nums">
                    {formatDollar(scenarioSummaries[key].yr1Noi)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="text-sm font-medium">Steady-State NOI</TableCell>
                {activeKeys.map((key) => (
                  <TableCell key={key} className="text-center text-sm tabular-nums">
                    {formatDollar(scenarioSummaries[key].steadyStateNoi)}
                    <span className="ml-1 text-xs text-muted-foreground">/yr</span>
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="text-sm font-medium">Cost / SF / Year</TableCell>
                {activeKeys.map((key) => (
                  <TableCell key={key} className="text-center text-sm tabular-nums">
                    {scenarioSummaries[key].costPerSqft}
                  </TableCell>
                ))}
              </TableRow>

              {/* Reasoning toggle */}
              <TableRow className="border-t">
                <TableCell className="text-xs font-medium text-muted-foreground">Rationale</TableCell>
                {activeKeys.map((key) => (
                  <TableCell key={key} className="text-center">
                    <button
                      type="button"
                      onClick={() => setExpandedReasoning((prev) => (prev === key ? null : key))}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {expandedReasoning === key ? (
                        <>Hide <ChevronUp className="h-3 w-3" /></>
                      ) : (
                        <>Show <ChevronDown className="h-3 w-3" /></>
                      )}
                    </button>
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Reasoning expansion */}
        {expandedReasoning && scenarios[expandedReasoning] && (
          <div className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: SCENARIO_CONFIG[expandedReasoning].color }}
              />
              <h4 className="text-sm font-semibold">
                {SCENARIO_CONFIG[expandedReasoning].label} — Rationale
              </h4>
            </div>
            <p className="text-sm text-muted-foreground">
              {scenarios[expandedReasoning].description}
            </p>
            {scenarios[expandedReasoning].reasoning && (
              <p className="mt-2 text-sm text-muted-foreground">
                {scenarios[expandedReasoning].reasoning}
              </p>
            )}
          </div>
        )}

        {/* ── Year-by-Year Financial Detail (always visible) ── */}
        <FinancialTable
          scenarios={scenarios}
          activeScenarios={activeScenarios}
          hasBreakdown={hasBreakdown}
          onProjectionChange={handleProjectionChange}
          clientId={clientId}
        />

        {/* ── Assumptions ── */}
        <AssumptionsPanel
          assumptions={assumptions}
          onAssumptionChange={handleAssumptionChange}
          clientId={clientId}
        />
      </CardContent>
    </Card>
  );
}

// --- Source pill that links to the data page ---
const SOURCE_LINKS: Record<string, string> = {
  broker_interview: "broker-interview",
  research: "research",
  client_interview: "client-interview",
};

function LinkedOriginPill({
  source,
  clientId,
  className,
}: {
  source: string;
  clientId: string;
  className?: string;
}) {
  const route = SOURCE_LINKS[source];
  if (route) {
    return (
      <Link href={`/clients/${clientId}/${route}`}>
        <OriginPill source={source} className={`cursor-pointer hover:opacity-80 ${className || ""}`} />
      </Link>
    );
  }
  return <OriginPill source={source} className={className} />;
}

// --- Assumptions Panel ---
function AssumptionsPanel({
  assumptions,
  onAssumptionChange,
  clientId,
}: {
  assumptions: ScenarioProjectionData["assumptions"];
  onAssumptionChange: (
    field: "currentSqft" | "marketRentPsf" | "employeeCount" | "annualGrowthRate",
    value: number
  ) => void;
  clientId: string;
}) {
  const hasReasoning =
    assumptions.currentSqftReasoning ||
    assumptions.marketRentPsfReasoning ||
    assumptions.employeeCountReasoning ||
    assumptions.annualGrowthRateReasoning;

  const hasSources =
    assumptions.assumptionSources && assumptions.assumptionSources.length > 0;

  if (!hasReasoning && !hasSources) return null;

  function getSource(label: string): string | undefined {
    return assumptions.assumptionSources?.find(
      (s) => s.assumption.toLowerCase().includes(label.toLowerCase())
    )?.source;
  }

  const rows: {
    label: string;
    field: "currentSqft" | "marketRentPsf" | "employeeCount" | "annualGrowthRate";
    value: number | null;
    displayValue: string;
    format: (v: number) => string;
    reasoning?: string;
    source?: string;
  }[] = [
    {
      label: "Current Sqft",
      field: "currentSqft",
      value: assumptions.currentSqft,
      displayValue: assumptions.currentSqft?.toLocaleString() ?? "Unknown",
      format: (v) => v.toLocaleString(),
      reasoning: assumptions.currentSqftReasoning,
      source: getSource("sqft"),
    },
    {
      label: "Market Rent (PSF)",
      field: "marketRentPsf",
      value: assumptions.marketRentPsf,
      displayValue: assumptions.marketRentPsf != null ? `$${assumptions.marketRentPsf}` : "Unknown",
      format: (v) => `$${v}`,
      reasoning: assumptions.marketRentPsfReasoning,
      source: getSource("rent"),
    },
    {
      label: "Employee Count",
      field: "employeeCount",
      value: assumptions.employeeCount,
      displayValue: assumptions.employeeCount?.toLocaleString() ?? "Unknown",
      format: (v) => v.toLocaleString(),
      reasoning: assumptions.employeeCountReasoning,
      source: getSource("employee"),
    },
    {
      label: "Annual Growth Rate",
      field: "annualGrowthRate",
      value: assumptions.annualGrowthRate,
      displayValue: `${(assumptions.annualGrowthRate * 100).toFixed(1)}%`,
      format: (v) => `${(v * 100).toFixed(1)}%`,
      reasoning: assumptions.annualGrowthRateReasoning,
      source: getSource("growth"),
    },
  ];

  return (
    <CollapsibleSection title="Assumptions & Sources" defaultOpen className="mt-0">
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded border px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium">
                {row.label}
                {row.source && (
                  <LinkedOriginPill source={row.source} clientId={clientId} />
                )}
              </span>
              {row.value != null ? (
                <InlineEdit
                  value={row.value}
                  onCommit={(v) => onAssumptionChange(row.field, v)}
                  format={row.format}
                  className="font-semibold"
                />
              ) : (
                <span className="text-xs font-semibold">{row.displayValue}</span>
              )}
            </div>
            {row.reasoning && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {row.reasoning}
              </p>
            )}
          </div>
        ))}
      </div>
      {hasSources && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            Data Sources
          </p>
          <div className="space-y-1">
            {assumptions.assumptionSources!.map((src, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-[11px] text-muted-foreground"
              >
                <LinkedOriginPill source={src.source} clientId={clientId} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium">{src.assumption}:</span>{" "}
                  {src.detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}
