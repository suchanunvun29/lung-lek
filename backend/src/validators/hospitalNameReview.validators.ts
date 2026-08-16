import { z } from "zod";

export const hospitalNameReviewIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const patchHospitalNameReviewSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("KEPT_SEPARATE"),
    note: z.string().trim().min(1).optional(),
  }),
  z.object({
    decision: z.literal("MERGED"),
    // Which of the two candidate hospitals stays as the canonical record — defaults to the one
    // tied to normalizedKeyA when omitted.
    mergedIntoId: z.string().min(1).optional(),
    note: z.string().trim().min(1).optional(),
  }),
]);

export type HospitalNameReviewIdParams = z.infer<typeof hospitalNameReviewIdParamsSchema>;
export type PatchHospitalNameReviewBody = z.infer<typeof patchHospitalNameReviewSchema>;
