import { Router } from "express";
import { changePassword, login } from "../controllers/auth.controller";
import { authenticate } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { changePasswordSchema, loginSchema } from "../validators/auth.validators";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.post("/login", validate(loginSchema, "body"), asyncHandler(login));

router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema, "body"),
  asyncHandler(changePassword)
);

export default router;
