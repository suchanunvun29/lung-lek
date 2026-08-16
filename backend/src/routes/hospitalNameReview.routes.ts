import { Router } from "express";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { decideHospitalNameReview, listPendingHospitalNameReviews } from "../controllers/hospitalNameReview.controller";
import { hospitalNameReviewIdParamsSchema, patchHospitalNameReviewSchema } from "../validators/hospitalNameReview.validators";

const router = Router();

// Merging/keeping-separate hospital identities touches every downstream KPI number and is
// itself part of the Module J security gate — MANAGER only, no read access for SALESPERSON.
router.use(authenticate, requirePasswordChanged, requireRole("MANAGER"));

router.get("/", asyncHandler(listPendingHospitalNameReviews));

router.patch(
  "/:id",
  validate(hospitalNameReviewIdParamsSchema, "params"),
  validate(patchHospitalNameReviewSchema, "body"),
  asyncHandler(decideHospitalNameReview)
);

export default router;
