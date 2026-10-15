import { Router } from "express";
import { getDashboardSummary } from "../controllers/dashboard.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/summary", requireAuth, getDashboardSummary);

export default router;
