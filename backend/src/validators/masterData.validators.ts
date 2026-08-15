import { z } from "zod";

export const hospitalIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const updateHospitalSchema = z.object({
  isPreExistingCustomer: z.boolean(),
});

export const salespersonIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const updateSalespersonSchema = z.object({
  userId: z.string().min(1).nullable(),
});

export type UpdateHospitalInput = z.infer<typeof updateHospitalSchema>;
export type UpdateSalespersonInput = z.infer<typeof updateSalespersonSchema>;
