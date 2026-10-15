import { Response, NextFunction } from "express";
import { AssetStatus, TicketStatus } from "@prisma/client";
import { prisma } from "../db/prisma";
import { AuthenticatedRequest } from "../types/auth.types";

export async function getDashboardSummary(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const now = new Date();

    const [
      totalAssets,
      totalTickets,
      openTickets,
      overdueTickets,
      assetsUnderMaintenance,
      ticketStatusGroups,
      ticketPriorityGroups,
      assetStatusGroups,
    ] = await Promise.all([
      // Total counts
      prisma.asset.count(),
      prisma.ticket.count(),

      // Key metrics required by assignment PDF
      prisma.ticket.count({
        where: { status: TicketStatus.Open },
      }),
      prisma.ticket.count({
        where: {
          dueDate: { lt: now },
          status: { in: [TicketStatus.Open, TicketStatus.In_progress] },
        },
      }),
      prisma.asset.count({
        where: { status: AssetStatus.Under_maintenance },
      }),

      // Aggregations for dashboard charts
      prisma.ticket.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.ticket.groupBy({
        by: ["priority"],
        _count: { id: true },
      }),
      prisma.asset.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ]);

    // Format tickets by status with default zeros
    const ticketsByStatus: Record<string, number> = {
      Open: 0,
      "In progress": 0,
      Resolved: 0,
      Closed: 0,
    };
    for (const group of ticketStatusGroups) {
      const label =
        group.status === TicketStatus.In_progress ? "In progress" : group.status;
      ticketsByStatus[label] = group._count.id;
    }

    // Format tickets by priority with default zeros
    const ticketsByPriority: Record<string, number> = {
      Low: 0,
      Medium: 0,
      High: 0,
      Critical: 0,
    };
    for (const group of ticketPriorityGroups) {
      ticketsByPriority[group.priority] = group._count.id;
    }

    // Format assets by status with default zeros
    const assetsByStatus: Record<string, number> = {
      Active: 0,
      "Under maintenance": 0,
      Retired: 0,
    };
    for (const group of assetStatusGroups) {
      const label =
        group.status === AssetStatus.Under_maintenance
          ? "Under maintenance"
          : group.status;
      assetsByStatus[label] = group._count.id;
    }

    res.status(200).json({
      summary: {
        totalAssets,
        totalTickets,
        openTickets,
        overdueTickets,
        assetsUnderMaintenance,
        ticketsByStatus,
        ticketsByPriority,
        assetsByStatus,
      },
    });
  } catch (error) {
    next(error);
  }
}
