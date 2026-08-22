import { Router } from "express";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { uploadExcelFile } from "../middleware/upload";
import * as controller from "../controllers/registry.controller";
import * as validators from "../validators/registry.validators";

export const provinceRouter = Router();
provinceRouter.use(authenticate, requirePasswordChanged);
provinceRouter.get("/", asyncHandler(controller.listProvinces));
provinceRouter.patch("/:id", requireRole("MANAGER"), validate(validators.provinceIdParamsSchema, "params"), validate(validators.updateProvinceSchema), asyncHandler(controller.updateProvince));

const registryRouter = Router();
registryRouter.use(authenticate, requirePasswordChanged, requireRole("MANAGER"));
registryRouter.post("/registry-import", uploadExcelFile, asyncHandler(controller.uploadRegistry));
registryRouter.get("/hospital-registries", validate(validators.hospitalRegistryQuerySchema, "query"), asyncHandler(controller.listHospitalRegistries));
registryRouter.get("/hospital-registry-links", validate(validators.registryLinkQuerySchema, "query"), asyncHandler(controller.listRegistryLinks));
registryRouter.patch("/hospital-registry-links/:hospitalId", validate(validators.registryLinkHospitalParamsSchema, "params"), validate(validators.updateRegistryLinkSchema), asyncHandler(controller.updateRegistryLink));

export default registryRouter;
