import { Router } from "express";
import { Role } from "@prisma/client";
import {
  listAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
} from "../controllers/asset.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  listAssetsQuerySchema,
  createAssetSchema,
  updateAssetSchema,
  assetIdParamSchema,
} from "../validators/asset.validator";

const router = Router();

router.get("/", requireAuth, validate(listAssetsQuerySchema), listAssets);
router.post(
  "/",
  requireAuth,
  requireRole(Role.Admin),
  validate(createAssetSchema),
  createAsset,
);
router.get("/:id", requireAuth, validate(assetIdParamSchema), getAssetById);
router.put(
  "/:id",
  requireAuth,
  requireRole(Role.Admin),
  validate(updateAssetSchema),
  updateAsset,
);
router.delete(
  "/:id",
  requireAuth,
  requireRole(Role.Admin),
  validate(assetIdParamSchema),
  deleteAsset,
);

export default router;
