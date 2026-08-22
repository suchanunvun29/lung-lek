import { Router } from "express";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { listHospitals, updateHospital } from "../controllers/masterData.controller";
import { bulkByProvince, patchHospitalTerritory, unassignedHospitals } from "../controllers/territory.controller";
import { bulkProvinceSchema, hospitalTerritorySchema, territoryIdSchema } from "../validators/territory.validators";
import { hospitalIdParamsSchema, updateHospitalSchema } from "../validators/masterData.validators";

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get("/", asyncHandler(listHospitals));
router.get("/unassigned-territory", asyncHandler(unassignedHospitals));
router.post("/territory/bulk-by-province", requireRole("MANAGER"), validate(bulkProvinceSchema, "body"), asyncHandler(bulkByProvince));
router.patch("/:id/territory", requireRole("MANAGER"), validate(territoryIdSchema, "params"), validate(hospitalTerritorySchema, "body"), asyncHandler(patchHospitalTerritory));

router.patch(
  "/:id",
  requireRole("MANAGER"),
  validate(hospitalIdParamsSchema, "params"),
  validate(updateHospitalSchema, "body"),
  asyncHandler(updateHospital)
);

export default router;
