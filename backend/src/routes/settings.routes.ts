import { Router } from "express";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  getEvaluationSetting,
  getScoringWeights,
  updateEvaluationSetting,
  updateScoringWeights,
} from "../controllers/settings.controller";
import { evaluationSettingUpdateSchema, scoringWeightsUpdateSchema } from "../validators/settings.validators";

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

export default router;
