import { Router } from "express";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  copyTargets,
  getTargetRevisions,
  listTargets,
  updateProductGroupTargets,
  upsertTarget,
} from "../controllers/target.controller";
import {
  copyTargetsSchema,
  productGroupTargetsBodySchema,
  targetIdParamsSchema,
  targetUpsertBodySchema,
  targetUpsertParamsSchema,
  targetsQuerySchema,
} from "../validators/target.validators";

const router = Router();

// Auth only gates who can write — every authenticated role sees target data, per design.md's
// "auth gates actions, not visibility" rule (same pattern as /sales-lines, /hospitals, /salespeople).
router.use(authenticate, requirePasswordChanged);

router.get("/", validate(targetsQuerySchema, "query"), asyncHandler(listTargets));

router.put(
  "/:salespersonId/:year/:month",
  requireRole("MANAGER"),
  validate(targetUpsertParamsSchema, "params"),
  validate(targetUpsertBodySchema, "body"),
  asyncHandler(upsertTarget)
);

router.put(
  "/:targetId/product-groups",
  requireRole("MANAGER"),
  validate(targetIdParamsSchema, "params"),
  validate(productGroupTargetsBodySchema, "body"),
  asyncHandler(updateProductGroupTargets)
);

router.post("/copy", requireRole("MANAGER"), validate(copyTargetsSchema, "body"), asyncHandler(copyTargets));

router.get(
  "/:targetId/revisions",
  validate(targetIdParamsSchema, "params"),
  asyncHandler(getTargetRevisions)
);

export default router;
