import { Response, NextFunction } from "express";
import { prisma } from "../db/prisma";
import { AuthenticatedRequest } from "../types/auth.types";
import { AppError } from "../errors/app.error";

export async function listSites(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sites = await prisma.site.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { assets: true },
        },
      },
    });

    res.status(200).json({ sites });
  } catch (error) {
    next(error);
  }
}

export async function getSiteById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;

    const site = await prisma.site.findUnique({
      where: { id },
      include: {
        assets: {
          select: {
            id: true,
            name: true,
            type: true,
            serialNo: true,
            status: true,
          },
        },
        _count: {
          select: { assets: true },
        },
      },
    });

    if (!site) {
      throw new AppError("Site not found", 404);
    }

    res.status(200).json({ site });
  } catch (error) {
    next(error);
  }
}

export async function createSite(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name, location } = req.body;

    const site = await prisma.site.create({
      data: {
        name,
        location,
      },
    });

    res.status(201).json({
      message: "Site created successfully",
      site,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSite(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { name, location } = req.body;

    const existingSite = await prisma.site.findUnique({
      where: { id },
    });

    if (!existingSite) {
      throw new AppError("Site not found", 404);
    }

    const updatedSite = await prisma.site.update({
      where: { id },
      data: {
        name: name ?? existingSite.name,
        location: location ?? existingSite.location,
      },
    });

    res.status(200).json({
      message: "Site updated successfully",
      site: updatedSite,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteSite(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;

    const existingSite = await prisma.site.findUnique({
      where: { id },
    });

    if (!existingSite) {
      throw new AppError("Site not found", 404);
    }

    // Check if site has dependent assets
    const assetCount = await prisma.asset.count({
      where: { siteId: id },
    });

    if (assetCount > 0) {
      throw new AppError(
        `Cannot delete site with ${assetCount} associated assets. Please reassign or remove assets first.`,
        400,
      );
    }

    await prisma.site.delete({
      where: { id },
    });

    res.status(200).json({
      message: "Site deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}
