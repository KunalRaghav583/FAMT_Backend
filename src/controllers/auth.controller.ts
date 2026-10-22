import { Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../db/prisma";
import { hashPassword, comparePassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { AuthenticatedRequest, AuthenticatedUserPayload } from "../types/auth.types";
import { AppError } from "../errors/app.error";

export async function register(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name, email, password, role } = req.body;

    // Hash password before entering transaction to avoid holding database lock during bcrypt
    const passwordHash = await hashPassword(password);

    // Atomic transaction with PostgreSQL advisory lock prevents race conditions
    // during initial Admin bootstrap when multiple concurrent requests occur.
    const user = await prisma.$transaction(async (tx) => {
      // 742189 is an application-scoped integer key for user registration serialization
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(742189);`;

      // Check for existing user
      const existingUser = await tx.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new AppError("A user with this email already exists", 400);
      }

      // Role Assignment & Security Enforcement
      const userCount = await tx.user.count();
      let assignedRole: Role = Role.Viewer;

      if (userCount === 0) {
        // First system bootstrap user becomes Admin
        assignedRole = Role.Admin;
      } else if (req.user && req.user.role === Role.Admin) {
        // If the caller IS a logged-in Admin (valid token): Admin can set the role
        assignedRole = role && Object.values(Role).includes(role) ? role : Role.Viewer;
      } else {
        // If users exist and caller is NOT a logged-in Admin:
        // register is allowed, but the role is ALWAYS Viewer. Ignore any role sent in the body.
        assignedRole = Role.Viewer;
      }

      return tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: assignedRole,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });
    });

    res.status(201).json({
      message: "User registered successfully",
      user,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError("Invalid email or password", 401);
    }

    const payload: AuthenticatedUserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const token = signToken(payload);

    res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError("User account not found", 404);
    }

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

export async function logout(_req: AuthenticatedRequest, res: Response): Promise<void> {
  // Stateless JWT logout acknowledgment
  res.status(200).json({
    message:
      "Logged out successfully. Please discard the authentication token on the client.",
  });
}

export async function getTechnicians(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const technicians = await prisma.user.findMany({
      where: { role: Role.Technician },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });

    res.status(200).json({ technicians });
  } catch (error) {
    next(error);
  }
}

