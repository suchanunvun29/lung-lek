import { Router } from "express";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { listSalesmanNameRules, updateSalesmanNameRule } from "../controllers/salesmanNameRule.controller";
import { patchSalesmanNameRuleSchema, salesmanNameRuleIdParamsSchema } from "../validators/salesmanNameRule.validators";

const router = Router();

// Credit-share decisions feed straight into every salesperson's KPI numbers — MANAGER only.
router.use(authenticate, requirePasswordChanged, requireRole("MANAGER"));

router.get("/", asyncHandler(listSalesmanNameRules));

router.patch(
  "/:id",
  validate(salesmanNameRuleIdParamsSchema, "params"),
  validate(patchSalesmanNameRuleSchema, "body"),
  asyncHandler(updateSalesmanNameRule)
);

export default router;
