import { Router } from "express";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { listHospitals, updateHospital } from "../controllers/masterData.controller";
import { hospitalIdParamsSchema, updateHospitalSchema } from "../validators/masterData.validators";

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get("/", asyncHandler(listHospitals));

router.patch(
  "/:id",
  requireRole("MANAGER"),
  validate(hospitalIdParamsSchema, "params"),
  validate(updateHospitalSchema, "body"),
  asyncHandler(updateHospital)
);

export default router;
