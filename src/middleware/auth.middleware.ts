import { Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { AuthenticatedRequest } from "../types/auth.types";
import { verifyToken } from "../utils/jwt";
import { prisma } from "../db/prisma";
import { AppError } from "../errors/app.error";

export async function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Authorization token required", 401);
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new AppError("Authorization token missing", 401);
    }

    const payload = verifyToken(token);

    // Verify user exists in the current database state
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
      },
    });

    if (!user) {
      throw new AppError("User account no longer exists", 401);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token) {
        try {
          const payload = verifyToken(token);
          const user = await prisma.user.findUnique({
            where: { id: payload.id },
            select: {
              id: true,
              email: true,
              role: true,
              name: true,
            },
          });
          if (user) {
            req.user = user;
          }
        } catch {
          // Ignore invalid token for optional auth
        }
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(
        `Forbidden: role '${req.user.role}' is not authorized for this action`,
        403,
      );
    }

    next();
  };
}
