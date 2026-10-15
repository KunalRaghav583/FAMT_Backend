import { Response, NextFunction } from "express";
import { prisma } from "../db/prisma";
import { AuthenticatedRequest } from "../types/auth.types";
import { AppError } from "../errors/app.error";

export async function listComments(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    const comments = await prisma.comment.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    res.status(200).json({ comments });
  } catch (error) {
    next(error);
  }
}

export async function createComment(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    const { id } = req.params;
    const { body } = req.body;

    // Verify ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    // Create comment with authenticated user's ID
    const comment = await prisma.comment.create({
      data: {
        ticketId: ticket.id,
        userId: req.user.id,
        body,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "Comment added successfully",
      comment,
    });
  } catch (error) {
    next(error);
  }
}
