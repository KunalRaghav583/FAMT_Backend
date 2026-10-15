import { Response, NextFunction } from "express";
import { Prisma, Role, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../db/prisma";
import { AuthenticatedRequest } from "../types/auth.types";
import { AppError } from "../errors/app.error";

// Allowed status workflow transitions: Open -> In progress -> Resolved -> Closed
const ALLOWED_FORWARD_STATUS: Record<TicketStatus, TicketStatus> = {
  [TicketStatus.Open]: TicketStatus.In_progress,
  [TicketStatus.In_progress]: TicketStatus.Resolved,
  [TicketStatus.Resolved]: TicketStatus.Closed,
  [TicketStatus.Closed]: TicketStatus.Open, // Reopening: handled with Admin check
};

function validateStatusTransition(
  currentStatus: TicketStatus,
  targetStatus: TicketStatus,
  isAdmin: boolean,
): void {
  if (currentStatus === targetStatus) {
    return; // No-op, allowed
  }

  // Reopening check
  if (currentStatus === TicketStatus.Closed) {
    if (targetStatus === TicketStatus.Open) {
      if (!isAdmin) {
        throw new AppError("Forbidden: Only an Admin can reopen a closed ticket", 403);
      }
      return;
    }
    throw new AppError(
      `Invalid status transition from '${currentStatus}' to '${targetStatus}'. A closed ticket can only be reopened to 'Open' by an Admin.`,
      400,
    );
  }

  // If closed is targeted from any status other than Resolved:
  if (targetStatus === TicketStatus.Closed && currentStatus !== TicketStatus.Resolved) {
    throw new AppError(
      `Invalid status transition from '${currentStatus}' to 'Closed'. Tickets must be Resolved before they can be Closed.`,
      400,
    );
  }

  // Admin supervisory override: Admin can move Open -> Resolved directly
  if (
    isAdmin &&
    currentStatus === TicketStatus.Open &&
    targetStatus === TicketStatus.Resolved
  ) {
    return;
  }

  // General sequential flow check: Open -> In progress -> Resolved -> Closed
  const expectedNext = ALLOWED_FORWARD_STATUS[currentStatus];
  if (targetStatus !== expectedNext) {
    throw new AppError(
      `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Workflow must follow: Open -> In progress -> Resolved -> Closed.`,
      400,
    );
  }
}

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

    // Access requirement: Admin or assignee only (Page 4 of assignment PDF)
    const isAdmin = req.user?.role === Role.Admin;
    const isAssignee = ticket.assigneeId === req.user?.id;

    if (!isAdmin && !isAssignee) {
      throw new AppError(
        "Forbidden: Only an Admin or the assigned technician can access this ticket",
        403,
      );
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

    // 2. If assignee is specified, verify user exists and is a Technician
    if (assigneeId) {
      const assigneeUser = await prisma.user.findUnique({
        where: { id: assigneeId },
      });
      if (!assigneeUser) {
        throw new AppError("Referenced assignee user does not exist", 400);
      }
      if (assigneeUser.role !== Role.Technician) {
        if (assigneeUser.role === Role.Viewer) {
          throw new AppError("Cannot assign a maintenance ticket to a Viewer user", 400);
        }
        throw new AppError(
          "Cannot assign a maintenance ticket to an Admin user. Tickets can only be assigned to a Technician.",
          400,
        );
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

    // Validate status workflow transition if status is being updated
    if (status !== undefined) {
      validateStatusTransition(existingTicket.status, status, isAdmin);
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

    // If updating assignee, check existence and role (must be Technician)
    if (assigneeId !== undefined && assigneeId !== existingTicket.assigneeId) {
      if (assigneeId !== null) {
        const assigneeUser = await prisma.user.findUnique({
          where: { id: assigneeId },
        });
        if (!assigneeUser) {
          throw new AppError("Referenced assignee user does not exist", 400);
        }
        if (assigneeUser.role !== Role.Technician) {
          if (assigneeUser.role === Role.Viewer) {
            throw new AppError(
              "Cannot assign a maintenance ticket to a Viewer user",
              400,
            );
          }
          throw new AppError(
            "Cannot assign a maintenance ticket to an Admin user. Tickets can only be assigned to a Technician.",
            400,
          );
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

    // Validate status workflow transition
    validateStatusTransition(existingTicket.status, status, isAdmin);

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
