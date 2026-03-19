"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CollapsibleSection, OriginPill } from "@/components/ui/citation-badge";
import type { ScenarioDetail, YearProjection } from "@/types";

type ScenarioKey = "npvOptimized" | "costOptimized" | "ebitdaOptimized";
type EditableMetric = "revenue" | "leaseCost" | "operationalCost";

const SCENARIO_CONFIG: Record<
  ScenarioKey,
  { label: string; color: string; dot: string }
> = {
  npvOptimized: { label: "NPV Optimized", color: "#3b82f6", dot: "🔵" },
  costOptimized: { label: "Cost Optimized", color: "#22c55e", dot: "🟢" },
  ebitdaOptimized: { label: "EBITDA Optimized", color: "#f59e0b", dot: "🟡" },
};

function formatDollar(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatCost(value: number): string {
  return `(${formatDollar(Math.abs(value))})`;
}

// --- Inline cell editor ---
function EditableCell({
  value,
  onChange,
  isCost,
  isEdited,
}: {
  value: number;
  onChange: (newValue: number) => void;
  isCost: boolean;
  isEdited: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEdit() {
    setDraft(String(Math.round(value)));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed !== value) {
      onChange(Math.round(parsed));
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
        className="w-20 rounded border bg-background px-1 py-0.5 text-right text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
      />
    );
  }

  const displayValue = isCost ? formatCost(value) : formatDollar(value);

  return (
    <button
      type="button"
      onClick={startEdit}
      className={`cursor-pointer rounded px-1 py-0.5 text-right text-xs tabular-nums hover:bg-muted/60 ${
        isEdited ? "ring-1 ring-primary/30" : ""
      }`}
    >
      {displayValue}
    </button>
  );
}

interface FinancialTableProps {
  scenarios: {
    npvOptimized: ScenarioDetail;
    costOptimized: ScenarioDetail;
    ebitdaOptimized: ScenarioDetail;
  };
  activeScenarios: Set<ScenarioKey>;
  hasBreakdown: boolean;
  onProjectionChange?: (
    scenarioKey: ScenarioKey,
    yearIndex: number,
    field: EditableMetric,
    value: number
  ) => void;
}

export function FinancialTable({
  scenarios,
  activeScenarios,
  hasBreakdown,
  onProjectionChange,
}: FinancialTableProps) {
  const [expandedScenarios, setExpandedScenarios] = useState<Set<ScenarioKey>>(
    new Set()
  );

  function toggleExpand(key: ScenarioKey) {
    setExpandedScenarios((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const maxYears = Math.max(
    ...Object.values(scenarios).map(
      (s) => s?.yearlyProjections?.length || 0
    )
  );

  if (maxYears === 0) return null;

  const yearCols = Array.from({ length: maxYears }, (_, i) => i + 1);

  return (
    <CollapsibleSection title="Financial Detail" className="mt-4">
      <div className="relative overflow-x-auto rounded border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="sticky left-0 z-10 min-w-[200px] bg-muted/30">
                Metric
              </TableHead>
              {yearCols.map((yr) => (
                <TableHead key={yr} className="text-right">
                  Yr {yr}
                </TableHead>
              ))}
              <TableHead className="text-right font-semibold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(Object.keys(SCENARIO_CONFIG) as ScenarioKey[]).map((key) => {
              if (!activeScenarios.has(key)) return null;
              const cfg = SCENARIO_CONFIG[key];
              const scenario = scenarios[key];
              if (!scenario) return null;

              const projections = scenario.yearlyProjections;
              const isExpanded = expandedScenarios.has(key);

              const totals = projections.reduce(
                (acc, yr) => ({
                  revenue: acc.revenue + yr.revenue,
                  leaseCost: acc.leaseCost + (yr.leaseCost ?? 0),
                  operationalCost: acc.operationalCost + (yr.operationalCost ?? 0),
                  cost: acc.cost + yr.cost,
                  netProfit: acc.netProfit + yr.netProfit,
                }),
                { revenue: 0, leaseCost: 0, operationalCost: 0, cost: 0, netProfit: 0 }
              );

              return (
                <ScenarioRows
                  key={key}
                  scenarioKey={key}
                  cfg={cfg}
                  projections={projections}
                  totals={totals}
                  yearCols={yearCols}
                  isExpanded={isExpanded}
                  hasBreakdown={hasBreakdown}
                  onToggle={() => toggleExpand(key)}
                  onProjectionChange={onProjectionChange}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>
    </CollapsibleSection>
  );
}

function ScenarioRows({
  scenarioKey,
  cfg,
  projections,
  totals,
  yearCols,
  isExpanded,
  hasBreakdown,
  onToggle,
  onProjectionChange,
}: {
  scenarioKey: ScenarioKey;
  cfg: { label: string; color: string; dot: string };
  projections: ScenarioDetail["yearlyProjections"];
  totals: { revenue: number; leaseCost: number; operationalCost: number; cost: number; netProfit: number };
  yearCols: number[];
  isExpanded: boolean;
  hasBreakdown: boolean;
  onToggle: () => void;
  onProjectionChange?: (
    scenarioKey: ScenarioKey,
    yearIndex: number,
    field: EditableMetric,
    value: number
  ) => void;
}) {
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <>
      {/* NOI summary row — clickable to expand */}
      <TableRow
        className="cursor-pointer hover:bg-muted/40"
        onClick={onToggle}
      >
        <TableCell className="sticky left-0 z-10 bg-background font-semibold">
          <div className="flex items-center gap-2">
            <ChevronIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: cfg.color }}
            />
            <span>NOI — {cfg.label}</span>
          </div>
        </TableCell>
        {yearCols.map((yr) => {
          const proj = projections[yr - 1];
          return (
            <TableCell key={yr} className="text-right font-semibold tabular-nums">
              {proj ? formatDollar(proj.netProfit) : "—"}
            </TableCell>
          );
        })}
        <TableCell className="text-right font-bold tabular-nums">
          {formatDollar(totals.netProfit)}
        </TableCell>
      </TableRow>

      {/* Expanded sub-rows */}
      {isExpanded && (
        <>
          <EditableSubRow
            label="Revenue"
            metric="revenue"
            scenarioKey={scenarioKey}
            yearCols={yearCols}
            projections={projections}
            total={totals.revenue}
            colorClass="text-green-600 dark:text-green-400"
            isCost={false}
            onProjectionChange={onProjectionChange}
          />

          {hasBreakdown ? (
            <>
              <EditableSubRow
                label="Lease Cost"
                metric="leaseCost"
                scenarioKey={scenarioKey}
                yearCols={yearCols}
                projections={projections}
                total={totals.leaseCost}
                colorClass="text-destructive"
                isCost={true}
                onProjectionChange={onProjectionChange}
              />
              <EditableSubRow
                label="Operating Expenses"
                metric="operationalCost"
                scenarioKey={scenarioKey}
                yearCols={yearCols}
                projections={projections}
                total={totals.operationalCost}
                colorClass="text-destructive"
                isCost={true}
                onProjectionChange={onProjectionChange}
              />
            </>
          ) : (
            <SubRow
              label="Total Cost"
              yearCols={yearCols}
              getYearValue={(yr) => projections[yr - 1]?.cost}
              total={totals.cost}
              colorClass="text-destructive"
              format={formatCost}
            />
          )}
        </>
      )}
    </>
  );
}

function getMetricSource(proj: YearProjection | undefined, metric: EditableMetric): string | undefined {
  return proj?.sources?.[metric];
}

function EditableSubRow({
  label,
  metric,
  scenarioKey,
  yearCols,
  projections,
  total,
  colorClass,
  isCost,
  onProjectionChange,
}: {
  label: string;
  metric: EditableMetric;
  scenarioKey: ScenarioKey;
  yearCols: number[];
  projections: YearProjection[];
  total: number;
  colorClass: string;
  isCost: boolean;
  onProjectionChange?: (
    scenarioKey: ScenarioKey,
    yearIndex: number,
    field: EditableMetric,
    value: number
  ) => void;
}) {
  // Use first year's source as representative for the row label
  const representativeSource = getMetricSource(projections[0], metric);

  return (
    <TableRow className="bg-muted/20">
      <TableCell className="sticky left-0 z-10 bg-muted/20 pl-10 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {label}
          {representativeSource && (
            <OriginPill source={representativeSource} className="ml-1" />
          )}
        </span>
      </TableCell>
      {yearCols.map((yr) => {
        const proj = projections[yr - 1];
        const val = proj ? (proj[metric as keyof YearProjection] as number | undefined) : undefined;
        const source = getMetricSource(proj, metric);
        const isEdited = source === "user";

        if (val == null) {
          return (
            <TableCell key={yr} className="text-right text-xs tabular-nums">
              —
            </TableCell>
          );
        }

        return (
          <TableCell key={yr} className={`text-right text-xs tabular-nums ${colorClass}`}>
            {onProjectionChange ? (
              <EditableCell
                value={val}
                isCost={isCost}
                isEdited={isEdited}
                onChange={(newValue) =>
                  onProjectionChange(scenarioKey, yr - 1, metric, newValue)
                }
              />
            ) : (
              isCost ? formatCost(val) : formatDollar(val)
            )}
          </TableCell>
        );
      })}
      <TableCell className={`text-right text-xs font-medium tabular-nums ${colorClass}`}>
        {isCost ? formatCost(total) : formatDollar(total)}
      </TableCell>
    </TableRow>
  );
}

function SubRow({
  label,
  yearCols,
  getYearValue,
  total,
  colorClass,
  format,
}: {
  label: string;
  yearCols: number[];
  getYearValue: (yr: number) => number | undefined | null;
  total: number;
  colorClass: string;
  format: (v: number) => string;
}) {
  return (
    <TableRow className="bg-muted/20">
      <TableCell className="sticky left-0 z-10 bg-muted/20 pl-10 text-xs text-muted-foreground">
        {label}
      </TableCell>
      {yearCols.map((yr) => {
        const val = getYearValue(yr);
        return (
          <TableCell
            key={yr}
            className={`text-right text-xs tabular-nums ${val != null ? colorClass : ""}`}
          >
            {val != null ? format(val) : "—"}
          </TableCell>
        );
      })}
      <TableCell className={`text-right text-xs font-medium tabular-nums ${colorClass}`}>
        {format(total)}
      </TableCell>
    </TableRow>
  );
}
