import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/db/prisma";

describe("Stage 4 - Sites API Integration Tests", () => {
  let adminToken: string;
  let techToken: string;
  let viewerToken: string;
  let seededSiteId: string;
  let createdSiteId: string;

  beforeAll(async () => {
    // Acquire JWT tokens for each role
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

    // Grab a seeded site with assets
    const seededSite = await prisma.site.findFirst({
      where: { assets: { some: {} } },
    });
    expect(seededSite).not.toBeNull();
    seededSiteId = seededSite!.id;
  });

  afterAll(async () => {
    // Clean up test-created site if still present
    if (createdSiteId) {
      await prisma.site.deleteMany({
        where: { id: createdSiteId },
      });
    }
    await prisma.$disconnect();
  });

  describe("GET /api/sites", () => {
    it("should allow Admin to list sites", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("sites");
      expect(Array.isArray(res.body.sites)).toBe(true);
      expect(res.body.sites.length).toBeGreaterThanOrEqual(2);
      expect(res.body.sites[0]).toHaveProperty("_count");
    });

    it("should allow Technician to list sites", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${techToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.sites)).toBe(true);
    });

    it("should allow Viewer to list sites", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.sites)).toBe(true);
    });

    it("should reject unauthenticated request with 401", async () => {
      const res = await request(app).get("/api/sites");
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Authorization token required" });
    });
  });

  describe("GET /api/sites/:id", () => {
    it("should return site details for existing ID", async () => {
      const res = await request(app)
        .get(`/api/sites/${seededSiteId}`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("site");
      expect(res.body.site.id).toBe(seededSiteId);
      expect(res.body.site).toHaveProperty("assets");
    });

    it("should return 404 for nonexistent site ID", async () => {
      const res = await request(app)
        .get("/api/sites/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Site not found" });
    });
  });

  describe("POST /api/sites", () => {
    it("should allow Admin to create a new site", async () => {
      const res = await request(app)
        .post("/api/sites")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Eagle Ford Shale Terminal",
          location: "San Antonio, TX",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("site");
      expect(res.body.site.name).toBe("Eagle Ford Shale Terminal");
      expect(res.body.site.location).toBe("San Antonio, TX");

      createdSiteId = res.body.site.id;
    });

    it("should forbid Technician from creating a site with 403", async () => {
      const res = await request(app)
        .post("/api/sites")
        .set("Authorization", `Bearer ${techToken}`)
        .send({
          name: "Unauthorized Site",
          location: "Nowhere, TX",
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/Forbidden/i);
    });

    it("should forbid Viewer from creating a site with 403", async () => {
      const res = await request(app)
        .post("/api/sites")
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({
          name: "Unauthorized Site",
          location: "Nowhere, TX",
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error");
    });

    it("should reject creation with invalid payload with 400", async () => {
      const res = await request(app)
        .post("/api/sites")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "X", // too short
          // location missing
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("PUT /api/sites/:id", () => {
    it("should allow Admin to update an existing site", async () => {
      const res = await request(app)
        .put(`/api/sites/${createdSiteId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Eagle Ford Shale Terminal Updated",
          location: "Kenedy, TX",
        });

      expect(res.status).toBe(200);
      expect(res.body.site.name).toBe("Eagle Ford Shale Terminal Updated");
      expect(res.body.site.location).toBe("Kenedy, TX");
    });

    it("should forbid Technician from updating a site with 403", async () => {
      const res = await request(app)
        .put(`/api/sites/${createdSiteId}`)
        .set("Authorization", `Bearer ${techToken}`)
        .send({ name: "Hacked" });

      expect(res.status).toBe(403);
    });

    it("should return 404 when updating nonexistent site", async () => {
      const res = await request(app)
        .put("/api/sites/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Does Not Exist" });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Site not found" });
    });
  });

  describe("DELETE /api/sites/:id", () => {
    it("should reject deletion of a site that has associated assets with 400", async () => {
      const res = await request(app)
        .delete(`/api/sites/${seededSiteId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/Cannot delete site with.*associated assets/i);
    });

    it("should forbid Technician from deleting a site with 403", async () => {
      const res = await request(app)
        .delete(`/api/sites/${createdSiteId}`)
        .set("Authorization", `Bearer ${techToken}`);

      expect(res.status).toBe(403);
    });

    it("should allow Admin to delete an empty site with no assets", async () => {
      const res = await request(app)
        .delete(`/api/sites/${createdSiteId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: "Site deleted successfully" });

      // Verify deletion in database
      const check = await prisma.site.findUnique({
        where: { id: createdSiteId },
      });
      expect(check).toBeNull();
      createdSiteId = "";
    });

    it("should return 404 when deleting nonexistent site", async () => {
      const res = await request(app)
        .delete("/api/sites/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Site not found" });
    });
  });
});
