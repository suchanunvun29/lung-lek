import { z } from "zod";
import { UserRole } from "@prisma/client";

const MIN_PASSWORD_LENGTH = 8;

const userRoleSchema = z.nativeEnum(UserRole);

export const userIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const createUserSchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(1),
  role: userRoleSchema,
  temporaryPassword: z.string().min(MIN_PASSWORD_LENGTH).optional(),
});

export const updateUserSchema = z
  .object({
    displayName: z.string().trim().min(1).optional(),
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
    salespersonId: z.string().min(1).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const resetPasswordSchema = z.object({
  temporaryPassword: z.string().min(MIN_PASSWORD_LENGTH).optional(),
});

export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
