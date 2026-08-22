import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { generateTemporaryPassword } from "../utils/password";
import { CreateUserInput, ResetPasswordInput, UpdateUserInput } from "../validators/user.validators";

const BCRYPT_SALT_ROUNDS = 10;

const userWithSalespersonSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  salesperson: { select: { id: true, displayName: true, nameInFile: true } },
} satisfies Prisma.UserSelect;

export async function listUsers(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    select: userWithSalespersonSelect,
    orderBy: { createdAt: "asc" },
  });
  res.json({ users: users.map((user) => ({ ...user, isSalespersonLinked: user.role !== "SALESPERSON" || user.salesperson !== null })) });
}

export async function createUser(req: Request, res: Response) {
  const { email, displayName, role, temporaryPassword } = req.body as CreateUserInput;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "A user with this email already exists" });
  }

  const plainPassword = temporaryPassword ?? generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { email, displayName, role, passwordHash, mustChangePassword: true },
    select: userWithSalespersonSelect,
  });

  res.status(201).json({ user, temporaryPassword: plainPassword });
}

export async function updateUser(req: Request, res: Response) {
  const { id } = req.params;
  const { displayName, role, isActive, salespersonId } = req.body as UpdateUserInput;

  const existingUser = await prisma.user.findUnique({ where: { id } });
  if (!existingUser) {
    return res.status(404).json({ error: "User not found" });
  }

  if (isActive === false && id === req.user!.id) {
    return res.status(400).json({ error: "Cannot deactivate your own account" });
  }

  try {
    const updatedUser = await prisma.$transaction(async (tx) => {
      if (salespersonId !== undefined) {
        if (salespersonId === null) {
          await tx.salesperson.updateMany({
            where: { userId: id },
            data: { userId: null },
          });
        } else {
          const targetSalesperson = await tx.salesperson.findUnique({ where: { id: salespersonId } });
          if (!targetSalesperson) {
            throw new HttpError(404, "Salesperson not found");
          }
          if (targetSalesperson.userId && targetSalesperson.userId !== id) {
            throw new HttpError(409, "This salesperson is already linked to another user");
          }

          await tx.salesperson.updateMany({
            where: { userId: id, id: { not: salespersonId } },
            data: { userId: null },
          });
          await tx.salesperson.update({
            where: { id: salespersonId },
            data: { userId: id },
          });
        }
      }

      return tx.user.update({
        where: { id },
        data: {
          ...(displayName !== undefined ? { displayName } : {}),
          ...(role !== undefined ? { role } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
        select: userWithSalespersonSelect,
      });
    });

    res.json({ user: updatedUser });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }
    throw error;
  }
}

export async function resetPassword(req: Request, res: Response) {
  const { id } = req.params;
  const { temporaryPassword } = req.body as ResetPasswordInput;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const plainPassword = temporaryPassword ?? generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);

  await prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true },
  });

  res.json({ message: "Password reset", temporaryPassword: plainPassword });
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
