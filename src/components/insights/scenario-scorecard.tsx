"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  ComposedChart,
  Line,
  LineChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Clock, MapPin, X, Check, Loader2 } from "lucide-react";
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
type MetricKey = "revenue" | "leaseCost" | "operationalCost" | "netProfit";
type EditableMetric = "revenue" | "leaseCost" | "operationalCost";

const SCENARIO_CONFIG: Record<
  ScenarioKey,
  { label: string; color: string; shortLabel: string }
> = {
  npvOptimized: { label: "NPV Optimized", color: "#3b82f6", shortLabel: "NPV" },
  costOptimized: { label: "Cost Optimized", color: "#22c55e", shortLabel: "Cost" },
  ebitdaOptimized: { label: "EBITDA Optimized", color: "#f59e0b", shortLabel: "EBITDA" },
};

const METRIC_CONFIG: Record<
  MetricKey,
  { label: string; color: string }
> = {
  revenue: { label: "Revenue", color: "#22c55e" },
  leaseCost: { label: "Lease Cost", color: "#ef4444" },
  operationalCost: { label: "OpEx", color: "#f59e0b" },
  netProfit: { label: "NOI", color: "#3b82f6" },
};

const LEGACY_COST_METRIC = { label: "Total Cost", color: "#ef4444" };

function formatDollar(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
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

// Deep clone helper
function cloneData(data: StoredProjectionData): StoredProjectionData {
  return JSON.parse(JSON.stringify(data));
}

// Rebuild StoredProjectionData from locations
function rebuildFromLocations(
  original: StoredProjectionData,
  locations: LocationProjection[]
): StoredProjectionData {
  if (isMultiLocation(original)) {
    return { ...original, locations };
  }
  // Single-location: unwrap
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
        className="w-20 rounded border bg-background px-1 py-0.5 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className={`cursor-pointer rounded px-1 py-0.5 text-xs tabular-nums hover:bg-muted/60 ${className || ""}`}
    >
      {format(value)}
    </button>
  );
}

