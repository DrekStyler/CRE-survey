import type {
  YearProjection,
  ScenarioDetail,
  ScenarioProjectionData,
} from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Assumptions = ScenarioProjectionData["assumptions"];

/** Fields that trigger a full recalculation when changed. */
export type RecalcField =
  | "marketRentPsf"
  | "opexPerSqft"
  | "employeeCount"
  | "revenuePerEmployee"
  | "densityFactor"
  | "annualGrowthRate"
  | "rentEscalation";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DENSITY = 200; // sqft per employee
const DEFAULT_RENT_ESCALATION = 0.03; // 3% annual rent escalation

// Operational cost ramp-up factors (Year 1 is higher due to move-in/buildout)
const OPEX_RAMP: Record<number, number> = { 1: 1.5, 2: 1.1 };
// Revenue productivity ramp (Year 1 partial occupancy/hiring)
const REVENUE_RAMP: Record<number, number> = { 1: 0.7, 2: 0.9 };

// ---------------------------------------------------------------------------
// Backward-compat: derive missing assumption fields from existing data
// ---------------------------------------------------------------------------

/**
 * Fill in revenuePerEmployee, opexPerSqft, and densityFactor when they are
 * missing from saved projection data.  Uses year-2 numbers (or year-1 if only
 * one year) to avoid ramp distortion.
 */
export function deriveAssumptions(
  assumptions: Assumptions,
  scenarios: ScenarioProjectionData["scenarios"]
): Assumptions {
  const a = { ...assumptions };

  // Pick the first available scenario to derive from
  const scenario =
    scenarios.npvOptimized ?? scenarios.ebitdaOptimized ?? scenarios.costOptimized;
  if (!scenario) return a;

  const p = scenario.yearlyProjections;
  const steadyIdx = p.length >= 2 ? 1 : 0; // year 2 (index 1) preferred

  if (a.densityFactor == null) {
    if (a.employeeCount && a.employeeCount > 0 && scenario.idealSqft > 0) {
      a.densityFactor = Math.round(scenario.idealSqft / a.employeeCount);
    } else {
      a.densityFactor = DEFAULT_DENSITY;
    }
  }

  if (a.revenuePerEmployee == null) {
    const emp = a.employeeCount;
    if (emp && emp > 0 && p[steadyIdx]) {
      // Undo the revenue ramp to get the full-run-rate per-employee figure
      const ramp = REVENUE_RAMP[steadyIdx + 1] ?? 1;
      a.revenuePerEmployee = Math.round(p[steadyIdx].revenue / (emp * ramp));
    }
  }

  if (a.rentEscalation == null) {
    a.rentEscalation = DEFAULT_RENT_ESCALATION;
  }

  if (a.opexPerSqft == null) {
    // Use year-3 if available (true steady-state), else year-2
    const opexIdx = p.length >= 3 ? 2 : steadyIdx;
    const opex = p[opexIdx]?.operationalCost;
    if (opex != null && scenario.idealSqft > 0) {
      const ramp = OPEX_RAMP[opexIdx + 1] ?? 1;
      a.opexPerSqft = Math.round(opex / (scenario.idealSqft * ramp));
    }
  }

  return a;
}

// ---------------------------------------------------------------------------
// Cost recalculation from per-sqft rates
// ---------------------------------------------------------------------------

/**
 * Rebuild leaseCost and operationalCost from first principles using per-sqft
 * rates.  Preserves the number of years and recalculates derived fields.
 */
export function recalculateCosts(
  projections: YearProjection[],
  idealSqft: number,
  marketRentPsf: number | null,
  opexPerSqft: number | null,
  rentEscalation?: number | null
): YearProjection[] {
  const escalation = rentEscalation ?? DEFAULT_RENT_ESCALATION;
  return projections.map((yr) => {
    const copy = { ...yr, sources: { ...yr.sources } };
    const yearIdx = copy.year; // 1-based

    if (marketRentPsf != null) {
      copy.leaseCost = Math.round(
        idealSqft * marketRentPsf * Math.pow(1 + escalation, yearIdx - 1)
      );
      copy.sources!.leaseCost = "user";
    }

    if (opexPerSqft != null) {
      const ramp = OPEX_RAMP[yearIdx] ?? 1;
      copy.operationalCost = Math.round(
        idealSqft * opexPerSqft * ramp * Math.pow(1 + escalation, yearIdx - 1)
      );
      copy.sources!.operationalCost = "user";
    }

    copy.cost = (copy.leaseCost ?? 0) + (copy.operationalCost ?? 0);
    copy.netProfit = copy.revenue - copy.cost;
    return copy;
  });
}

