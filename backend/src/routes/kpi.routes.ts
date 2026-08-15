import { Router } from "express";
import { authenticate, requirePasswordChanged } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { getDrillDown, getSalespersonKpi, getTeamKpi } from "../controllers/kpi.controller";
import {
  drillDownParamsSchema,
  drillDownQuerySchema,
  periodQuerySchema,
  salespersonIdParamsSchema,
} from "../validators/kpi.validators";

const router = Router();

// Everyone who is authenticated sees the same business data — auth only gates who can write
// (same "auth gates actions, not visibility" rule as /targets, /sales-lines, /hospitals).
router.use(authenticate, requirePasswordChanged);

router.get("/team", validate(periodQuerySchema, "query"), asyncHandler(getTeamKpi));

router.get(
  "/:salespersonId",
  validate(salespersonIdParamsSchema, "params"),
  validate(periodQuerySchema, "query"),
  asyncHandler(getSalespersonKpi)
);

router.get(
  "/:salespersonId/drill-down/:metric",
  validate(drillDownParamsSchema, "params"),
  validate(drillDownQuerySchema, "query"),
  asyncHandler(getDrillDown)
);

export default router;
