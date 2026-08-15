import { Router } from "express";
import { authenticate, requirePasswordChanged } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";
import { listProductTypes } from "../controllers/masterData.controller";

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get("/", asyncHandler(listProductTypes));

export default router;
