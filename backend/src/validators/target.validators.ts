import { z } from "zod";

export const targetsQuerySchema = z.object({
  year: z.coerce.number().int(),
});

export const targetUpsertParamsSchema = z.object({
  salespersonId: z.string().min(1),
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

export const targetUpsertBodySchema = z.object({
  revenueTarget: z.number().nonnegative(),
  newCustomerTarget: z.number().int().nonnegative(),
  note: z.string().trim().min(1).nullable().optional(),
});

export const targetIdParamsSchema = z.object({
  targetId: z.string().min(1),
});

export const productGroupTargetsBodySchema = z.object({
  productGroups: z.array(
    z.object({
      productTypeId: z.string().min(1),
      revenueTarget: z.number().nonnegative(),
    })
  ),
});

export const copyTargetsSchema = z
  .object({
    fromYear: z.coerce.number().int(),
    fromMonth: z.coerce.number().int().min(1).max(12),
    toYear: z.coerce.number().int(),
    toMonth: z.coerce.number().int().min(1).max(12),
    overwrite: z.boolean().optional().default(false),
  })
  .refine((data) => data.fromYear !== data.toYear || data.fromMonth !== data.toMonth, {
    message: "ปลายทางต้องเป็นคนละงวดกับต้นทาง",
    path: ["toMonth"],
  });

export type TargetsQuery = z.infer<typeof targetsQuerySchema>;
export type TargetUpsertParams = z.infer<typeof targetUpsertParamsSchema>;
export type TargetUpsertBody = z.infer<typeof targetUpsertBodySchema>;
export type TargetIdParams = z.infer<typeof targetIdParamsSchema>;
export type ProductGroupTargetsBody = z.infer<typeof productGroupTargetsBodySchema>;
export type CopyTargetsBody = z.infer<typeof copyTargetsSchema>;
