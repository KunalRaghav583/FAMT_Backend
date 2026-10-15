import { Router } from "express";
import { Role } from "@prisma/client";
import authRoutes from "./auth.routes";
import siteRoutes from "./site.routes";
import assetRoutes from "./asset.routes";
import ticketRoutes from "./ticket.routes";
import dashboardRoutes from "./dashboard.routes";
import { requireAuth, requireRole } from "../middleware/auth.middleware";

const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/sites", siteRoutes);
apiRouter.use("/assets", assetRoutes);
apiRouter.use("/tickets", ticketRoutes);
apiRouter.use("/dashboard", dashboardRoutes);

// Health check endpoint for deployment monitoring
apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Admin-only test endpoint to verify role-based access control
apiRouter.get("/test-admin-access", requireAuth, requireRole(Role.Admin), (_req, res) => {
  res.status(200).json({ message: "Admin access verified" });
});

export default apiRouter;
