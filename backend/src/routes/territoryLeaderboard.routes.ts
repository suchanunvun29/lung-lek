import { Router } from "express";
import { authenticate, requirePasswordChanged } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/territoryLeaderboard.controller";
import { territoryLeaderboardDrillParams, territoryLeaderboardQuerySchema } from "../validators/territoryLeaderboard.validators";

const router = Router();
router.use(authenticate, requirePasswordChanged);
router.get("/territories", validate(territoryLeaderboardQuerySchema, "query"), asyncHandler(c.getTerritoryLeaderboard));
router.get("/territories/export", validate(territoryLeaderboardQuerySchema, "query"), asyncHandler(c.exportTerritoryLeaderboard));
router.get("/territories/:territoryId/people", validate(territoryLeaderboardDrillParams, "params"), validate(territoryLeaderboardQuerySchema, "query"), asyncHandler(c.getTerritoryPeople));
export default router;
