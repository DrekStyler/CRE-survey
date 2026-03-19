import { z } from "zod";

export const createClientSchema = z.object({
  legalName: z.string().min(1, "Company name is required").max(255),
  commonName: z.string().max(255).optional(),
  website: z.string().url("Invalid URL").max(500).optional().or(z.literal("")),
  emailDomain: z.string().max(255).optional(),
  industry: z.string().max(255).optional(),
  hqLocation: z.string().max(500).optional(),
  employeeEstimate: z.number().int().positive().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
