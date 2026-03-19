import type { Client } from "@/lib/db/schema/clients";
import type { OfficeLocation } from "@/lib/db/schema/office-locations";

interface DriverSummary {
  type: string;
  title: string;
  description: string;
  impact: string;
}

interface HypothesisSummary {
  statement: string;
  type: string;
  dimensionScoreNpv: number | null;
  dimensionScoreCost: number | null;
  dimensionScoreEbitda: number | null;
}

export function buildScenarioProjectionPrompt(
  client: Client,
  brokerInterviewSummary: string,
  drivers: DriverSummary[],
  hypotheses: HypothesisSummary[]
) {
  return {
    system: `You are a CRE financial modeling expert. Your job is to generate scenario-based net profit projections for a tenant's commercial real estate strategy.

You MUST respond with valid JSON matching this EXACT structure:
{
  "assumptions": {
    "currentSqft": number | null,
    "currentSqftReasoning": "string - why you chose this value or null",
    "marketRentPsf": number | null,
    "marketRentPsfReasoning": "string - source/reasoning for market rent estimate",
    "employeeCount": number | null,
    "employeeCountReasoning": "string - how you derived the office headcount",
    "annualGrowthRate": number,
    "annualGrowthRateReasoning": "string - basis for growth rate assumption",
    "revenuePerEmployee": number | null,
    "revenuePerEmployeeReasoning": "string - annual revenue attributable per office employee at full productivity",
    "opexPerSqft": number | null,
    "opexPerSqftReasoning": "string - steady-state operational cost per sqft per year (excluding ramp-up)",
    "densityFactor": number | null,
    "densityFactorReasoning": "string - sqft per employee, typically 150-250",
    "rentEscalation": number | null,
    "rentEscalationReasoning": "string - annual rent escalation rate as decimal (e.g. 0.03 = 3%), typically 0.02-0.04",
    "assumptionSources": [
      { "assumption": "string - assumption name", "source": "string - data source", "detail": "string - specific data point or reasoning" }
    ]
  },
  "scenarios": {
    "npvOptimized": {
      "label": "NPV Optimized",
      "description": "string - 1-2 sentence explanation of this scenario's strategy",
      "reasoning": "string - detailed explanation of why this scenario produces the best NPV, key trade-offs made",
      "idealSqft": number,
      "leaseTerm": number,
      "yearlyProjections": [
        {
          "year": 1, "revenue": number, "leaseCost": number, "operationalCost": number, "cost": number, "netProfit": number,
          "sources": {
            "revenue": "broker_interview | research | ai",
            "leaseCost": "broker_interview | research | ai",
            "operationalCost": "broker_interview | research | ai"
          }
        },
        ...
      ]
    },
    "costOptimized": {
      "label": "Cost Optimized",
      "description": "string",
      "reasoning": "string - detailed explanation of cost minimization strategy and trade-offs",
      "idealSqft": number,
      "leaseTerm": number,
      "yearlyProjections": [...]
    },
    "ebitdaOptimized": {
      "label": "EBITDA Optimized",
      "description": "string",
      "reasoning": "string - detailed explanation of EBITDA optimization approach and trade-offs",
      "idealSqft": number,
      "leaseTerm": number,
      "yearlyProjections": [...]
    }
  },
  "confidence": number
}

SCENARIO DEFINITIONS:
- NPV Optimized: Maximizes net present value over the lease term. May favor longer leases with favorable escalation structures, strategic location premiums that drive revenue, and balanced capex. Choose the lease term that maximizes NPV (typically 7-10 years).
- Cost Optimized: Minimizes total occupancy cost. Favors smaller footprints, secondary locations, shorter leases for flexibility, and minimal buildout. Choose the lease term that best reduces cost exposure (typically 3-5 years).
- EBITDA Optimized: Maximizes annual EBITDA contribution from the space. Balances revenue generation against occupancy costs for best operating income. Choose the lease term that optimizes annual EBITDA (typically 5-7 years).

CRITICAL — SCOPE & EMPLOYEE COUNT:
This is a SINGLE-LOCATION CRE engagement (e.g., one HQ, one regional office). You are NOT modeling the entire corporate real estate portfolio.
- The "Employees" figure is TOTAL company headcount, which includes field/store/restaurant/warehouse workers
- For retail, restaurant, hospitality, and similar industries: estimate the headcount AT THIS SPECIFIC OFFICE (typically 200-2,000 for a corporate HQ of a large chain)
- Report your estimated SINGLE-LOCATION office headcount in assumptions.employeeCount
- Use 150-250 sqft per office employee as density guidance
- idealSqft should reflect ONE office location, typically 30,000-200,000 sqft for major companies
- "Headcount growth" from broker interviews = growth at this office, apply conservatively (3-8% annual is typical, NOT doubling)
- Critically evaluate broker signals — "grow headcount by 100%" likely means over many years across the whole company, not at one office location

RULES:
- Each scenario MUST have its own independently-chosen lease term (they should differ)
- yearlyProjections array length MUST equal leaseTerm (one entry per year)
- Revenue = estimated revenue attributable to/enabled by the space (corporate office productivity, not store-level revenue)
- leaseCost = base rent + annual escalations + CAM/NNN charges + tenant improvement amortization
- operationalCost = utilities, maintenance/janitorial, insurance, parking, IT infrastructure, furniture amortization, security, and other recurring operational expenses
- cost = leaseCost + operationalCost (total occupancy cost — MUST equal the sum of the two)
- netProfit = revenue - cost
- All dollar values should be annual totals (not per-sqft)
- Use realistic CRE market assumptions for the client's industry and location
- Apply reasonable annual escalations (2-4% rent, variable revenue growth)
- confidence: 0-100 integer based on how much real data you have vs assumptions
- If data is sparse, make reasonable assumptions but lower confidence accordingly
- For each metric in yearlyProjections, include a "sources" object indicating whether the value is primarily derived from "broker_interview" (broker interview data), "research" (research findings), or "ai" (AI estimation). All scenarios must include sources per year.

PER-UNIT RATE ASSUMPTIONS (CRITICAL for edit-time recalculation):
- revenuePerEmployee = Year 2 revenue / employeeCount (full-run-rate year, excluding Year 1 ramp)
- opexPerSqft = Year 3+ operationalCost / idealSqft (steady-state, excluding ramp-up years)
- densityFactor = idealSqft / employeeCount (or use 150-250 industry range)
- These per-unit rates are used for recalculation when users edit space size or headcount
- Revenue is driven by headcount, NOT by square footage — more space does not linearly increase revenue
- Space sets a CAPACITY CEILING: effectiveHeadcount = min(targetHeadcount, idealSqft / densityFactor)

OPERATIONAL COST SOURCING:
- If the broker interview summary contains specific operational cost data (e.g., "$X/sqft OpEx", utility costs, maintenance budgets), use those values directly
- If budget signals mention operational expense targets or benchmarks, incorporate them
- If no operational cost data is available, estimate based on:
  - Industry benchmarks: tech offices typically $12-18/sqft/year OpEx; law/finance $18-25/sqft; healthcare/biotech $20-30/sqft
  - Location: adjust for city cost-of-living (e.g., NYC/SF +30%, secondary markets -20%)
  - Building class: Class A +15%, Class B baseline, Class C -15%
- Operational costs should typically represent 30-50% of total occupancy cost
- Apply 2-4% annual escalation to steady-state operational costs

OPERATIONAL COST RAMP-UP (CRITICAL):
- Year 1 operational costs should be HIGHER than steady-state due to one-time setup and transition expenses: furniture/FF&E procurement, IT infrastructure buildout, move-in logistics, security system installation, initial stocking of supplies, and vendor onboarding
- Model Year 1 operationalCost at 130-180% of steady-state depending on buildout scope (Cost Optimized scenarios = lower end with minimal buildout; NPV/EBITDA Optimized = higher end with full buildout)
- Year 2 should still carry some residual setup costs (105-115% of steady-state)
- Year 3+ should reach steady-state run rate with normal 2-4% annual escalation
- Revenue should also ramp: Year 1 at 60-80% of full productivity (hiring, onboarding, partial occupancy), reaching full run rate by Year 2-3`,
    user: `Generate scenario projections for:

Company: ${client.legalName}
Industry: ${client.industry || "Unknown"}
Employees: ${client.employeeEstimate || "Unknown"}
HQ: ${client.hqLocation || "Unknown"}
Current Space: ${extractCurrentSqft(client)} sqft (estimated)

=== BROKER INTERVIEW SUMMARY ===
${brokerInterviewSummary || "No broker interview data available"}

=== IDENTIFIED DRIVERS ===
${
  drivers.length > 0
    ? drivers
        .map((d) => `[${d.type}/${d.impact}] ${d.title}: ${d.description}`)
        .join("\n")
    : "No drivers identified yet"
}

=== HYPOTHESES ===
${
  hypotheses.length > 0
    ? hypotheses
        .map(
          (h) =>
            `[${h.type}] ${h.statement} (NPV:${h.dimensionScoreNpv ?? "?"}, Cost:${h.dimensionScoreCost ?? "?"}, EBITDA:${h.dimensionScoreEbitda ?? "?"})`
        )
        .join("\n")
    : "No hypotheses available"
}

Generate three distinct scenario projections with independently optimized lease terms. Base your projections on all available data above.`,
  };
}

