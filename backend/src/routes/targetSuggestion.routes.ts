import { Router } from "express";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { getTargetSuggestions, reinstateDeal } from "../controllers/targetSuggestion.controller";
import { reinstateDealBodySchema, targetSuggestionParamsSchema, targetSuggestionQuerySchema } from "../validators/targetSuggestion.validators";

const router = Router();

// Phase 10 — target-assist is a MANAGER surface (plan.md): it exposes every salesperson's
// territory figures and is the input to target-setting.
router.use(authenticate, requirePasswordChanged, requireRole("MANAGER"));

router.post("/reinstate-deal", validate(reinstateDealBodySchema, "body"), asyncHandler(reinstateDeal));
router.get("/:year/:month", validate(targetSuggestionParamsSchema, "params"), validate(targetSuggestionQuerySchema, "query"), asyncHandler(getTargetSuggestions));

export default router;
