import { Router } from "express";
import { authenticate, requirePasswordChanged } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { getLeaderboard } from "../controllers/leaderboard.controller";
import { leaderboardQuerySchema } from "../validators/leaderboard.validators";

const router = Router();

// Same "auth gates actions, not visibility" rule as /kpi, /targets, /sales-lines — every
// authenticated role sees the same leaderboard.
router.use(authenticate, requirePasswordChanged);

router.get("/", validate(leaderboardQuerySchema, "query"), asyncHandler(getLeaderboard));

export default router;
