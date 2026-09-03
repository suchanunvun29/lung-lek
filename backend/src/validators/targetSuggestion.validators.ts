import { z } from "zod";

export const targetSuggestionParamsSchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

export const targetSuggestionQuerySchema = z.object({
  mode: z.enum(["SUGGEST", "REBALANCE"]).default("SUGGEST"),
  // Territory & Potential Rules ข้อ 5.1 — growth is a per-round screen value; the manager may
  // override it for this preview without saving it back into EvaluationSetting.
  targetGrowthRate: z.coerce.number().min(0).max(999.999).optional(),
});

export const reinstateDealBodySchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  mode: z.enum(["SUGGEST", "REBALANCE"]).default("SUGGEST"),
  reinstateInvoiceNos: z.array(z.string().trim().min(1)).min(1),
  targetGrowthRate: z.number().min(0).max(999.999).optional(),
});

export type TargetSuggestionParams = z.infer<typeof targetSuggestionParamsSchema>;
export type TargetSuggestionQuery = z.infer<typeof targetSuggestionQuerySchema>;
export type ReinstateDealBody = z.infer<typeof reinstateDealBodySchema>;
