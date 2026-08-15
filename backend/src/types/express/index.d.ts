import { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        displayName: string;
        role: UserRole;
        mustChangePassword: boolean;
      };
    }
  }
}

export {};
