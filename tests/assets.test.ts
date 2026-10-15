import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/db/prisma";
import { AssetStatus } from "@prisma/client";

describe("Stage 4 - Assets API Integration Tests", () => {
  let adminToken: string;
  let techToken: string;
  let viewerToken: string;
  let testSiteId: string;
  let assetWithTicketsId: string;
  let createdAssetId: string;

  beforeAll(async () => {
    // Acquire JWT tokens
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@famt.dev", password: "Password123!" });
    adminToken = adminLogin.body.token;

    const techLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "tech@famt.dev", password: "Password123!" });
    techToken = techLogin.body.token;

    const viewerLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "viewer@famt.dev", password: "Password123!" });
    viewerToken = viewerLogin.body.token;

    // Fetch a seeded site
    const site = await prisma.site.findFirst();
    expect(site).not.toBeNull();
    testSiteId = site!.id;

    // Fetch a seeded asset that has tickets
    const assetWithTickets = await prisma.asset.findFirst({
      where: { tickets: { some: {} } },
    });
    expect(assetWithTickets).not.toBeNull();
    assetWithTicketsId = assetWithTickets!.id;
  });

  afterAll(async () => {
    // Clean up created asset
    if (createdAssetId) {
      await prisma.asset.deleteMany({
        where: { id: createdAssetId },
      });
    }
    await prisma.$disconnect();
  });

  describe("GET /api/assets", () => {
    it("should list assets with default pagination", async () => {
      const res = await request(app)
        .get("/api/assets")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("assets");
      expect(res.body).toHaveProperty("pagination");
      expect(Array.isArray(res.body.assets)).toBe(true);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(10);
    });

    it("should paginate correctly with custom page and limit", async () => {
      const res = await request(app)
        .get("/api/assets?page=1&limit=3")
        .set("Authorization", `Bearer ${techToken}`);

      expect(res.status).toBe(200);
      expect(res.body.assets.length).toBe(3);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(3);
      expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(4);

      // Verify page 2 has different assets
      const resPage2 = await request(app)
        .get("/api/assets?page=2&limit=3")
        .set("Authorization", `Bearer ${techToken}`);

      expect(resPage2.status).toBe(200);
      expect(resPage2.body.assets.length).toBe(3);
      expect(resPage2.body.assets[0].id).not.toBe(res.body.assets[0].id);
    });

    it("should filter assets by search term matching name or serial number", async () => {
      const res = await request(app)
        .get("/api/assets?search=PUMP-PB-001")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.assets.length).toBe(1);
      expect(res.body.assets[0].serialNo).toBe("PUMP-PB-001");
    });

    it("should filter assets by siteId", async () => {
      const res = await request(app)
        .get(`/api/assets?siteId=${testSiteId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.assets.length).toBeGreaterThan(0);
      for (const asset of res.body.assets) {
        expect(asset.siteId).toBe(testSiteId);
      }
    });

    it("should filter assets by status", async () => {
      const res = await request(app)
        .get("/api/assets?status=Under maintenance")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.assets.length).toBeGreaterThan(0);
      for (const asset of res.body.assets) {
        expect(asset.status).toBe(AssetStatus.Under_maintenance);
      }
    });

    it("should return empty list when no assets match query", async () => {
      const res = await request(app)
        .get("/api/assets?search=xyz-completely-nonexistent-999")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.assets.length).toBe(0);
      expect(res.body.pagination.total).toBe(0);
    });

    it("should reject unauthenticated request with 401", async () => {
      const res = await request(app).get("/api/assets");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/assets/:id", () => {
    it("should return asset details including site relation", async () => {
      const res = await request(app)
        .get(`/api/assets/${assetWithTicketsId}`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("asset");
      expect(res.body.asset.id).toBe(assetWithTicketsId);
      expect(res.body.asset).toHaveProperty("site");
      expect(res.body.asset.site).toHaveProperty("name");
    });

    it("should return 404 for nonexistent asset ID", async () => {
      const res = await request(app)
        .get("/api/assets/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Asset not found" });
    });
  });

  describe("POST /api/assets", () => {
    it("should allow Admin to create a new asset", async () => {
      const res = await request(app)
        .post("/api/assets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Auxiliary Gas Separator",
          type: "Separator",
          serialNo: "SEP-TEST-100",
          status: "Active",
          siteId: testSiteId,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("asset");
      expect(res.body.asset.serialNo).toBe("SEP-TEST-100");
      expect(res.body.asset.status).toBe(AssetStatus.Active);

      createdAssetId = res.body.asset.id;
    });

    it("should forbid Technician from creating asset with 403", async () => {
      const res = await request(app)
        .post("/api/assets")
        .set("Authorization", `Bearer ${techToken}`)
        .send({
          name: "Unauthorized Asset",
          type: "Pump",
          serialNo: "PUMP-UNAUTH",
          siteId: testSiteId,
        });

      expect(res.status).toBe(403);
    });

    it("should forbid Viewer from creating asset with 403", async () => {
      const res = await request(app)
        .post("/api/assets")
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({
          name: "Unauthorized Asset",
          type: "Pump",
          serialNo: "PUMP-UNAUTH",
          siteId: testSiteId,
        });

      expect(res.status).toBe(403);
    });

    it("should reject creation with duplicate serial number with 400", async () => {
      const res = await request(app)
        .post("/api/assets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Duplicate Serial Asset",
          type: "Pump",
          serialNo: "PUMP-PB-001", // already exists
          siteId: testSiteId,
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/already exists/i);
    });

    it("should reject creation with invalid siteId with 400", async () => {
      const res = await request(app)
        .post("/api/assets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Invalid Site Asset",
          type: "Pump",
          serialNo: "PUMP-INVALID-SITE",
          siteId: "00000000-0000-0000-0000-000000000000",
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/Referenced site does not exist/i);
    });
  });

  describe("PUT /api/assets/:id", () => {
    it("should allow Admin to update an asset", async () => {
      const res = await request(app)
        .put(`/api/assets/${createdAssetId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Auxiliary Gas Separator V2",
          status: "Under maintenance",
        });

      expect(res.status).toBe(200);
      expect(res.body.asset.name).toBe("Auxiliary Gas Separator V2");
      expect(res.body.asset.status).toBe(AssetStatus.Under_maintenance);
    });

    it("should forbid Technician from updating asset with 403", async () => {
      const res = await request(app)
        .put(`/api/assets/${createdAssetId}`)
        .set("Authorization", `Bearer ${techToken}`)
        .send({ name: "Hacked Name" });

      expect(res.status).toBe(403);
    });

    it("should reject update with duplicate serial number with 400", async () => {
      const res = await request(app)
        .put(`/api/assets/${createdAssetId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ serialNo: "PUMP-PB-001" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it("should return 404 when updating nonexistent asset", async () => {
      const res = await request(app)
        .put("/api/assets/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Ghost Asset" });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Asset not found" });
    });
  });

  describe("DELETE /api/assets/:id", () => {
    it("should reject deletion of an asset with maintenance tickets with 400", async () => {
      const res = await request(app)
        .delete(`/api/assets/${assetWithTicketsId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/Cannot delete asset with.*maintenance ticket/i);
    });

    it("should forbid Technician from deleting an asset with 403", async () => {
      const res = await request(app)
        .delete(`/api/assets/${createdAssetId}`)
        .set("Authorization", `Bearer ${techToken}`);

      expect(res.status).toBe(403);
    });

    it("should allow Admin to delete an asset without tickets", async () => {
      const res = await request(app)
        .delete(`/api/assets/${createdAssetId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: "Asset deleted successfully" });

      // Verify deletion in database
      const check = await prisma.asset.findUnique({
        where: { id: createdAssetId },
      });
      expect(check).toBeNull();
      createdAssetId = "";
    });

    it("should return 404 when deleting nonexistent asset", async () => {
      const res = await request(app)
        .delete("/api/assets/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Asset not found" });
    });
  });
});
