import { Router } from "express";
import { authenticate, requirePasswordChanged } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/territoryKpi.controller";
import { periodQuerySchema } from "../validators/kpi.validators";
import { territoryDrillDownParamsSchema, territoryIdParamsSchema } from "../validators/territoryKpi.validators";

const router = Router();
router.use(authenticate, requirePasswordChanged);
router.get("/team", validate(periodQuerySchema, "query"), asyncHandler(c.getTeamTerritoryKpi));
router.get("/:territoryId/drill-down/:metric", validate(territoryDrillDownParamsSchema, "params"), validate(periodQuerySchema, "query"), asyncHandler(c.territoryDrillDown));
router.get("/:territoryId", validate(territoryIdParamsSchema, "params"), validate(periodQuerySchema, "query"), asyncHandler(c.getTerritoryKpi));
export default router;