// --- Sparkline ---
function Sparkline({
  data,
  color,
  height = 40,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
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
  // Editable local state
  const [editableData, setEditableData] = useState<StoredProjectionData>(() =>
    cloneData(initialData)
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const locations = useMemo(() => normalizeToLocations(editableData), [editableData]);
  const isMultiLoc = locations.length > 1;

  const [selectedLocationIdx, setSelectedLocationIdx] = useState(0);
  const [activeScenarios, setActiveScenarios] = useState<Set<ScenarioKey>>(
    new Set(["npvOptimized", "costOptimized", "ebitdaOptimized"])
  );
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | "cost" | null>(null);

  const currentLocation = locations[selectedLocationIdx] || locations[0];
  const { scenarios, confidence, assumptions } = currentLocation;
  const bandPct = useMemo(() => (100 - confidence) / 200, [confidence]);

  const hasBreakdown = useMemo(
    () =>
      Object.values(scenarios).some((s) =>
        s?.yearlyProjections?.some(
          (yr) => yr.leaseCost != null && yr.operationalCost != null
        )
      ),
    [scenarios]
  );

  const metricKeys: (MetricKey | "cost")[] = hasBreakdown
    ? ["revenue", "leaseCost", "operationalCost", "netProfit"]
    : ["revenue", "cost" as const, "netProfit"];

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

  // Update a single projection value and recalculate derived fields
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

      // Update the field
      if (field === "revenue") yr.revenue = value;
      else if (field === "leaseCost") yr.leaseCost = value;
      else if (field === "operationalCost") yr.operationalCost = value;

      // Mark source as user
      if (!yr.sources) yr.sources = {};
      yr.sources[field] = "user";

      // Recalculate derived values
      if (yr.leaseCost != null && yr.operationalCost != null) {
        yr.cost = yr.leaseCost + yr.operationalCost;
      }
      yr.netProfit = yr.revenue - yr.cost;

      const rebuilt = rebuildFromLocations(prev, nextLocations);
      scheduleSave(rebuilt);
      return rebuilt;
    });
  }

  // Update scenario params (idealSqft, leaseTerm)
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
        scenario.idealSqft = Math.round(value);
      } else if (param === "leaseTerm") {
        const newTerm = Math.round(value);
        const oldTerm = scenario.yearlyProjections.length;

        if (newTerm > oldTerm) {
          // Extend: extrapolate from last year using growth rate
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

  // Update assumption values
  function handleAssumptionChange(
    field: "currentSqft" | "marketRentPsf" | "employeeCount" | "annualGrowthRate",
    value: number
  ) {
    setEditableData((prev) => {
      const next = cloneData(prev);
      const nextLocations = normalizeToLocations(next);
      const loc = nextLocations[selectedLocationIdx];

      if (field === "currentSqft") loc.assumptions.currentSqft = value;
      else if (field === "marketRentPsf") loc.assumptions.marketRentPsf = value;
      else if (field === "employeeCount") loc.assumptions.employeeCount = value;
      else if (field === "annualGrowthRate") loc.assumptions.annualGrowthRate = value;

      // Track user edit in assumptionSources
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

  function toggleScenario(key: ScenarioKey) {
    setActiveScenarios((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleSparklineClick(metric: MetricKey | "cost") {
    setSelectedMetric((prev) => (prev === metric ? null : metric));
  }

  // Build focus chart data
  const focusChartData = useMemo(() => {
    if (!selectedMetric) return [];
    const maxYears = Math.max(
      ...Object.keys(SCENARIO_CONFIG).map((key) => {
        const scenario = scenarios[key as ScenarioKey];
        return scenario?.yearlyProjections?.length || 0;
      })
    );
    return Array.from({ length: maxYears }, (_, i) => {
      const point: Record<string, number | null> = { year: i + 1 };
      for (const key of Object.keys(SCENARIO_CONFIG) as ScenarioKey[]) {
        const proj = scenarios[key]?.yearlyProjections?.[i];
        if (proj) {
          const fieldKey = selectedMetric === "cost" ? "cost" : selectedMetric;
          point[key] = proj[fieldKey as keyof typeof proj] as number ?? null;
          const val = point[key];
          if (val != null) {
            point[`${key}_upper`] = val * (1 + bandPct);
            point[`${key}_lower`] = val * (1 - bandPct);
          }
        } else {
          point[key] = null;
          point[`${key}_upper`] = null;
          point[`${key}_lower`] = null;
        }
      }
      return point;
    });
  }, [selectedMetric, scenarios, bandPct]);

  const focusMetricLabel =
    selectedMetric === "cost"
      ? LEGACY_COST_METRIC.label
      : selectedMetric
        ? METRIC_CONFIG[selectedMetric].label
        : "";

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
                Scenario Projections
                {isMultiLoc && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    — {currentLocation.location.name}
                  </span>
                )}
              </CardTitle>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                Click a metric sparkline to compare across scenarios{" "}
                <span className="text-xs">({confidence}% confidence)</span>
                <SaveIndicator status={saveStatus} />
              </p>
            </div>
            {/* Scenario pills */}
            <div className="flex gap-2">
              {(Object.keys(SCENARIO_CONFIG) as ScenarioKey[]).map((key) => {
                const cfg = SCENARIO_CONFIG[key];
                const isActive = activeScenarios.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleScenario(key)}
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

      <CardContent>
        {/* Scorecard grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {(Object.keys(SCENARIO_CONFIG) as ScenarioKey[]).map((key) => {
            if (!activeScenarios.has(key)) return null;
            const cfg = SCENARIO_CONFIG[key];
            const scenario = scenarios[key];
            if (!scenario) return null;

            const projections = scenario.yearlyProjections;
            const lastYear = projections[projections.length - 1];

            return (
              <div
                key={key}
                className="rounded-lg border p-4"
                style={{ borderColor: cfg.color, borderWidth: 2 }}
              >
                {/* Card header */}
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span className="text-sm font-semibold">{cfg.label}</span>
                </div>

                {/* Sparkline rows */}
                <div className="space-y-1">
                  {metricKeys.map((metric) => {
                    const isNoi = metric === "netProfit";
                    const metricCfg =
                      metric === "cost"
                        ? LEGACY_COST_METRIC
                        : METRIC_CONFIG[metric as MetricKey];
                    const sparkData = projections.map((p) => {
                      if (metric === "cost") return p.cost;
                      return (p[metric as keyof typeof p] as number) ?? 0;
                    });
                    const finalValue = lastYear
                      ? metric === "cost"
                        ? lastYear.cost
                        : (lastYear[metric as keyof typeof lastYear] as number) ?? 0
                      : 0;
                    const isSelected = selectedMetric === metric;
                    const isCostType = metric === "leaseCost" || metric === "operationalCost" || metric === "cost";

                    // Source pill on sparkline label
                    const metricSource =
                      metric !== "cost" && metric !== "netProfit"
                        ? projections[0]?.sources?.[metric as EditableMetric]
                        : undefined;

                    return (
                      <button
                        key={metric}
                        type="button"
                        onClick={() => handleSparklineClick(metric)}
                        className={`flex w-full items-center gap-3 rounded px-2 py-1 text-left transition-colors hover:bg-muted/50 ${
                          isSelected ? "bg-muted/70 ring-1 ring-muted-foreground/20" : ""
                        }`}
                      >
                        <span
                          className={`flex w-14 shrink-0 items-center gap-1 text-xs ${
                            isNoi ? "font-bold" : "text-muted-foreground"
                          } ${isSelected ? "underline decoration-1 underline-offset-2" : ""}`}
                        >
                          {metricCfg.label}
                          {metricSource && (
                            <span
                              className={`inline-block h-1.5 w-1.5 rounded-full ${
                                metricSource === "user"
                                  ? "bg-gray-400"
                                  : metricSource === "broker_interview"
                                    ? "bg-blue-400"
                                    : metricSource === "research"
                                      ? "bg-emerald-400"
                                      : "bg-amber-400"
                              }`}
                              title={metricSource}
                            />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <Sparkline data={sparkData} color={metricCfg.color} height={32} />
                        </div>
                        <span
                          className={`w-16 shrink-0 text-right text-xs tabular-nums ${
                            isNoi ? "font-bold" : ""
                          } ${isCostType ? "text-destructive" : ""}`}
                        >
                          {isCostType && finalValue > 0
                            ? `(${formatDollar(finalValue)})`
                            : formatDollar(finalValue)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Card footer — editable sqft & lease term */}
                <div className="mt-3 flex items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    <InlineEdit
                      value={scenario.idealSqft}
                      onCommit={(v) => handleScenarioParamChange(key, "idealSqft", v)}
                      format={(v) => `${v.toLocaleString()} sqft`}
                      parse={(s) => parseInt(s, 10)}
                    />
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <InlineEdit
                      value={scenario.leaseTerm}
                      onCommit={(v) => handleScenarioParamChange(key, "leaseTerm", v)}
                      format={(v) => `${v} yr`}
                      parse={(s) => parseInt(s, 10)}
                    />
                  </span>
                  <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                    {confidence}% conf
                  </span>
                </div>

                {/* Description + reasoning */}
                <p className="mt-2 text-xs text-muted-foreground">
                  {scenario.description}
                </p>
                {scenario.reasoning && (
                  <ReasoningText text={scenario.reasoning} className="mt-2" />
                )}
              </div>
            );
          })}
        </div>

        {/* Focus chart */}
        {selectedMetric && focusChartData.length > 0 && (
          <div className="mt-6 rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {focusMetricLabel} — Scenario Comparison
              </h3>
              <button
                type="button"
                onClick={() => setSelectedMetric(null)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={focusChartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="year"
                  tickFormatter={(v) => `Yr ${v}`}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={formatDollar}
                  tick={{ fontSize: 12 }}
                  width={70}
                />
                <Tooltip content={<FocusTooltip activeScenarios={activeScenarios} metricLabel={focusMetricLabel} />} />
                {(Object.keys(SCENARIO_CONFIG) as ScenarioKey[]).map((key) => {
                  if (!activeScenarios.has(key)) return null;
                  const cfg = SCENARIO_CONFIG[key];
                  return (
                    <Area
                      key={`${key}_band`}
                      dataKey={`${key}_upper`}
                      stroke="none"
                      fill={cfg.color}
                      fillOpacity={0.08}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  );
                })}
                {(Object.keys(SCENARIO_CONFIG) as ScenarioKey[]).map((key) => {
                  if (!activeScenarios.has(key)) return null;
                  return (
                    <Area
                      key={`${key}_lower`}
                      dataKey={`${key}_lower`}
                      stroke="none"
                      fill="#ffffff"
                      fillOpacity={1}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  );
                })}
                {(Object.keys(SCENARIO_CONFIG) as ScenarioKey[]).map((key) => {
                  if (!activeScenarios.has(key)) return null;
                  const cfg = SCENARIO_CONFIG[key];
                  return (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={cfg.color}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: cfg.color }}
                      connectNulls={false}
                      name={cfg.label}
                    />
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Financial table — now with editing */}
        <FinancialTable
          scenarios={scenarios}
          activeScenarios={activeScenarios}
          hasBreakdown={hasBreakdown}
          onProjectionChange={handleProjectionChange}
        />

        {/* Assumptions panel */}
        <AssumptionsPanel
          assumptions={assumptions}
          onAssumptionChange={handleAssumptionChange}
        />
      </CardContent>
    </Card>
  );
}

// --- Focus chart tooltip ---
function FocusTooltip({
  active,
  payload,
  label,
  activeScenarios,
  metricLabel,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: number;
  activeScenarios: Set<ScenarioKey>;
  metricLabel: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg">
      <p className="mb-2 text-sm font-semibold">
        Year {label} — {metricLabel}
      </p>
      <div className="space-y-1">
        {(Object.keys(SCENARIO_CONFIG) as ScenarioKey[]).map((key) => {
          if (!activeScenarios.has(key)) return null;
          const cfg = SCENARIO_CONFIG[key];
          const entry = payload.find((p) => p.dataKey === key);
          if (!entry || entry.value == null) return null;
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: cfg.color }}
                />
                <span className="text-xs text-muted-foreground">
                  {cfg.shortLabel}
                </span>
              </div>
              <span className="text-xs font-medium">{formatDollar(entry.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Assumptions Panel ---
function AssumptionsPanel({
  assumptions,
  onAssumptionChange,
}: {
  assumptions: ScenarioProjectionData["assumptions"];
  onAssumptionChange: (
    field: "currentSqft" | "marketRentPsf" | "employeeCount" | "annualGrowthRate",
    value: number
  ) => void;
}) {
  const hasReasoning =
    assumptions.currentSqftReasoning ||
    assumptions.marketRentPsfReasoning ||
    assumptions.employeeCountReasoning ||
    assumptions.annualGrowthRateReasoning;

  const hasSources =
    assumptions.assumptionSources && assumptions.assumptionSources.length > 0;

  if (!hasReasoning && !hasSources) return null;

  // Find source for a given assumption label
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
    <CollapsibleSection title="Assumptions & Sources" className="mt-4">
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded border px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium">
                {row.label}
                {row.source && <OriginPill source={row.source} />}
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
                <OriginPill source={src.source} className="mt-0.5 shrink-0" />
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
