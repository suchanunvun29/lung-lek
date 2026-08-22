import { z } from "zod";

const periodSchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

const targetPeriodsSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, z.array(periodSchema).min(1));

const confirmSchema = z.preprocess((value) => value === "true" || value === true, z.boolean());

export const importRequestSchema = z
  .object({
    mode: z.enum(["APPEND", "REPLACE_PERIOD"]).default("APPEND"),
    targetPeriods: targetPeriodsSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.mode === "REPLACE_PERIOD" && !value.targetPeriods) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["targetPeriods"], message: "targetPeriods is required" });
    }
    if (value.mode === "APPEND" && value.targetPeriods) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["targetPeriods"], message: "targetPeriods is only allowed for REPLACE_PERIOD" });
    }
  });

export const periodDeleteRequestSchema = z.object({
  targetPeriods: targetPeriodsSchema,
});

export const importConfirmQuerySchema = z.object({
  confirm: confirmSchema.default(false),
});

export type ImportRequest = z.infer<typeof importRequestSchema>;
export type PeriodDeleteRequest = z.infer<typeof periodDeleteRequestSchema>;
export type ImportConfirmQuery = z.infer<typeof importConfirmQuerySchema>;

export const importBatchIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const salesLinesQuerySchema = z.object({
  salespersonId: z.string().min(1).optional(),
  hospitalId: z.string().min(1).optional(),
  productTypeId: z.string().min(1).optional(),
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type SalesLinesQuery = z.infer<typeof salesLinesQuerySchema>;