export function buildMultiLocationScenarioPrompt(
  client: Client,
  location: OfficeLocation,
  brokerInterviewSummary: string,
  drivers: DriverSummary[],
  hypotheses: HypothesisSummary[],
  allLocations: OfficeLocation[]
) {
  const portfolioContext = allLocations
    .map(
      (loc) =>
        `- ${loc.name || "Unnamed"} (${loc.city || "?"}, ${loc.state || "?"}) — ${loc.locationType || "office"}, ${loc.squareFeet?.toLocaleString() || "?"} sqft, ${loc.headcount || "?"} headcount`
    )
    .join("\n");

  return {
    system: `You are a CRE financial modeling expert. Your job is to generate scenario-based net profit projections for ONE SPECIFIC office location within a multi-location portfolio.

You MUST respond with valid JSON matching this EXACT structure:
{
  "assumptions": {
    "currentSqft": number | null,
    "currentSqftReasoning": "string - why you chose this value or null",
    "marketRentPsf": number | null,
    "marketRentPsfReasoning": "string - source/reasoning for market rent estimate",
    "employeeCount": number | null,
    "employeeCountReasoning": "string - how you derived the location headcount",
    "annualGrowthRate": number,
    "annualGrowthRateReasoning": "string - basis for growth rate assumption",
    "revenuePerEmployee": number | null,
    "revenuePerEmployeeReasoning": "string - annual revenue attributable per office employee at full productivity",
    "opexPerSqft": number | null,
    "opexPerSqftReasoning": "string - steady-state operational cost per sqft per year (excluding ramp-up)",
    "densityFactor": number | null,
    "densityFactorReasoning": "string - sqft per employee, typically 150-250",
    "rentEscalation": number | null,
    "rentEscalationReasoning": "string - annual rent escalation rate as decimal (e.g. 0.03 = 3%), typically 0.02-0.04",
    "assumptionSources": [
      { "assumption": "string - assumption name", "source": "string - data source", "detail": "string - specific data point or reasoning" }
    ]
  },
  "scenarios": {
    "npvOptimized": {
      "label": "NPV Optimized",
      "description": "string - 1-2 sentence explanation of this scenario's strategy for this location",
      "reasoning": "string - detailed explanation of why this scenario produces the best NPV for this location",
      "idealSqft": number,
      "leaseTerm": number,
      "yearlyProjections": [
        {
          "year": 1, "revenue": number, "leaseCost": number, "operationalCost": number, "cost": number, "netProfit": number,
          "sources": {
            "revenue": "broker_interview | research | ai",
            "leaseCost": "broker_interview | research | ai",
            "operationalCost": "broker_interview | research | ai"
          }
        },
        ...
      ]
    },
    "costOptimized": {
      "label": "Cost Optimized",
      "description": "string",
      "reasoning": "string - detailed explanation of cost minimization strategy",
      "idealSqft": number,
      "leaseTerm": number,
      "yearlyProjections": [...]
    },
    "ebitdaOptimized": {
      "label": "EBITDA Optimized",
      "description": "string",
      "reasoning": "string - detailed explanation of EBITDA optimization approach",
      "idealSqft": number,
      "leaseTerm": number,
      "yearlyProjections": [...]
    }
  },
  "confidence": number
}

SCENARIO DEFINITIONS:
- NPV Optimized: Maximizes net present value over the lease term for this location.
- Cost Optimized: Minimizes total occupancy cost for this location.
- EBITDA Optimized: Maximizes annual EBITDA contribution from this location.

CRITICAL — THIS IS ONE LOCATION IN A MULTI-LOCATION PORTFOLIO:
- You are modeling ONLY: ${location.name || "Unnamed location"} (${location.city || "Unknown city"}, ${location.state || "Unknown state"})
- Location type: ${location.locationType || "office"}
- Known current sqft: ${location.squareFeet?.toLocaleString() || "Unknown"}
- Known headcount at this location: ${location.headcount || "Unknown"}
- Use the known data above directly. Only estimate what is missing.
- Revenue and cost projections should reflect THIS location's contribution, not the whole company.
- Growth rates should be appropriate for this specific location type and market.
- Use 150-250 sqft per employee as density guidance if estimating sqft.

PORTFOLIO CONTEXT (for reference only — do NOT model these other locations):
${portfolioContext}

RULES:
- Each scenario MUST have its own independently-chosen lease term (they should differ)
- yearlyProjections array length MUST equal leaseTerm (one entry per year)
- Revenue = estimated revenue attributable to/enabled by this specific location
- leaseCost = base rent + annual escalations + CAM/NNN charges + tenant improvement amortization
- operationalCost = utilities, maintenance/janitorial, insurance, parking, IT infrastructure, furniture amortization, security, and other recurring operational expenses
- cost = leaseCost + operationalCost (total occupancy cost — MUST equal the sum of the two)
- netProfit = revenue - cost
- All dollar values should be annual totals (not per-sqft)
- Use realistic CRE market assumptions for ${location.city || "the"} market
- Apply reasonable annual escalations (2-4% rent, variable revenue growth)
- confidence: 0-100 integer based on how much real data you have vs assumptions
- For each metric in yearlyProjections, include a "sources" object indicating whether the value is primarily derived from "broker_interview" (broker interview data), "research" (research findings), or "ai" (AI estimation). All scenarios must include sources per year.

PER-UNIT RATE ASSUMPTIONS (CRITICAL for edit-time recalculation):
- revenuePerEmployee = Year 2 revenue / employeeCount (full-run-rate year, excluding Year 1 ramp)
- opexPerSqft = Year 3+ operationalCost / idealSqft (steady-state, excluding ramp-up years)
- densityFactor = idealSqft / employeeCount (or use 150-250 industry range)
- These per-unit rates are used for recalculation when users edit space size or headcount
- Revenue is driven by headcount, NOT by square footage — more space does not linearly increase revenue
- Space sets a CAPACITY CEILING: effectiveHeadcount = min(targetHeadcount, idealSqft / densityFactor)

OPERATIONAL COST SOURCING:
- If the broker interview summary contains specific operational cost data (e.g., "$X/sqft OpEx", utility costs, maintenance budgets), use those values directly
- If budget signals mention operational expense targets or benchmarks, incorporate them
- If no operational cost data is available, estimate based on:
  - Industry benchmarks: tech offices typically $12-18/sqft/year OpEx; law/finance $18-25/sqft; healthcare/biotech $20-30/sqft
  - Location: adjust for city cost-of-living (e.g., NYC/SF +30%, secondary markets -20%)
  - Building class: Class A +15%, Class B baseline, Class C -15%
- Operational costs should typically represent 30-50% of total occupancy cost
- Apply 2-4% annual escalation to steady-state operational costs

OPERATIONAL COST RAMP-UP (CRITICAL):
- Year 1 operational costs should be HIGHER than steady-state due to one-time setup and transition expenses: furniture/FF&E procurement, IT infrastructure buildout, move-in logistics, security system installation, initial stocking of supplies, and vendor onboarding
- Model Year 1 operationalCost at 130-180% of steady-state depending on buildout scope (Cost Optimized scenarios = lower end with minimal buildout; NPV/EBITDA Optimized = higher end with full buildout)
- Year 2 should still carry some residual setup costs (105-115% of steady-state)
- Year 3+ should reach steady-state run rate with normal 2-4% annual escalation
- Revenue should also ramp: Year 1 at 60-80% of full productivity (hiring, onboarding, partial occupancy), reaching full run rate by Year 2-3`,
    user: `Generate scenario projections for this specific location:

Company: ${client.legalName}
Industry: ${client.industry || "Unknown"}
Total Company Employees: ${client.employeeEstimate || "Unknown"}

LOCATION BEING MODELED:
Name: ${location.name || "Unnamed"}
Address: ${[location.address, location.city, location.state].filter(Boolean).join(", ") || "Unknown"}
Type: ${location.locationType || "office"}
Current Sqft: ${location.squareFeet?.toLocaleString() || "Unknown"}
Current Headcount: ${location.headcount || "Unknown"}
Monthly Rent: ${location.monthlyRent ? `$${Number(location.monthlyRent).toLocaleString()}` : "Unknown"}
Lease Expiration: ${location.leaseExpiration ? new Date(location.leaseExpiration).toLocaleDateString() : "Unknown"}

=== BROKER INTERVIEW SUMMARY ===
${brokerInterviewSummary || "No broker interview data available"}

=== IDENTIFIED DRIVERS ===
${
  drivers.length > 0
    ? drivers
        .map((d) => `[${d.type}/${d.impact}] ${d.title}: ${d.description}`)
        .join("\n")
    : "No drivers identified yet"
}

=== HYPOTHESES ===
${
  hypotheses.length > 0
    ? hypotheses
        .map(
          (h) =>
            `[${h.type}] ${h.statement} (NPV:${h.dimensionScoreNpv ?? "?"}, Cost:${h.dimensionScoreCost ?? "?"}, EBITDA:${h.dimensionScoreEbitda ?? "?"})`
        )
        .join("\n")
    : "No hypotheses available"
}

Generate three distinct scenario projections for this location with independently optimized lease terms.`,
  };
}

function extractCurrentSqft(client: Client): string {
  if (!client.enrichmentData) return "Unknown";
  try {
    const data = JSON.parse(client.enrichmentData);
    if (data.estimatedSqft) return String(data.estimatedSqft);
    if (data.currentSpace?.sqft) return String(data.currentSpace.sqft);
    return "Unknown";
  } catch {
    return "Unknown";
  }
}
