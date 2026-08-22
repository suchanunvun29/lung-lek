import { Router } from "express";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/territory.controller";
import * as v from "../validators/territory.validators";

const router = Router();
router.use(authenticate, requirePasswordChanged);
router.get("/", asyncHandler(c.listGroups));
router.post("/", requireRole("MANAGER"), validate(v.groupCreateSchema, "body"), asyncHandler(c.createGroup));
router.patch("/:id", requireRole("MANAGER"), validate(v.territoryIdSchema, "params"), validate(v.groupUpdateSchema, "body"), asyncHandler(c.updateGroup));
router.post("/:id/members", requireRole("MANAGER"), validate(v.territoryIdSchema, "params"), validate(v.groupMemberBodySchema, "body"), asyncHandler(c.addGroupMember));
router.patch("/:id/members/:memberId", requireRole("MANAGER"), validate(v.groupMemberParamsSchema, "params"), validate(v.groupMemberUpdateSchema, "body"), asyncHandler(c.updateGroupMember));

export default router;
