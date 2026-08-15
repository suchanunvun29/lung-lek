import { Router } from "express";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { uploadExcelFile } from "../middleware/upload";
import { asyncHandler } from "../utils/asyncHandler";
import { getImportBatch, listImportBatches, listSalesLines, uploadImport } from "../controllers/import.controller";
import { importBatchIdParamsSchema, salesLinesQuerySchema } from "../validators/import.validators";

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.post("/import", requireRole("MANAGER"), uploadExcelFile, asyncHandler(uploadImport));

router.get("/import-batches", asyncHandler(listImportBatches));

router.get(
  "/import-batches/:id",
  validate(importBatchIdParamsSchema, "params"),
  asyncHandler(getImportBatch)
);

router.get("/sales-lines", validate(salesLinesQuerySchema, "query"), asyncHandler(listSalesLines));

export default router;
