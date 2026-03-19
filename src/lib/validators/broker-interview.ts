import { z } from "zod";

export const brokerInterviewSchema = z.object({
  brokerHypothesis: z.string().optional(),
  knownClientIssues: z.string().optional(),
  marketConstraints: z.string().optional(),
  currentFootprint: z.any().optional(),
  budgetSignals: z.string().optional(),
  timing: z.string().optional(),
  painPoints: z.string().optional(),
  growthExpectations: z.string().optional(),
  additionalNotes: z.string().optional(),
});

export type BrokerInterviewInput = z.infer<typeof brokerInterviewSchema>;
