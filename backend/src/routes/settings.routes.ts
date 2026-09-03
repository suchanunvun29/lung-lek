import { Router } from "express";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  getEvaluationSetting,
  getScoringWeights,
  getTierWeights,
  updateEvaluationSetting,
  updateScoringWeights,
  updateTierWeights,
} from "../controllers/settings.controller";
import {
  evaluationSettingUpdateSchema,
  scoringWeightsUpdateSchema,
  tierWeightsUpdateSchema,
} from "../validators/settings.validators";

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get("/scoring-weights", asyncHandler(getScoringWeights));
router.put(
  "/scoring-weights",
  requireRole("MANAGER"),
  validate(scoringWeightsUpdateSchema, "body"),
  asyncHandler(updateScoringWeights)
);

router.get("/evaluation", asyncHandler(getEvaluationSetting));
router.patch(
  "/evaluation",
  requireRole("MANAGER"),
  validate(evaluationSettingUpdateSchema, "body"),
  asyncHandler(updateEvaluationSetting)
);

// Module L — tier weights are MANAGER-only on both ends (plan.md Phase 10)
router.get("/tier-weights", requireRole("MANAGER"), asyncHandler(getTierWeights));
router.patch(
  "/tier-weights",
  requireRole("MANAGER"),
  validate(tierWeightsUpdateSchema, "body"),
  asyncHandler(updateTierWeights)
);

export default router;
