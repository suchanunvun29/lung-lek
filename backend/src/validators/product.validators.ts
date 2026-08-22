import { z } from "zod";

export const productIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const updateProductSchema = z
  .object({
    code: z.string().trim().min(1).nullable().optional(),
    displayName: z.string().trim().min(1).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.code !== undefined || data.displayName !== undefined || data.isActive !== undefined, {
    message: "ต้องระบุอย่างน้อยหนึ่งฟิลด์ (code / displayName / isActive)",
  });

export type ProductIdParams = z.infer<typeof productIdParamsSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
