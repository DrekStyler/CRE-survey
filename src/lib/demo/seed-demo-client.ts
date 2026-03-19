"use server";

import { db } from "@/lib/db";
import {
  clients,
  brokerInterviews,
  brokerInsights,
  researchFindings,
  hypotheses,
  drivers,
  officeLocations,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { ScenarioProjectionData } from "@/types";

/**
 * Seeds a demo client (Children's Hospital Colorado — Fort Collins Clinic)
 * for a new user so they can explore the full platform flow.
 * Only runs if the user has zero clients.
 */
export async function seedDemoClientIfNeeded(userId: string): Promise<boolean> {
  // Check if user already has clients
  const existing = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.createdBy, userId))
    .limit(1);

  if (existing.length > 0) return false;

  // --- 1. Create Client ---
  const [client] = await db
    .insert(clients)
    .values({
      legalName: "Children's Hospital Colorado",
      commonName: "Children's Colorado",
      website: "https://www.childrenscolorado.org",
      emailDomain: "childrenscolorado.org",
      canonicalDomain: "childrenscolorado.org",
      industry: "Healthcare",
      hqLocation: "Aurora, CO",
      employeeEstimate: 8500,
      enrichmentStatus: "completed",
      enrichmentData: JSON.stringify({
        description:
          "Children's Hospital Colorado is the Rocky Mountain region's premier pediatric healthcare system, operating the only Level I pediatric trauma center in a seven-state region. The system includes a 434-bed main campus in Aurora and a network of clinics, urgent care centers, and therapy locations across Colorado and neighboring states.",
        estimatedSqft: 45000,
        currentSpace: { sqft: 45000 },
        keyFacts: [
          "Only Level I pediatric trauma center in a seven-state region",
          "Part of the University of Colorado Anschutz Medical Campus",
          "Ranked among top 10 children's hospitals nationally by U.S. News & World Report",
          "Expanding community clinic network to serve Northern Colorado's growing population",
          "Annual revenue exceeds $2.5 billion",
        ],
        dataSources: [
          { name: "Children's Colorado Official Website", url: "https://www.childrenscolorado.org" },
          { name: "U.S. News & World Report Hospital Rankings", url: "https://health.usnews.com" },
          { name: "Colorado Secretary of State Business Records" },
        ],
        citations: {
          industry: "Healthcare — identified from organizational filings and website",
          hqLocation: "Aurora, CO — main campus at Anschutz Medical Campus, 13123 E 16th Ave",
          employees: "~8,500 employees system-wide per latest annual report",
        },
      }),
      entityMatchConfidence: 95,
      confirmedByBroker: true,
      scenarioProjections: JSON.stringify(buildDemoProjections()),
      createdBy: userId,
    })
    .returning();

  const clientId = client.id;

  // --- 2. Office Locations ---
  await db.insert(officeLocations).values([
    {
      clientId,
      name: "Anschutz Main Campus",
      address: "13123 E 16th Ave",
      city: "Aurora",
      state: "CO",
      country: "US",
      postalCode: "80045",
      squareFeet: 1200000,
      headcount: 5500,
      locationType: "HQ",
      source: "enrichment",
    },
    {
      clientId,
      name: "Fort Collins Clinic (Proposed)",
      address: "TBD — Harmony Road Corridor",
      city: "Fort Collins",
      state: "CO",
      country: "US",
      postalCode: "80525",
      squareFeet: 45000,
      headcount: 120,
      locationType: "satellite",
      source: "broker_input",
    },
  ]);

  // --- 3. Broker Interview ---
  const [interview] = await db
    .insert(brokerInterviews)
    .values({
      clientId,
      brokerHypothesis:
        "Children's Colorado needs a 40,000–50,000 sqft ambulatory clinic in Fort Collins to capture the rapidly growing Northern Colorado pediatric market. The Harmony Road corridor offers strong demographics, proximity to UC Health Harmony campus, and competitive lease rates vs. Denver metro.",
      knownClientIssues:
        "Current patients in Larimer County drive 60+ miles to Aurora for specialty care. Telehealth bridged some gaps during COVID but families want in-person subspecialty access. The existing Briargate (Colorado Springs) clinic model proved successful and they want to replicate it northward.",
      marketConstraints:
        "Fort Collins medical office vacancy is tight at ~6% (vs. 12% metro average). New Class A medical office deliveries are limited — mostly the Harmony Technology Park and Timberline corridor. Landlords are favoring healthcare tenants due to long-term lease stability. Competition from UCHealth and Banner Health for the same corridors.",
      budgetSignals:
        "Children's Colorado has a $150M capital budget for FY2025-2027 network expansion. The Fort Collins clinic is one of three planned Northern Colorado sites. Target all-in occupancy cost of $32–38/sqft NNN. They'll invest $3–5M in tenant improvements for medical buildout (imaging suites, procedure rooms, lab space). Prefer landlord TI contribution of $60–80/sqft.",
      timing:
        "Board approval expected Q2 2025. Need to be operational by Q1 2027 to align with their strategic plan cycle. LOI stage by September 2025, lease execution by December 2025, 12-month buildout.",
      painPoints:
        "1) Losing Northern Colorado families to UCHealth pediatrics. 2) Recruiting specialists is hard when the only option is Aurora — physicians want to live/work in Fort Collins. 3) Current referral network with local pediatricians is weakening without physical presence. 4) Transport logistics for families with sick children over 60 miles is a patient satisfaction issue.",
      growthExpectations:
        "Larimer County population grew 15% in the last decade, with family-age (25-44) demographics growing fastest. Children's Colorado expects 120-150 staff at the Fort Collins location within 3 years (mix of physicians, nurses, admin, and allied health). Headcount growth of 5-8% annually after initial staffing. Potential expansion to 60,000+ sqft within 5-7 years if volumes support it.",
      additionalNotes:
        "Key departments for Fort Collins: pediatric subspecialty clinics (cardiology, neurology, orthopedics, GI), urgent care, behavioral health, and physical/occupational therapy. Imaging suite required (X-ray, ultrasound, possible MRI). Lab draw station needed. Preference for ground-floor access with dedicated pediatric entrance. Parking ratio of 5:1000 sqft minimum. Building must accommodate HIPAA compliance infrastructure. Interest in LEED certification or sustainable building features.",
      createdBy: userId,
    })
    .returning();

  // --- 4. Broker Insights ---
  await db.insert(brokerInsights).values([
    {
      brokerInterviewId: interview.id,
      category: "market_demand",
      insight:
        "Fort Collins medical office vacancy at ~6% signals high demand; new Class A medical deliveries are limited to Harmony Technology Park and Timberline corridor.",
      derivedFrom: "marketConstraints",
    },
    {
      brokerInterviewId: interview.id,
      category: "budget",
      insight:
        "$150M capital budget for FY2025-2027 network expansion. Target all-in occupancy cost of $32-38/sqft NNN with $3-5M TI investment.",
      derivedFrom: "budgetSignals",
    },
    {
      brokerInterviewId: interview.id,
      category: "growth",
      insight:
        "120-150 staff within 3 years, 5-8% annual headcount growth, potential expansion to 60,000+ sqft within 5-7 years.",
      derivedFrom: "growthExpectations",
    },
    {
      brokerInterviewId: interview.id,
      category: "competition",
      insight:
        "UCHealth and Banner Health competing for same corridors. Children's Colorado losing Northern Colorado families to UCHealth pediatrics.",
      derivedFrom: "knownClientIssues",
    },
    {
      brokerInterviewId: interview.id,
      category: "timeline",
      insight:
        "Board approval Q2 2025, LOI by September 2025, lease execution December 2025, 12-month buildout, operational Q1 2027.",
      derivedFrom: "timing",
    },
    {
      brokerInterviewId: interview.id,
      category: "recruiting",
      insight:
        "Physician recruitment advantage: specialists want to live/work in Fort Collins rather than commuting to Aurora campus.",
      derivedFrom: "painPoints",
    },
  ]);

  // --- 5. Research Findings ---
  const now = new Date();
  const findingRows = await db
    .insert(researchFindings)
    .values([
      {
        clientId,
        category: "workforce_growth" as const,
        title: "Larimer County Population Growth Outpacing State Average",
        summary:
          "Larimer County grew 15.2% from 2010-2020 (vs. 14.8% statewide), with the 25-44 age cohort growing 22%. Fort Collins MSA added 18,000 residents in 2022-2024 alone. This family-age growth directly drives pediatric healthcare demand.",
        sourceName: "U.S. Census Bureau / Colorado State Demographer",
        sourceUrl: "https://demography.dola.colorado.gov",
        retrievalDate: now,
        confidence: 92,
      },
      {
        clientId,
        category: "industry_benchmarks" as const,
        title: "Northern Colorado Medical Office Market Report",
        summary:
          "Fort Collins medical office asking rents average $26-32/sqft NNN for Class A space. Vacancy is 5.8%, down from 8.2% in 2022. New medical office construction is limited with only 85,000 sqft delivered in 2024. Healthcare tenants receive 10-15% rent premiums but offer 10-15 year lease terms, making them preferred by landlords.",
        sourceName: "CBRE Northern Colorado Market Report Q4 2024",
        sourceUrl: "https://www.cbre.com/insights",
        retrievalDate: now,
        confidence: 88,
      },
      {
        clientId,
        category: "hiring_trends" as const,
        title: "Pediatric Subspecialty Physician Shortage in Northern Colorado",
        summary:
          "Northern Colorado has 0.8 pediatric subspecialists per 10,000 children vs. the national average of 1.4. Fort Collins families report average 58-mile one-way trip for pediatric cardiology, neurology, and orthopedic appointments. Children's Colorado referral data shows 3,200 annual patient visits originating from Larimer County.",
        sourceName: "Colorado Health Institute",
        sourceUrl: "https://www.coloradohealthinstitute.org",
        retrievalDate: now,
        confidence: 85,
      },
      {
        clientId,
        category: "financial" as const,
        title: "Children's Hospital Colorado Financial Performance",
        summary:
          "FY2024 revenue of $2.67B (+8.3% YoY). Operating margin of 4.2%. The Briargate (Colorado Springs) satellite clinic achieved profitability within 18 months of opening, generating $45M annual revenue from a 38,000 sqft facility. System-wide capital budget of $450M over 3 years.",
        sourceName: "Children's Colorado Annual Report 2024",
        retrievalDate: now,
        confidence: 90,
      },
      {
        clientId,
        category: "office_density" as const,
        title: "Healthcare Clinic Space Planning Benchmarks",
        summary:
          "Ambulatory care clinics average 280-350 sqft per provider (physician + support staff). Imaging suites require 1,200-2,000 sqft depending on modality. Pediatric clinics need 15-20% more circulation space than adult clinics for stroller access and family waiting areas. Optimal layout: 60% clinical, 20% admin, 20% common/circulation.",
        sourceName: "FGI Guidelines for Design & Construction of Hospitals",
        retrievalDate: now,
        confidence: 82,
      },
      {
        clientId,
        category: "talent_geography" as const,
        title: "Fort Collins Healthcare Workforce Availability",
        summary:
          "Colorado State University graduates 400+ nursing and allied health students annually. Fort Collins has 2,800 licensed healthcare professionals. UCHealth Poudre Valley employs 3,200, creating a deep local talent pool. Physician survey: 68% of Denver-based pediatric specialists expressed interest in part-time Fort Collins clinic rotations.",
        sourceName: "Colorado DORA License Database / CSU Health Sciences",
        retrievalDate: now,
        confidence: 78,
      },
    ])
    .returning();

  // --- 6. Hypotheses ---
  await db.insert(hypotheses).values([
    {
      clientId,
      type: "revenue" as const,
      statement:
        "A Fort Collins ambulatory clinic will capture 2,500-3,500 annual patient visits within 24 months, generating $35-50M in annual revenue based on the Briargate clinic precedent.",
      confidenceScore: 82,
      status: "confirmed" as const,
      dimensionScoreNpv: 85,
      dimensionScoreCost: 45,
      dimensionScoreEbitda: 78,
      scoringReasoning:
        "Briargate precedent strongly supports revenue projections. Larimer County has larger population and faster growth than El Paso County when Briargate launched. Revenue outlook is strong but initial ramp-up costs will pressure short-term EBITDA.",
      source: "broker_interview",
    },
    {
      clientId,
      type: "cost" as const,
      statement:
        "All-in occupancy costs of $32-38/sqft NNN are achievable in the Harmony Road corridor, with landlord TI contributions of $60-80/sqft reducing upfront capital requirements by $2.7-3.6M.",
      confidenceScore: 75,
      status: "proposed" as const,
      dimensionScoreNpv: 70,
      dimensionScoreCost: 90,
      dimensionScoreEbitda: 65,
      scoringReasoning:
        "Market data confirms NNN rates in range. TI contributions are typical for 10+ year healthcare leases. Cost optimization is strong; NPV benefits from reduced upfront capital.",
      source: "research",
    },
    {
      clientId,
      type: "space" as const,
      statement:
        "Initial 45,000 sqft with expansion rights to 60,000+ sqft within 5-7 years will accommodate projected headcount growth from 120 to 200+ staff.",
      confidenceScore: 70,
      status: "proposed" as const,
      dimensionScoreNpv: 75,
      dimensionScoreCost: 55,
      dimensionScoreEbitda: 72,
      scoringReasoning:
        "Growth projections align with demographic trends. Expansion rights add lease complexity but protect long-term NPV. May increase initial costs through must-take provisions.",
      source: "broker_interview",
    },
    {
      clientId,
      type: "operational" as const,
      statement:
        "Physician recruitment will accelerate by 40% with a Fort Collins presence, reducing per-provider recruitment costs from $85K to $55K based on lifestyle-driven relocation interest.",
      confidenceScore: 65,
      status: "proposed" as const,
      dimensionScoreNpv: 68,
      dimensionScoreCost: 72,
      dimensionScoreEbitda: 70,
      scoringReasoning:
        "Survey data shows strong physician interest in Fort Collins. Cost savings on recruitment are meaningful at scale. Operational efficiency gains compound over the lease term.",
      source: "research",
    },
    {
      clientId,
      type: "growth" as const,
      statement:
        "Larimer County's 15% decade-over-decade population growth, concentrated in the 25-44 age cohort, will sustain 8-12% annual patient volume increases for pediatric services.",
      confidenceScore: 80,
      status: "confirmed" as const,
      dimensionScoreNpv: 88,
      dimensionScoreCost: 40,
      dimensionScoreEbitda: 82,
      scoringReasoning:
        "Census data is robust and demographic trends are well-established. Growth projections have high confidence. Strong NPV and EBITDA impact from sustained volume growth.",
      source: "research",
    },
    {
      clientId,
      type: "risk" as const,
      statement:
        "UCHealth's expansion in Northern Colorado could capture 20-30% of projected patient volume if Children's Colorado delays Fort Collins entry beyond 2027.",
      confidenceScore: 72,
      status: "proposed" as const,
      dimensionScoreNpv: 30,
      dimensionScoreCost: 50,
      dimensionScoreEbitda: 35,
      scoringReasoning:
        "UCHealth is actively expanding in Fort Collins. Delay risk is real and quantifiable based on market share data. All financial dimensions suffer if competitor captures first-mover advantage.",
      source: "ai",
    },
  ]);

  // --- 7. Drivers ---
  await db.insert(drivers).values([
    {
      clientId,
      type: "revenue" as const,
      title: "Northern Colorado Patient Capture",
      description:
        "3,200 annual patient visits already originate from Larimer County to Aurora. A local clinic converts these long-distance visits plus captures new patients who currently use UCHealth or forgo specialty care.",
      impact: "high",
      supportingEvidence: [
        {
          source: "Broker Interview",
          quote:
            "Current patients in Larimer County drive 60+ miles to Aurora for specialty care",
          findingId: findingRows[2]?.id,
        },
        {
          source: "Research",
          quote:
            "3,200 annual patient visits originating from Larimer County",
          findingId: findingRows[2]?.id,
        },
      ],
    },
    {
      clientId,
      type: "revenue" as const,
      title: "Briargate Precedent Revenue Model",
      description:
        "The Briargate clinic achieved profitability in 18 months and generates $45M annually from 38,000 sqft. Fort Collins demographics are stronger, supporting equal or higher revenue projections.",
      impact: "high",
      supportingEvidence: [
        {
          source: "Research",
          quote:
            "Briargate satellite clinic achieved profitability within 18 months, generating $45M annual revenue from 38,000 sqft",
          findingId: findingRows[3]?.id,
        },
      ],
    },
    {
      clientId,
      type: "cost" as const,
      title: "Medical Office Lease Rates in Target Range",
      description:
        "Fort Collins Class A medical office asking rents of $26-32/sqft NNN fall within the $32-38/sqft all-in budget target. Landlord TI contributions of $60-80/sqft are achievable for 10+ year healthcare leases.",
      impact: "medium",
      supportingEvidence: [
        {
          source: "Research",
          quote:
            "Fort Collins medical office asking rents average $26-32/sqft NNN for Class A space",
          findingId: findingRows[1]?.id,
        },
        {
          source: "Broker Interview",
          quote: "Target all-in occupancy cost of $32-38/sqft NNN",
        },
      ],
    },
    {
      clientId,
      type: "cost" as const,
      title: "Medical Buildout Capital Requirements",
      description:
        "$3-5M tenant improvement investment required for imaging suites, procedure rooms, and lab space. This is partially offset by landlord TI contribution, reducing net capital outlay to $1.3-2.3M.",
      impact: "high",
      supportingEvidence: [
        {
          source: "Broker Interview",
          quote:
            "They'll invest $3-5M in tenant improvements for medical buildout. Prefer landlord TI contribution of $60-80/sqft.",
        },
      ],
    },
    {
      clientId,
      type: "operational" as const,
      title: "Physician Recruitment Advantage",
      description:
        "Fort Collins lifestyle appeal (outdoor recreation, university town, lower cost of living vs. Denver) accelerates specialist recruitment. 68% of Denver-based pediatric specialists expressed interest in clinic rotations.",
      impact: "high",
      supportingEvidence: [
        {
          source: "Broker Interview",
          quote:
            "Specialists want to live/work in Fort Collins rather than commuting to Aurora campus",
        },
        {
          source: "Research",
          quote:
            "68% of Denver-based pediatric specialists expressed interest in part-time Fort Collins clinic rotations",
          findingId: findingRows[5]?.id,
        },
      ],
    },
    {
      clientId,
      type: "space" as const,
      title: "Tight Medical Office Supply Favors Early Action",
      description:
        "With only 5.8% vacancy and limited new construction (85,000 sqft delivered in 2024), desirable medical office space in the Harmony corridor is scarce. Delay risks losing preferred sites to competing healthcare systems.",
      impact: "high",
      supportingEvidence: [
        {
          source: "Research",
          quote:
            "Vacancy is 5.8%, down from 8.2% in 2022. New medical office construction is limited with only 85,000 sqft delivered in 2024.",
          findingId: findingRows[1]?.id,
        },
        {
          source: "Broker Interview",
          quote:
            "Competition from UCHealth and Banner Health for the same corridors",
        },
      ],
    },
  ]);

  return true;
}

