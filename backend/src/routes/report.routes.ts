import { Router } from "express";
import { authenticate, requirePasswordChanged } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import {
  exportIndividualReport,
  exportTeamOverviewReport,
  getIndividualReport,
  getTeamOverviewReport,
} from "../controllers/report.controller";
import { periodQuerySchema, salespersonIdParamsSchema } from "../validators/kpi.validators";
import { exportTerritoryOverview, getTerritoryOverview } from "../controllers/territoryOverview.controller";

const router = Router();

// Same "auth gates actions, not visibility" pattern as /kpi, /leaderboard, /targets — both
// roles can view and export any report, matching requirement.md's "everyone sees everything,
// only editing is role-gated" rule.
router.use(authenticate, requirePasswordChanged);

router.get(
  "/individual/:salespersonId",
  validate(salespersonIdParamsSchema, "params"),
  validate(periodQuerySchema, "query"),
  asyncHandler(getIndividualReport)
);

router.get(
  "/individual/:salespersonId/export",
  validate(salespersonIdParamsSchema, "params"),
  validate(periodQuerySchema, "query"),
  asyncHandler(exportIndividualReport)
);

router.get("/team-overview", validate(periodQuerySchema, "query"), asyncHandler(getTeamOverviewReport));
router.get("/territory-overview", validate(periodQuerySchema, "query"), asyncHandler(getTerritoryOverview));
router.get("/territory-overview/export", validate(periodQuerySchema, "query"), asyncHandler(exportTerritoryOverview));

router.get(
  "/team-overview/export",
  validate(periodQuerySchema, "query"),
  asyncHandler(exportTeamOverviewReport)
);

export default router;
