import { Router } from "express";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/territory.controller";
import * as v from "../validators/territory.validators";
const router = Router(); router.use(authenticate, requirePasswordChanged);
router.get("/", asyncHandler(c.listTerritories)); router.post("/", requireRole("MANAGER"), validate(v.territoryCreateSchema, "body"), asyncHandler(c.createTerritory)); router.patch("/:id", requireRole("MANAGER"), validate(v.territoryIdSchema, "params"), validate(v.territoryUpdateSchema, "body"), asyncHandler(c.updateTerritory));
export default router;
