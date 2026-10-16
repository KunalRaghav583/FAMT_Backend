import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import apiRouter from "./routes";
import { apiLimiter } from "./middleware/rate-limit.middleware";
import { errorHandler } from "./middleware/error.middleware";

const app: Application = express();

// Security & Parsing Middlewares
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

// Mount rate-limited API routes under /api
app.use("/api", apiLimiter, apiRouter);

// Root greeting & info
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    name: "Field Asset Maintenance Tracker API",
    version: "1.0.0",
    docs: "/api/health",
  });
});

// 404 Route Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
