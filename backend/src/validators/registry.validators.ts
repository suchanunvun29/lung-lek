import { z } from "zod";

export const provinceIdParamsSchema = z.object({ id: z.string().min(1) });

export const updateProvinceSchema = z
  .object({
    canonicalName: z.string().trim().min(1).optional(),
    regionId: z.string().min(1).optional(),
  })
  .refine((value) => value.canonicalName !== undefined || value.regionId !== undefined, {
    message: "Provide canonicalName or regionId",
  });

export const registryLinkHospitalParamsSchema = z.object({ hospitalId: z.string().min(1) });

export const registryLinkQuerySchema = z.object({
  status: z.enum(["UNREVIEWED", "LINKED", "CONFIRMED_ABSENT"]).optional(),
});

export const hospitalRegistryQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  provinceMappingId: z.string().min(1).optional(),
  territoryId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const updateRegistryLinkSchema = z
  .object({
    hospitalRegistryId: z.string().min(1).nullable().optional(),
    status: z.enum(["LINKED", "CONFIRMED_ABSENT"]),
    note: z.string().trim().max(1000).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.status === "LINKED" && !value.hospitalRegistryId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["hospitalRegistryId"], message: "Required when status is LINKED" });
    }
    if (value.status === "CONFIRMED_ABSENT" && value.hospitalRegistryId !== null) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["hospitalRegistryId"], message: "Must be null when confirming absence" });
    }
  });

export type UpdateProvinceInput = z.infer<typeof updateProvinceSchema>;
export type UpdateRegistryLinkInput = z.infer<typeof updateRegistryLinkSchema>;