// --- Scenario Projections Data ---
function buildDemoProjections(): ScenarioProjectionData {
  return {
    generatedAt: new Date().toISOString(),
    assumptions: {
      currentSqft: 45000,
      currentSqftReasoning:
        "Based on broker input for proposed Fort Collins satellite clinic. Sized for 120 initial staff at ~375 sqft/person (higher density than standard office due to clinical space requirements including imaging, procedure rooms, and shared clinical areas).",
      marketRentPsf: 29,
      marketRentPsfReasoning:
        "CBRE Northern Colorado Q4 2024 report: Class A medical office asking rents $26-32/sqft NNN in Harmony corridor. Midpoint of $29/sqft used as base.",
      employeeCount: 120,
      employeeCountReasoning:
        "Broker growth expectations: 120-150 staff within 3 years. Starting with 120 (physicians, nurses, admin, allied health) based on planned departments: subspecialty clinics, urgent care, behavioral health, PT/OT.",
      annualGrowthRate: 0.065,
      annualGrowthRateReasoning:
        "Blended rate: 5-8% annual headcount growth per broker input, aligned with Larimer County's 15% decade population growth concentrated in family demographics. Conservative midpoint of 6.5%.",
      revenuePerEmployee: 52000,
      revenuePerEmployeeReasoning:
        "Based on healthcare clinic revenue per staff member: ~$52K/employee/year attributable to office space at full productivity.",
      opexPerSqft: 24,
      opexPerSqftReasoning:
        "Healthcare/biotech benchmark $20-30/sqft/year, Fort Collins secondary market adjustment. $24/sqft steady-state.",
      densityFactor: 375,
      densityFactorReasoning:
        "Higher density than standard office due to clinical space requirements including imaging, procedure rooms, and shared clinical areas. 375 sqft/person.",
      assumptionSources: [
        {
          assumption: "Current Sqft",
          source: "broker_interview",
          detail: "Broker specified 40,000-50,000 sqft target; 45,000 sqft midpoint used",
        },
        {
          assumption: "Market Rent PSF",
          source: "research",
          detail: "CBRE Northern Colorado Q4 2024: Class A medical office $26-32/sqft NNN",
        },
        {
          assumption: "Employee Count",
          source: "broker_interview",
          detail: "120-150 staff within 3 years per broker growth expectations",
        },
        {
          assumption: "Annual Growth Rate",
          source: "research",
          detail: "Larimer County 15% decade growth, family-age cohort 22% growth, broker expects 5-8% annual headcount growth",
        },
      ],
    },
    scenarios: {
      npvOptimized: {
        label: "NPV Optimized",
        description:
          "Maximizes long-term value by securing a 10-year lease with favorable escalation structure and investing in full medical buildout to capture maximum patient revenue from day one.",
        reasoning:
          "A 10-year term locks in current market rates during a period of tightening supply. Full buildout (imaging, procedure rooms, lab) enables comprehensive subspecialty services from opening, replicating the Briargate model that achieved profitability in 18 months. Higher upfront costs are offset by stronger revenue capture and landlord TI contributions amortized over the longer term.",
        idealSqft: 48000,
        leaseTerm: 10,
        yearlyProjections: [
          { year: 1, revenue: 18000000, leaseCost: 1632000, operationalCost: 2880000, cost: 4512000, netProfit: 13488000, sources: { revenue: "ai", leaseCost: "research", operationalCost: "ai" } },
          { year: 2, revenue: 32000000, leaseCost: 1681000, operationalCost: 2160000, cost: 3841000, netProfit: 28159000, sources: { revenue: "broker_interview", leaseCost: "research", operationalCost: "ai" } },
          { year: 3, revenue: 42000000, leaseCost: 1731000, operationalCost: 2225000, cost: 3956000, netProfit: 38044000, sources: { revenue: "broker_interview", leaseCost: "research", operationalCost: "ai" } },
          { year: 4, revenue: 44500000, leaseCost: 1783000, operationalCost: 2292000, cost: 4075000, netProfit: 40425000, sources: { revenue: "ai", leaseCost: "research", operationalCost: "ai" } },
          { year: 5, revenue: 47200000, leaseCost: 1836000, operationalCost: 2361000, cost: 4197000, netProfit: 43003000, sources: { revenue: "ai", leaseCost: "research", operationalCost: "ai" } },
          { year: 6, revenue: 50000000, leaseCost: 1891000, operationalCost: 2432000, cost: 4323000, netProfit: 45677000, sources: { revenue: "ai", leaseCost: "ai", operationalCost: "ai" } },
          { year: 7, revenue: 52800000, leaseCost: 1948000, operationalCost: 2505000, cost: 4453000, netProfit: 48347000, sources: { revenue: "ai", leaseCost: "ai", operationalCost: "ai" } },
          { year: 8, revenue: 55700000, leaseCost: 2006000, operationalCost: 2580000, cost: 4586000, netProfit: 51114000, sources: { revenue: "ai", leaseCost: "ai", operationalCost: "ai" } },
          { year: 9, revenue: 58800000, leaseCost: 2066000, operationalCost: 2657000, cost: 4723000, netProfit: 54077000, sources: { revenue: "ai", leaseCost: "ai", operationalCost: "ai" } },
          { year: 10, revenue: 62000000, leaseCost: 2128000, operationalCost: 2737000, cost: 4865000, netProfit: 57135000, sources: { revenue: "ai", leaseCost: "ai", operationalCost: "ai" } },
        ],
      },
      costOptimized: {
        label: "Cost Optimized",
        description:
          "Minimizes occupancy cost with a smaller 38,000 sqft footprint, 5-year initial term, and phased buildout — starting with core subspecialty clinics and adding imaging/lab in year 2-3.",
        reasoning:
          "Shorter term provides flexibility if patient volumes underperform. Smaller footprint with phased buildout reduces upfront capital by ~40%. Sacrifices some early revenue but preserves optionality. If successful, exercise expansion option at year 4-5.",
        idealSqft: 38000,
        leaseTerm: 5,
        yearlyProjections: [
          { year: 1, revenue: 12000000, leaseCost: 1178000, operationalCost: 1900000, cost: 3078000, netProfit: 8922000, sources: { revenue: "ai", leaseCost: "research", operationalCost: "ai" } },
          { year: 2, revenue: 22000000, leaseCost: 1213000, operationalCost: 1520000, cost: 2733000, netProfit: 19267000, sources: { revenue: "ai", leaseCost: "research", operationalCost: "ai" } },
          { year: 3, revenue: 30000000, leaseCost: 1250000, operationalCost: 1566000, cost: 2816000, netProfit: 27184000, sources: { revenue: "ai", leaseCost: "research", operationalCost: "ai" } },
          { year: 4, revenue: 33000000, leaseCost: 1287000, operationalCost: 1613000, cost: 2900000, netProfit: 30100000, sources: { revenue: "ai", leaseCost: "ai", operationalCost: "ai" } },
          { year: 5, revenue: 35500000, leaseCost: 1326000, operationalCost: 1661000, cost: 2987000, netProfit: 32513000, sources: { revenue: "ai", leaseCost: "ai", operationalCost: "ai" } },
        ],
      },
      ebitdaOptimized: {
        label: "EBITDA Optimized",
        description:
          "Balances revenue maximization against cost control with a 7-year term. Full clinical buildout but slightly smaller footprint (43,000 sqft) to optimize annual operating income.",
        reasoning:
          "7-year term balances long-term rate lock-in with flexibility. Full buildout enables comprehensive services (unlike cost-optimized) but slightly smaller footprint keeps per-sqft revenue higher. Targets fastest path to steady-state EBITDA by front-loading physician recruitment.",
        idealSqft: 43000,
        leaseTerm: 7,
        yearlyProjections: [
          { year: 1, revenue: 16000000, leaseCost: 1419000, operationalCost: 2400000, cost: 3819000, netProfit: 12181000, sources: { revenue: "ai", leaseCost: "research", operationalCost: "ai" } },
          { year: 2, revenue: 30000000, leaseCost: 1462000, operationalCost: 1860000, cost: 3322000, netProfit: 26678000, sources: { revenue: "broker_interview", leaseCost: "research", operationalCost: "ai" } },
          { year: 3, revenue: 40000000, leaseCost: 1506000, operationalCost: 1916000, cost: 3422000, netProfit: 36578000, sources: { revenue: "broker_interview", leaseCost: "research", operationalCost: "ai" } },
          { year: 4, revenue: 43500000, leaseCost: 1551000, operationalCost: 1973000, cost: 3524000, netProfit: 39976000, sources: { revenue: "ai", leaseCost: "ai", operationalCost: "ai" } },
          { year: 5, revenue: 46500000, leaseCost: 1598000, operationalCost: 2033000, cost: 3631000, netProfit: 42869000, sources: { revenue: "ai", leaseCost: "ai", operationalCost: "ai" } },
          { year: 6, revenue: 49500000, leaseCost: 1646000, operationalCost: 2094000, cost: 3740000, netProfit: 45760000, sources: { revenue: "ai", leaseCost: "ai", operationalCost: "ai" } },
          { year: 7, revenue: 52500000, leaseCost: 1695000, operationalCost: 2157000, cost: 3852000, netProfit: 48648000, sources: { revenue: "ai", leaseCost: "ai", operationalCost: "ai" } },
        ],
      },
    },
    confidence: 78,
  };
}
