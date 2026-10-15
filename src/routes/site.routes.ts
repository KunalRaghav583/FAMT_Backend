import { Router } from "express";
import { Role } from "@prisma/client";
import {
  listSites,
  getSiteById,
  createSite,
  updateSite,
  deleteSite,
} from "../controllers/site.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  createSiteSchema,
  updateSiteSchema,
  siteIdParamSchema,
} from "../validators/site.validator";

const router = Router();

router.get("/", requireAuth, listSites);
router.post(
  "/",
  requireAuth,
  requireRole(Role.Admin),
  validate(createSiteSchema),
  createSite,
);
router.get("/:id", requireAuth, validate(siteIdParamSchema), getSiteById);
router.put(
  "/:id",
  requireAuth,
  requireRole(Role.Admin),
  validate(updateSiteSchema),
  updateSite,
);
router.delete(
  "/:id",
  requireAuth,
  requireRole(Role.Admin),
  validate(siteIdParamSchema),
  deleteSite,
);

export default router;
