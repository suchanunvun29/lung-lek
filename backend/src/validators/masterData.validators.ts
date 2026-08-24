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

export const updateSalespersonSchema = z
  .object({
    userId: z.string().min(1).nullable().optional(),
    // OQ20 (2026-08-22): manager fills this in themselves once the real departure date is known.
    // date-only "YYYY-MM-DD" or null (= still employed / unknown yet).
    employmentEndedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD")
      .refine((value) => !Number.isNaN(Date.parse(value)), "วันที่ไม่ถูกต้อง")
      .nullable()
      .optional(),
  })
  .refine((body) => body.userId !== undefined || body.employmentEndedAt !== undefined, {
    message: "ต้องระบุอย่างน้อยหนึ่งฟิลด์",
  });

export type UpdateHospitalInput = z.infer<typeof updateHospitalSchema>;
export type UpdateSalespersonInput = z.infer<typeof updateSalespersonSchema>;
