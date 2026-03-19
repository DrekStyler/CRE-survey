"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Clock, TrendingUp, MapPin } from "lucide-react";
import { CollapsibleSection, ReasoningText, OriginPill } from "@/components/ui/citation-badge";
import type {
  StoredProjectionData,
  ScenarioProjectionData,
  MultiLocationProjectionData,
  LocationProjection,
  AssumptionSource,
} from "@/types";

type ScenarioKey = "npvOptimized" | "costOptimized" | "ebitdaOptimized";

const SCENARIO_CONFIG: Record<
  ScenarioKey,
  { label: string; color: string; shortLabel: string }
> = {
  npvOptimized: { label: "NPV Optimized", color: "#3b82f6", shortLabel: "NPV" },
  costOptimized: { label: "Cost Optimized", color: "#22c55e", shortLabel: "Cost" },
  ebitdaOptimized: { label: "EBITDA Optimized", color: "#f59e0b", shortLabel: "EBITDA" },
};

const SINGLE_COLORS = {
  revenue: "#22c55e",         // green
  leaseCost: "#ef4444",       // red
  operationalCost: "#f59e0b", // amber
  cost: "#ef4444",            // red (legacy fallback)
  netProfit: "#3b82f6",       // blue
};

function formatDollar(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function isMultiLocation(
  data: StoredProjectionData
): data is MultiLocationProjectionData {
  return "version" in data && data.version === 2;
}

/** Normalize any stored format into a LocationProjection array */
function normalizeToLocations(data: StoredProjectionData): LocationProjection[] {
  if (isMultiLocation(data)) {
    return data.locations;
  }
  // Legacy single-location: wrap in a single-element array
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

interface ScenarioChartProps {
  data: StoredProjectionData;
}

export function ScenarioChart({ data }: ScenarioChartProps) {
  const locations = useMemo(() => normalizeToLocations(data), [data]);
  const isMultiLoc = locations.length > 1;

  const [selectedLocationIdx, setSelectedLocationIdx] = useState(0);
  const [activeScenarios, setActiveScenarios] = useState<Set<ScenarioKey>>(
    new Set(["npvOptimized", "costOptimized", "ebitdaOptimized"])
  );

  const currentLocation = locations[selectedLocationIdx] || locations[0];
  const { scenarios, confidence, assumptions } = currentLocation;

  const bandPct = useMemo(() => (100 - confidence) / 200, [confidence]);

  const isSingleMode = activeScenarios.size === 1;
  const singleKey = isSingleMode ? [...activeScenarios][0] : null;

  // Build unified chart data — x-axis extends to longest lease term
  const chartData = useMemo(() => {
    const maxYears = Math.max(
      ...Object.keys(SCENARIO_CONFIG).map((key) => {
        const scenario = scenarios[key as ScenarioKey];
        return scenario?.yearlyProjections?.length || 0;
      })
    );

    return Array.from({ length: maxYears }, (_, i) => {
      const year = i + 1;
      const point: Record<string, number | null> = { year };

      for (const key of Object.keys(SCENARIO_CONFIG) as ScenarioKey[]) {
        const proj = scenarios[key]?.yearlyProjections?.[i];
        if (proj) {
          point[`${key}_netProfit`] = proj.netProfit;
          point[`${key}_revenue`] = proj.revenue;
          point[`${key}_cost`] = proj.cost;
          point[`${key}_leaseCost`] = proj.leaseCost ?? proj.cost;
          point[`${key}_operationalCost`] = proj.operationalCost ?? 0;
          point[`${key}_upper`] = proj.netProfit * (1 + bandPct);
          point[`${key}_lower`] = proj.netProfit * (1 - bandPct);
        } else {
          point[`${key}_netProfit`] = null;
          point[`${key}_revenue`] = null;
          point[`${key}_cost`] = null;
          point[`${key}_leaseCost`] = null;
          point[`${key}_operationalCost`] = null;
          point[`${key}_upper`] = null;
          point[`${key}_lower`] = null;
        }
      }

      return point;
    });
  }, [scenarios, bandPct]);

  // Detect whether the new cost breakdown fields exist in the data
  const hasBreakdown = useMemo(
    () =>
      Object.values(scenarios).some((s) =>
        s?.yearlyProjections?.some(
          (yr) => yr.leaseCost != null && yr.operationalCost != null
        )
      ),
    [scenarios]
  );

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

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3">
          {/* Location selector (only when multi-location) */}
          {isMultiLoc && (
            <div className="flex items-center gap-2 overflow-x-auto">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              {locations.map((loc, idx) => {
                const isSelected = idx === selectedLocationIdx;
                return (
                  <button
                    key={loc.location.locationId ?? idx}
                    onClick={() => setSelectedLocationIdx(idx)}
                    className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
                      isSelected
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
                );
              })}
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
              <p className="mt-1 text-sm text-muted-foreground">
                {isSingleMode
                  ? hasBreakdown
                    ? "Revenue, Lease Cost, OpEx & Net Profit breakdown"
                    : "Revenue, Cost & Net Profit breakdown"
                  : "Net Profit comparison across scenarios"}{" "}
                <span className="text-xs">({confidence}% confidence)</span>
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
        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
            <Tooltip
              content={
                <CustomTooltip
                  isSingleMode={isSingleMode}
                  singleKey={singleKey}
                  activeScenarios={activeScenarios}
                  hasBreakdown={hasBreakdown}
                />
              }
            />

            {isSingleMode && singleKey ? (
              <>
                <Area
                  dataKey={`${singleKey}_upper`}
                  stroke="none"
                  fill={SINGLE_COLORS.netProfit}
                  fillOpacity={0.1}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Area
                  dataKey={`${singleKey}_lower`}
                  stroke="none"
                  fill="#ffffff"
                  fillOpacity={1}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey={`${singleKey}_revenue`}
                  stroke={SINGLE_COLORS.revenue}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls={false}
                  name="Revenue"
                />
                {hasBreakdown ? (
                  <>
                    <Line
                      type="monotone"
                      dataKey={`${singleKey}_leaseCost`}
                      stroke={SINGLE_COLORS.leaseCost}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls={false}
                      name="Lease Cost"
                    />
                    <Line
                      type="monotone"
                      dataKey={`${singleKey}_operationalCost`}
                      stroke={SINGLE_COLORS.operationalCost}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls={false}
                      name="Operational Cost"
                    />
                  </>
                ) : (
                  <Line
                    type="monotone"
                    dataKey={`${singleKey}_cost`}
                    stroke={SINGLE_COLORS.cost}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls={false}
                    name="Cost"
                  />
                )}
                <Line
                  type="monotone"
                  dataKey={`${singleKey}_netProfit`}
                  stroke={SINGLE_COLORS.netProfit}
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  connectNulls={false}
                  name="Net Profit"
                />
              </>
            ) : (
              <>
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
                      dataKey={`${key}_netProfit`}
                      stroke={cfg.color}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: cfg.color }}
                      connectNulls={false}
                      name={cfg.label}
                    />
                  );
                })}
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Summary cards */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          {(Object.keys(SCENARIO_CONFIG) as ScenarioKey[]).map((key) => {
            const cfg = SCENARIO_CONFIG[key];
            const scenario = scenarios[key];
            if (!scenario) return null;
            const lastYear =
              scenario.yearlyProjections[scenario.yearlyProjections.length - 1];
            return (
              <div
                key={key}
                className="rounded-lg border p-4"
                style={{
                  borderColor: activeScenarios.has(key) ? cfg.color : undefined,
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span className="text-sm font-semibold">{cfg.label}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {scenario.description}
                </p>
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{scenario.idealSqft.toLocaleString()} sqft</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{scenario.leaseTerm} yr</span>
                  </div>
                  {lastYear && (
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{formatDollar(lastYear.netProfit)}/yr</span>
                    </div>
                  )}
                </div>
                {scenario.reasoning && (
                  <ReasoningText text={scenario.reasoning} className="mt-3" />
                )}
              </div>
            );
          })}
        </div>

        {/* Assumptions panel */}
        <AssumptionsPanel assumptions={assumptions} />
      </CardContent>
    </Card>
  );
}

function AssumptionsPanel({
  assumptions,
}: {
  assumptions: ScenarioProjectionData["assumptions"];
}) {
  const hasReasoning =
    assumptions.currentSqftReasoning ||
    assumptions.marketRentPsfReasoning ||
    assumptions.employeeCountReasoning ||
    assumptions.annualGrowthRateReasoning;

  const hasSources =
    assumptions.assumptionSources && assumptions.assumptionSources.length > 0;

  if (!hasReasoning && !hasSources) return null;

  const rows: { label: string; value: string; reasoning?: string }[] = [
    {
      label: "Current Sqft",
      value: assumptions.currentSqft?.toLocaleString() ?? "Unknown",
      reasoning: assumptions.currentSqftReasoning,
    },
    {
      label: "Market Rent (PSF)",
      value: assumptions.marketRentPsf != null ? `$${assumptions.marketRentPsf}` : "Unknown",
      reasoning: assumptions.marketRentPsfReasoning,
    },
    {
      label: "Employee Count",
      value: assumptions.employeeCount?.toLocaleString() ?? "Unknown",
      reasoning: assumptions.employeeCountReasoning,
    },
    {
      label: "Annual Growth Rate",
      value: `${(assumptions.annualGrowthRate * 100).toFixed(1)}%`,
      reasoning: assumptions.annualGrowthRateReasoning,
    },
  ];

  return (
    <CollapsibleSection title="Assumptions & Sources" className="mt-4">
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded border px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{row.label}</span>
              <span className="text-xs font-semibold">{row.value}</span>
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

// Custom tooltip component
function CustomTooltip({
  active,
  payload,
  label,
  isSingleMode,
  singleKey,
  activeScenarios,
  hasBreakdown,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: number;
  isSingleMode: boolean;
  singleKey: ScenarioKey | null;
  activeScenarios: Set<ScenarioKey>;
  hasBreakdown: boolean;
}) {
  if (!active || !payload?.length) return null;

  const dataPoint = payload.reduce(
    (acc, p) => {
      acc[p.dataKey] = p.value;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg">
      <p className="mb-2 text-sm font-semibold">Year {label}</p>
      {isSingleMode && singleKey ? (
        <div className="space-y-1">
          <TooltipRow
            label="Revenue"
            value={dataPoint[`${singleKey}_revenue`]}
            color={SINGLE_COLORS.revenue}
          />
          {hasBreakdown ? (
            <>
              <TooltipRow
                label="Lease Cost"
                value={dataPoint[`${singleKey}_leaseCost`]}
                color={SINGLE_COLORS.leaseCost}
              />
              <TooltipRow
                label="Operational Cost"
                value={dataPoint[`${singleKey}_operationalCost`]}
                color={SINGLE_COLORS.operationalCost}
              />
            </>
          ) : (
            <TooltipRow
              label="Cost"
              value={dataPoint[`${singleKey}_cost`]}
              color={SINGLE_COLORS.cost}
            />
          )}
          <TooltipRow
            label="Net Profit"
            value={dataPoint[`${singleKey}_netProfit`]}
            color={SINGLE_COLORS.netProfit}
            bold
          />
        </div>
      ) : (
        <div className="space-y-1">
          {(Object.keys(SCENARIO_CONFIG) as ScenarioKey[]).map((key) => {
            if (!activeScenarios.has(key)) return null;
            const cfg = SCENARIO_CONFIG[key];
            return (
              <TooltipRow
                key={key}
                label={cfg.shortLabel}
                value={dataPoint[`${key}_netProfit`]}
                color={cfg.color}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function TooltipRow({
  label,
  value,
  color,
  bold,
}: {
  label: string;
  value?: number;
  color: string;
  bold?: boolean;
}) {
  if (value === undefined || value === null) return null;
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-1.5">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span
          className={`text-xs ${bold ? "font-semibold" : "text-muted-foreground"}`}
        >
          {label}
        </span>
      </div>
      <span className={`text-xs ${bold ? "font-semibold" : ""}`}>
        {formatDollar(value)}
      </span>
    </div>
  );
}
