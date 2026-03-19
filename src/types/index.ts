// Interview template section/question types
export interface InterviewQuestion {
  id: string;
  text: string;
  type: string;
  purpose: string;
  order: number;
}

export interface InterviewSection {
  id: string;
  title: string;
  description: string;
  questions: InterviewQuestion[];
}

// Interview response types
export interface InterviewResponse {
  questionId: string;
  sectionId: string;
  response: string;
  notes?: string;
  followUps?: FollowUp[];
}

export interface FollowUp {
  question: string;
  response?: string;
  reasoning?: string;
}

// Supporting evidence types
export interface SupportingEvidence {
  source: string;
  quote: string;
  findingId?: string;
}

// Scenario projection types
export interface YearProjection {
  year: number;
  revenue: number;
  leaseCost?: number;         // base rent + escalations + CAM/NNN + TI amortization
  operationalCost?: number;   // utilities, maintenance, insurance, parking, IT, etc.
  cost: number;               // total: leaseCost + operationalCost (kept for backward compat)
  netProfit: number;
  sources?: {
    revenue?: string;           // "broker_interview" | "research" | "ai" | "user"
    leaseCost?: string;
    operationalCost?: string;
  };
}

export interface ScenarioDetail {
  label: string;
  description: string;
  reasoning?: string;
  idealSqft: number;
  leaseTerm: number;
  yearlyProjections: YearProjection[];
}

export interface AssumptionSource {
  assumption: string;
  source: string;
  detail: string;
}

export interface ScenarioProjectionData {
  generatedAt: string;
  assumptions: {
    currentSqft: number | null;
    currentSqftReasoning?: string;
    marketRentPsf: number | null;
    marketRentPsfReasoning?: string;
    employeeCount: number | null;
    employeeCountReasoning?: string;
    annualGrowthRate: number;
    annualGrowthRateReasoning?: string;
    revenuePerEmployee: number | null;
    revenuePerEmployeeReasoning?: string;
    opexPerSqft: number | null;
    opexPerSqftReasoning?: string;
    densityFactor: number | null;
    densityFactorReasoning?: string;
    rentEscalation: number | null;       // annual rent escalation rate (e.g. 0.03 = 3%)
    rentEscalationReasoning?: string;
    assumptionSources?: AssumptionSource[];
  };
  scenarios: {
    npvOptimized: ScenarioDetail;
    costOptimized: ScenarioDetail;
    ebitdaOptimized: ScenarioDetail;
  };
  confidence: number; // 0-100
}

// Multi-location projection types
export interface LocationMeta {
  locationId: string | null;
  name: string;
  city: string | null;
  state: string | null;
  locationType: string | null; // HQ, regional, satellite, coworking
}

export interface LocationProjection {
  location: LocationMeta;
  assumptions: ScenarioProjectionData["assumptions"];
  scenarios: ScenarioProjectionData["scenarios"];
  confidence: number;
}

export interface MultiLocationProjectionData {
  version: 2;
  generatedAt: string;
  locations: LocationProjection[];
}

export type StoredProjectionData =
  | ScenarioProjectionData
  | MultiLocationProjectionData;

// Client progress tracking
export type WorkflowStep =
  | "client_created"
  | "broker_interview"
  | "research"
  | "interview_builder"
  | "client_interview"
  | "insights";

export interface ClientProgress {
  clientCreated: boolean;
  enrichmentConfirmed: boolean;
  brokerInterviewComplete: boolean;
  researchComplete: boolean;
  interviewBuilderComplete: boolean;
  clientInterviewComplete: boolean;
  insightsGenerated: boolean;
}
