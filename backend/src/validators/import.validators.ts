import { z } from "zod";

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
