import { Response, NextFunction } from "express";
import { Prisma, Role, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../db/prisma";
import { AuthenticatedRequest } from "../types/auth.types";
import { AppError } from "../errors/app.error";

export async function listTickets(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      status,
      priority,
      assigneeId,
      assetId,
      page = 1,
      limit = 10,
    } = req.query as {
      status?: TicketStatus;
      priority?: TicketPriority;
      assigneeId?: string;
      assetId?: string;
      page?: number;
      limit?: number;
    };

    const pageNumber = Number(page) || 1;
    const pageSize = Number(limit) || 10;
    const skip = (pageNumber - 1) * pageSize;

    const where: Prisma.TicketWhereInput = {};

    if (status && Object.values(TicketStatus).includes(status)) {
      where.status = status;
    }

    if (priority && Object.values(TicketPriority).includes(priority)) {
      where.priority = priority;
    }

    if (assigneeId && assigneeId.trim().length > 0) {
      where.assigneeId = assigneeId.trim();
    }

    if (assetId && assetId.trim().length > 0) {
      where.assetId = assetId.trim();
    }

    const [total, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: {
          asset: {
            select: {
              id: true,
              name: true,
              serialNo: true,
              status: true,
              site: {
                select: {
                  id: true,
                  name: true,
                  location: true,
                },
              },
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          _count: {
            select: { comments: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    res.status(200).json({
      tickets,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTicketById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        asset: {
          include: {
            site: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        comments: {
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
        },
        _count: {
          select: { comments: true },
        },
      },
    });

    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }

    res.status(200).json({ ticket });
  } catch (error) {
    next(error);
  }
}

export async function createTicket(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    const { title, description, priority, dueDate, assetId, assigneeId, status } =
      req.body;

    // 1. Verify referenced asset exists
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
    });
    if (!asset) {
      throw new AppError("Referenced asset does not exist", 400);
    }

    // 2. If assignee is specified, verify user exists
    if (assigneeId) {
      const assigneeUser = await prisma.user.findUnique({
        where: { id: assigneeId },
      });
      if (!assigneeUser) {
        throw new AppError("Referenced assignee user does not exist", 400);
      }
      if (assigneeUser.role === Role.Viewer) {
        throw new AppError("Cannot assign a maintenance ticket to a Viewer user", 400);
      }
    }

    // 3. Create ticket with authenticated user as createdBy (prevent spoofing)
    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        priority,
        dueDate,
        assetId,
        assigneeId: assigneeId ?? null,
        status: status ?? TicketStatus.Open,
        createdBy: req.user.id,
      },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            serialNo: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        creator: {
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
      message: "Ticket created successfully",
      ticket,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTicket(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    const { id } = req.params;
    const { title, description, priority, dueDate, assetId, assigneeId, status } =
      req.body;

    const existingTicket = await prisma.ticket.findUnique({
      where: { id },
    });
    if (!existingTicket) {
      throw new AppError("Ticket not found", 404);
    }

    // Authorization check: Admin or assigned technician
    const isAdmin = req.user.role === Role.Admin;
    const isAssignee = existingTicket.assigneeId === req.user.id;

    if (!isAdmin && !isAssignee) {
      throw new AppError(
        "Forbidden: Only an Admin or the assigned technician can update this ticket",
        403,
      );
    }

    // Reopening rule: If closed ticket is being reopened, only Admin can reopen
    if (
      existingTicket.status === TicketStatus.Closed &&
      status &&
      status !== TicketStatus.Closed &&
      !isAdmin
    ) {
      throw new AppError("Forbidden: Only an Admin can reopen a closed ticket", 403);
    }

    // If updating asset, check existence
    if (assetId && assetId !== existingTicket.assetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: assetId },
      });
      if (!asset) {
        throw new AppError("Referenced asset does not exist", 400);
      }
    }

    // If updating assignee, check existence and role
    if (assigneeId !== undefined && assigneeId !== existingTicket.assigneeId) {
      if (assigneeId !== null) {
        const assigneeUser = await prisma.user.findUnique({
          where: { id: assigneeId },
        });
        if (!assigneeUser) {
          throw new AppError("Referenced assignee user does not exist", 400);
        }
        if (assigneeUser.role === Role.Viewer) {
          throw new AppError("Cannot assign a maintenance ticket to a Viewer user", 400);
        }
      }
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        title: title ?? existingTicket.title,
        description: description ?? existingTicket.description,
        priority: priority ?? existingTicket.priority,
        dueDate: dueDate ?? existingTicket.dueDate,
        assetId: assetId ?? existingTicket.assetId,
        assigneeId: assigneeId !== undefined ? assigneeId : existingTicket.assigneeId,
        status: status ?? existingTicket.status,
      },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            serialNo: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    res.status(200).json({
      message: "Ticket updated successfully",
      ticket: updatedTicket,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTicketStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }

    const { id } = req.params;
    const { status } = req.body as { status: TicketStatus };

    const existingTicket = await prisma.ticket.findUnique({
      where: { id },
    });
    if (!existingTicket) {
      throw new AppError("Ticket not found", 404);
    }

    // Authorization check: Admin or assigned technician
    const isAdmin = req.user.role === Role.Admin;
    const isAssignee = existingTicket.assigneeId === req.user.id;

    if (!isAdmin && !isAssignee) {
      throw new AppError(
        "Forbidden: Only an Admin or the assigned technician can move the status of this ticket",
        403,
      );
    }

    // Reopening rule: Admin can reopen a closed ticket
    if (
      existingTicket.status === TicketStatus.Closed &&
      status !== TicketStatus.Closed &&
      !isAdmin
    ) {
      throw new AppError("Forbidden: Only an Admin can reopen a closed ticket", 403);
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: { status },
      include: {
        asset: {
          select: {
            id: true,
            name: true,
            serialNo: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    res.status(200).json({
      message: "Ticket status updated successfully",
      ticket: updatedTicket,
    });
  } catch (error) {
    next(error);
  }
}
