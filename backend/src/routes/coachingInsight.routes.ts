import { Router } from "express";
import { authenticate, requirePasswordChanged } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { generateInsight, getInsight } from "../controllers/coachingInsight.controller";
import { generateInsightBodySchema } from "../validators/coachingInsight.validators";
import { periodQuerySchema, salespersonIdParamsSchema } from "../validators/kpi.validators";

const router = Router();

// Reading a coaching insight is open to everyone, same "auth gates actions, not visibility"
// pattern as /kpi and /targets. Generating one is gated inside the controller instead of here:
// MANAGER-only, per requirement.md's 2026-08-16 decision.
router.use(authenticate, requirePasswordChanged);

router.get(
  "/:salespersonId",
  validate(salespersonIdParamsSchema, "params"),
  validate(periodQuerySchema, "query"),
  asyncHandler(getInsight)
);

router.post(
  "/:salespersonId/generate",
  validate(salespersonIdParamsSchema, "params"),
  validate(generateInsightBodySchema, "body"),
  asyncHandler(generateInsight)
);

export default router;
