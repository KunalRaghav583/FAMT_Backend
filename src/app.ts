import express, { Application, Request, Response } from "express";
import cors from "cors";
import { env } from "./config/env";
import apiRouter from "./routes";
import { errorHandler } from "./middleware/error.middleware";

const app: Application = express();

// Global Middlewares
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount API routes under /api
app.use("/api", apiRouter);

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
