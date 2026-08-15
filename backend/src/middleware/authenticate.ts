import { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { verifyAuthToken } from "../utils/jwt";

const BEARER_PREFIX = "Bearer ";

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = header.slice(BEARER_PREFIX.length);

  let payload;
  try {
    payload = verifyAuthToken(token);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "User not found or inactive" });
  }

  req.user = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };

  next();
}

export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

// Blocks access to the rest of the app until the user completes the forced
// first-login password change, per design.md's mustChangePassword contract.
export function requirePasswordChanged(req: Request, res: Response, next: NextFunction) {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({ error: "Password change required", code: "MUST_CHANGE_PASSWORD" });
  }
  next();
}
