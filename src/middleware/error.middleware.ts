import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { AppError } from "../errors/app.error";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => e.message).join(", ");
    res.status(400).json({ error: message || "Validation error" });
    return;
  }

  // 2. Custom App Errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // 3. JWT Errors
  if (err instanceof TokenExpiredError) {
    res.status(401).json({ error: "Token expired, please log in again" });
    return;
  }

  if (err instanceof JsonWebTokenError) {
    res.status(401).json({ error: "Invalid authentication token" });
    return;
  }

  // 4. Prisma Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta?.target as string[]).join(", ")
        : "unique field";
      res.status(400).json({ error: `A record with this ${target} already exists` });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Resource not found" });
      return;
    }
    if (err.code === "P2003") {
      res.status(400).json({
        error: "Invalid reference: related resource does not exist or cannot be deleted",
      });
      return;
    }
  }

  // 5. Default Internal Server Error
  console.error("Unhandled Error:", err);
  res.status(500).json({ error: "Internal server error" });
}
