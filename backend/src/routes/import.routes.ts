import { Router } from "express";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { uploadExcelFile } from "../middleware/upload";
import { asyncHandler } from "../utils/asyncHandler";
import { getImportBatch, listImportBatches, listSalesLines, periodDelete, uploadImport } from "../controllers/import.controller";
import { importBatchIdParamsSchema, importConfirmQuerySchema, importRequestSchema, periodDeleteRequestSchema, salesLinesQuerySchema } from "../validators/import.validators";

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.post(
  "/import",
  requireRole("MANAGER"),
  uploadExcelFile,
  validate(importRequestSchema),
  validate(importConfirmQuerySchema, "query"),
  asyncHandler(uploadImport)
);
router.post(
  "/import/period-delete",
  requireRole("MANAGER"),
  validate(periodDeleteRequestSchema),
  validate(importConfirmQuerySchema, "query"),
  asyncHandler(periodDelete)
);

router.get("/import-batches", asyncHandler(listImportBatches));

router.get(
  "/import-batches/:id",
  validate(importBatchIdParamsSchema, "params"),
  asyncHandler(getImportBatch)
);

router.get("/sales-lines", validate(salesLinesQuerySchema, "query"), asyncHandler(listSalesLines));

export default router;
