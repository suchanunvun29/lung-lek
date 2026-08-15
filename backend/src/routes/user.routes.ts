import { Router } from "express";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { createUser, listUsers, resetPassword, updateUser } from "../controllers/user.controller";
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  userIdParamsSchema,
} from "../validators/user.validators";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate, requirePasswordChanged, requireRole("MANAGER"));

router.get("/", asyncHandler(listUsers));

router.post("/", validate(createUserSchema, "body"), asyncHandler(createUser));

router.patch(
  "/:id",
  validate(userIdParamsSchema, "params"),
  validate(updateUserSchema, "body"),
  asyncHandler(updateUser)
);

router.post(
  "/:id/reset-password",
  validate(userIdParamsSchema, "params"),
  validate(resetPasswordSchema, "body"),
  asyncHandler(resetPassword)
);

export default router;
