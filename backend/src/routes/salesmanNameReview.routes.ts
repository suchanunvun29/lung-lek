import { Router } from "express";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { decideSalesmanNameReview, listPendingSalesmanNameReviews } from "../controllers/salesmanNameReview.controller";
import { patchSalesmanNameReviewSchema, salesmanNameReviewIdParamsSchema } from "../validators/salesmanNameReview.validators";

const router = Router();

// Same gate as /hospital-name-reviews — merging salesperson identities moves every downstream
// number (lines, credits, targets, KPIs) and is part of the Module J security gate. MANAGER only.
router.use(authenticate, requirePasswordChanged, requireRole("MANAGER"));

router.get("/", asyncHandler(listPendingSalesmanNameReviews));

router.patch(
  "/:id",
  validate(salesmanNameReviewIdParamsSchema, "params"),
  validate(patchSalesmanNameReviewSchema, "body"),
  asyncHandler(decideSalesmanNameReview)
);

export default router;