// ---------------------------------------------------------------------------
// Revenue recalculation from headcount
// ---------------------------------------------------------------------------

/**
 * Rebuild revenue from headcount × revenuePerEmployee, capped by space
 * capacity.  Extra space beyond what headcount needs does NOT boost revenue.
 */
export function recalculateRevenue(
  projections: YearProjection[],
  targetHeadcount: number,
  idealSqft: number,
  densityFactor: number | null,
  revenuePerEmployee: number | null,
  annualGrowthRate: number
): YearProjection[] {
  if (revenuePerEmployee == null || targetHeadcount <= 0) return projections;

  const density = densityFactor ?? DEFAULT_DENSITY;
  const spaceCapacity = Math.floor(idealSqft / density);
  const effectiveHeadcount = Math.min(targetHeadcount, spaceCapacity);

  return projections.map((yr) => {
    const copy = { ...yr, sources: { ...yr.sources } };
    const yearIdx = copy.year;
    const ramp = REVENUE_RAMP[yearIdx] ?? 1;
    const growth = Math.pow(1 + annualGrowthRate, yearIdx - 1);

    copy.revenue = Math.round(effectiveHeadcount * revenuePerEmployee * growth * ramp);
    copy.sources!.revenue = "user";
    copy.cost = (copy.leaseCost ?? 0) + (copy.operationalCost ?? 0);
    copy.netProfit = copy.revenue - copy.cost;
    return copy;
  });
}

// ---------------------------------------------------------------------------
// Combined recalculation
// ---------------------------------------------------------------------------

export function recalculateAll(
  projections: YearProjection[],
  idealSqft: number,
  assumptions: Assumptions
): YearProjection[] {
  let result = recalculateCosts(
    projections,
    idealSqft,
    assumptions.marketRentPsf,
    assumptions.opexPerSqft,
    assumptions.rentEscalation
  );
  result = recalculateRevenue(
    result,
    assumptions.employeeCount ?? 0,
    idealSqft,
    assumptions.densityFactor,
    assumptions.revenuePerEmployee,
    assumptions.annualGrowthRate
  );
  return result;
}

// ---------------------------------------------------------------------------
// Scenario-level handlers
// ---------------------------------------------------------------------------

/**
 * Handle a change to idealSqft: recalculate costs from rates and cap revenue
 * by the new space capacity.
 */
export function recalculateFromSqftChange(
  scenario: ScenarioDetail,
  newSqft: number,
  assumptions: Assumptions
): ScenarioDetail {
  const updated = { ...scenario, idealSqft: newSqft };
  updated.yearlyProjections = recalculateAll(
    scenario.yearlyProjections,
    newSqft,
    assumptions
  );
  return updated;
}

/**
 * Handle a change to an assumption field: recalculate the appropriate subset
 * of projections.
 */
export function recalculateFromAssumptionChange(
  scenario: ScenarioDetail,
  field: RecalcField,
  assumptions: Assumptions
): ScenarioDetail {
  const updated = { ...scenario };

  switch (field) {
    case "marketRentPsf":
    case "opexPerSqft":
    case "rentEscalation":
      updated.yearlyProjections = recalculateCosts(
        scenario.yearlyProjections,
        scenario.idealSqft,
        assumptions.marketRentPsf,
        assumptions.opexPerSqft,
        assumptions.rentEscalation
      );
      break;

    case "employeeCount":
    case "revenuePerEmployee":
    case "densityFactor":
      updated.yearlyProjections = recalculateRevenue(
        scenario.yearlyProjections,
        assumptions.employeeCount ?? 0,
        scenario.idealSqft,
        assumptions.densityFactor,
        assumptions.revenuePerEmployee,
        assumptions.annualGrowthRate
      );
      break;

    case "annualGrowthRate":
      updated.yearlyProjections = recalculateAll(
        scenario.yearlyProjections,
        scenario.idealSqft,
        assumptions
      );
      break;
  }

  return updated;
}
