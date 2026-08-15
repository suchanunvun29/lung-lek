import { Router } from "express";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { listSalespeople, updateSalesperson } from "../controllers/masterData.controller";
import { salespersonIdParamsSchema, updateSalespersonSchema } from "../validators/masterData.validators";

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get("/", asyncHandler(listSalespeople));

router.patch(
  "/:id",
  requireRole("MANAGER"),
  validate(salespersonIdParamsSchema, "params"),
  validate(updateSalespersonSchema, "body"),
  asyncHandler(updateSalesperson)
);

export default router;
