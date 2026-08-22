import { Router } from "express";
import { authenticate, requirePasswordChanged, requireRole } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { listProducts, updateProduct } from "../controllers/product.controller";
import { productIdParamsSchema, updateProductSchema } from "../validators/product.validators";

const router = Router();

router.use(authenticate, requirePasswordChanged);

router.get("/", asyncHandler(listProducts));

router.patch(
  "/:id",
  requireRole("MANAGER"),
  validate(productIdParamsSchema, "params"),
  validate(updateProductSchema, "body"),
  asyncHandler(updateProduct)
);

export default router;
