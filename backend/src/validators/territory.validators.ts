import { z } from "zod";

const nullableText = z.string().trim().min(1).nullable().optional();
const date = z.coerce.date();
const isFirstDayOfMonth = (value: Date) => value.getUTCDate() === 1;
const isLastDayOfMonth = (value: Date) => value.getUTCDate() === new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();

export const territoryIdSchema = z.object({ id: z.string().min(1) });
export const territoryCreateSchema = z.object({ name: z.string().trim().min(1), code: nullableText, regionId: nullableText, sortOrder: z.number().int().optional(), isActive: z.boolean().optional(), note: nullableText });
export const territoryUpdateSchema = territoryCreateSchema.partial().refine((value) => Object.keys(value).length > 0, "ต้องระบุข้อมูลที่ต้องการแก้ไข");
export const assignmentQuerySchema = z.object({ territoryId: z.string().min(1).optional(), salespersonId: z.string().min(1).optional(), status: z.enum(["ACTIVE", "INACTIVE"]).optional() });
export const assignmentBodySchema = z.object({ territoryId: z.string().min(1), salespersonId: z.string().min(1), effectiveFrom: date.optional(), effectiveTo: date.nullable().optional(), isSupervisor: z.boolean().optional(), note: nullableText }).superRefine((value, context) => {
  const hasEffectiveFrom = value.effectiveFrom !== undefined;
  const hasEffectiveTo = value.effectiveTo !== undefined && value.effectiveTo !== null;
  if (hasEffectiveFrom && hasEffectiveTo) context.addIssue({ code: z.ZodIssueCode.custom, path: ["effectiveTo"], message: "ห้ามส่ง effectiveFrom และ effectiveTo พร้อมกัน" });
  if (!hasEffectiveFrom && !hasEffectiveTo) context.addIssue({ code: z.ZodIssueCode.custom, path: ["effectiveFrom"], message: "ต้องระบุ effectiveFrom หรือ effectiveTo" });
});
export const hospitalTerritorySchema = z.object({ territoryId: z.string().min(1).nullable(), note: nullableText });
export const bulkProvinceSchema = z.object({ province: z.string().trim().min(1), territoryId: z.string().min(1), note: nullableText });
export const derivedTargetParamsSchema = z.object({ salespersonId: z.string().min(1), year: z.coerce.number().int(), month: z.coerce.number().int().min(1).max(12) });
export const territoryTargetParamsSchema = z.object({ territoryId: z.string().min(1), year: z.coerce.number().int(), month: z.coerce.number().int().min(1).max(12) });
export const targetBodySchema = z.object({ revenueTarget: z.number().nonnegative(), newCustomerTarget: z.number().int().nonnegative(), note: nullableText });
export const groupCreateSchema = z.object({ name: z.string().trim().min(1), isActive: z.boolean().optional(), note: nullableText });
export const groupUpdateSchema = groupCreateSchema.partial().refine((value) => Object.keys(value).length > 0, "ต้องระบุข้อมูลที่ต้องการแก้ไข");
export const groupMemberParamsSchema = z.object({ id: z.string().min(1), memberId: z.string().min(1) });
export const groupMemberBodySchema = z.object({
  territoryId: z.string().min(1),
  effectiveFrom: date.refine(isFirstDayOfMonth, "effectiveFrom ต้องเป็นวันแรกของเดือน"),
  effectiveTo: date.nullable().optional(),
}).superRefine((value, context) => {
  if (value.effectiveTo && !isLastDayOfMonth(value.effectiveTo)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["effectiveTo"], message: "effectiveTo ต้องเป็นวันสุดท้ายของเดือน" });
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) context.addIssue({ code: z.ZodIssueCode.custom, path: ["effectiveTo"], message: "effectiveTo ต้องไม่ก่อน effectiveFrom" });
});
export const groupMemberUpdateSchema = z.object({
  effectiveFrom: date.refine(isFirstDayOfMonth, "effectiveFrom ต้องเป็นวันแรกของเดือน").optional(),
  effectiveTo: date.nullable().optional(),
}).refine((value) => value.effectiveFrom !== undefined || value.effectiveTo !== undefined, "ต้องระบุช่วงเวลาที่ต้องการแก้ไข").superRefine((value, context) => {
  if (value.effectiveTo !== undefined && value.effectiveTo !== null && !isLastDayOfMonth(value.effectiveTo)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["effectiveTo"], message: "effectiveTo ต้องเป็นวันสุดท้ายของเดือน" });
  if (value.effectiveFrom && value.effectiveTo && value.effectiveTo < value.effectiveFrom) context.addIssue({ code: z.ZodIssueCode.custom, path: ["effectiveTo"], message: "effectiveTo ต้องไม่ก่อน effectiveFrom" });
});
export const groupTargetParamsSchema = z.object({ territoryGroupId: z.string().min(1), year: z.coerce.number().int(), month: z.coerce.number().int().min(1).max(12) });
