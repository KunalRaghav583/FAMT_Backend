import { PrismaClient, Role, AssetStatus } from "@prisma/client";

const prisma = new PrismaClient();

describe("Stage 2 - Database Schema & Referential Integrity Verification", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should verify exact seeded record counts", async () => {
    const userCount = await prisma.user.count();
    const siteCount = await prisma.site.count();
    const assetCount = await prisma.asset.count();
    const ticketCount = await prisma.ticket.count();

    expect(userCount).toBe(3);
    expect(siteCount).toBe(2);
    expect(assetCount).toBe(10);
    expect(ticketCount).toBe(20);
  });

  it("should have exactly one user per required role", async () => {
    const admin = await prisma.user.findFirst({ where: { role: Role.Admin } });
    const tech = await prisma.user.findFirst({ where: { role: Role.Technician } });
    const viewer = await prisma.user.findFirst({ where: { role: Role.Viewer } });

    expect(admin).not.toBeNull();
    expect(admin?.email).toBe("admin@famt.dev");

    expect(tech).not.toBeNull();
    expect(tech?.email).toBe("tech@famt.dev");

    expect(viewer).not.toBeNull();
    expect(viewer?.email).toBe("viewer@famt.dev");
  });

  it("should enforce unique constraint on user email", async () => {
    await expect(
      prisma.user.create({
        data: {
          name: "Duplicate Email Test",
          email: "admin@famt.dev", // already exists
          passwordHash: "hash123",
          role: Role.Viewer,
        },
      }),
    ).rejects.toThrow();
  });

  it("should enforce unique constraint on asset serial number", async () => {
    const site = await prisma.site.findFirst();
    expect(site).not.toBeNull();

    await expect(
      prisma.asset.create({
        data: {
          name: "Duplicate Serial Asset",
          type: "Pump",
          serialNo: "PUMP-PB-001", // already exists in seed
          status: AssetStatus.Active,
          siteId: site!.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("should enforce RESTRICT deletion behavior when a site has assets", async () => {
    const siteWithAssets = await prisma.site.findFirst({
      where: { assets: { some: {} } },
    });
    expect(siteWithAssets).not.toBeNull();

    await expect(
      prisma.site.delete({
        where: { id: siteWithAssets!.id },
      }),
    ).rejects.toThrow();
  });

  it("should enforce RESTRICT deletion behavior when an asset has tickets", async () => {
    const assetWithTickets = await prisma.asset.findFirst({
      where: { tickets: { some: {} } },
    });
    expect(assetWithTickets).not.toBeNull();

    await expect(
      prisma.asset.delete({
        where: { id: assetWithTickets!.id },
      }),
    ).rejects.toThrow();
  });
});
