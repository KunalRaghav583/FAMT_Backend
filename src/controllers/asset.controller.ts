import { Response, NextFunction } from "express";
import { Prisma, AssetStatus } from "@prisma/client";
import { prisma } from "../db/prisma";
import { AuthenticatedRequest } from "../types/auth.types";
import { AppError } from "../errors/app.error";

export async function listAssets(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      search,
      siteId,
      status,
      page = 1,
      limit = 10,
    } = req.query as {
      search?: string;
      siteId?: string;
      status?: AssetStatus;
      page?: number;
      limit?: number;
    };

    const pageNumber = Number(page) || 1;
    const pageSize = Number(limit) || 10;
    const skip = (pageNumber - 1) * pageSize;

    const where: Prisma.AssetWhereInput = {};

    if (search && search.trim().length > 0) {
      const searchTerm = search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { serialNo: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    if (siteId && siteId.trim().length > 0) {
      where.siteId = siteId.trim();
    }

    if (status && Object.values(AssetStatus).includes(status)) {
      where.status = status;
    }

    const [total, assets] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          site: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    res.status(200).json({
      assets,
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

export async function getAssetById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        _count: {
          select: { tickets: true },
        },
      },
    });

    if (!asset) {
      throw new AppError("Asset not found", 404);
    }

    res.status(200).json({ asset });
  } catch (error) {
    next(error);
  }
}

export async function createAsset(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name, type, serialNo, status, siteId } = req.body;

    // Check if site exists
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });
    if (!site) {
      throw new AppError("Referenced site does not exist", 400);
    }

    // Check if serial number already exists
    const existingSerial = await prisma.asset.findUnique({
      where: { serialNo },
    });
    if (existingSerial) {
      throw new AppError("An asset with this serial number already exists", 400);
    }

    const asset = await prisma.asset.create({
      data: {
        name,
        type,
        serialNo,
        status: status || AssetStatus.Active,
        siteId,
      },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "Asset created successfully",
      asset,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAsset(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { name, type, serialNo, status, siteId } = req.body;

    const existingAsset = await prisma.asset.findUnique({
      where: { id },
    });
    if (!existingAsset) {
      throw new AppError("Asset not found", 404);
    }

    // If siteId provided, check if site exists
    if (siteId && siteId !== existingAsset.siteId) {
      const site = await prisma.site.findUnique({
        where: { id: siteId },
      });
      if (!site) {
        throw new AppError("Referenced site does not exist", 400);
      }
    }

    // If serialNo provided, check if unique
    if (serialNo && serialNo !== existingAsset.serialNo) {
      const existingSerial = await prisma.asset.findUnique({
        where: { serialNo },
      });
      if (existingSerial) {
        throw new AppError("An asset with this serial number already exists", 400);
      }
    }

    const updatedAsset = await prisma.asset.update({
      where: { id },
      data: {
        name: name ?? existingAsset.name,
        type: type ?? existingAsset.type,
        serialNo: serialNo ?? existingAsset.serialNo,
        status: status ?? existingAsset.status,
        siteId: siteId ?? existingAsset.siteId,
      },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
    });

    res.status(200).json({
      message: "Asset updated successfully",
      asset: updatedAsset,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteAsset(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;

    const existingAsset = await prisma.asset.findUnique({
      where: { id },
    });
    if (!existingAsset) {
      throw new AppError("Asset not found", 404);
    }

    // Check if asset has tickets
    const ticketCount = await prisma.ticket.count({
      where: { assetId: id },
    });

    if (ticketCount > 0) {
      throw new AppError(
        `Cannot delete asset with ${ticketCount} maintenance ticket(s). Maintenance history must be preserved. Consider updating status to Retired instead.`,
        400,
      );
    }

    await prisma.asset.delete({
      where: { id },
    });

    res.status(200).json({
      message: "Asset deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}
