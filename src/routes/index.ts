import { Router } from "express";
import { Role } from "@prisma/client";
import authRoutes from "./auth.routes";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

const apiRouter = Router();

apiRouter.use("/auth", authRoutes);

// Health check endpoint for deployment monitoring
apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Admin-only test endpoint to verify role-based access control
apiRouter.get("/test-admin-access", requireAuth, requireRole(Role.Admin), (_req, res) => {
  res.status(200).json({ message: "Admin access verified" });
});

export default apiRouter;
