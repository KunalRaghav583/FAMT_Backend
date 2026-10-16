import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/db/prisma";
import { TicketPriority } from "@prisma/client";

describe("Stage 6 - Dashboard API Integration Tests", () => {
  let adminToken: string;
  let techToken: string;
  let viewerToken: string;
  let testAssetId: string;
  let controlledTicketId: string;

  beforeAll(async () => {
    // Acquire tokens for all three roles
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

    // Grab a seeded asset for controlled tests
    const asset = await prisma.asset.findFirst();
    expect(asset).not.toBeNull();
    testAssetId = asset!.id;
  });

  afterAll(async () => {
    if (controlledTicketId) {
      await prisma.ticket.deleteMany({ where: { id: controlledTicketId } });
    }
    await prisma.$disconnect();
  });

  describe("GET /api/dashboard/summary", () => {
    it("should allow Admin to retrieve dashboard summary metrics", async () => {
      const res = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("summary");

      const { summary } = res.body;
      expect(typeof summary.totalAssets).toBe("number");
      expect(typeof summary.totalTickets).toBe("number");
      expect(typeof summary.openTickets).toBe("number");
      expect(typeof summary.overdueTickets).toBe("number");
      expect(typeof summary.assetsUnderMaintenance).toBe("number");

      // Verify counts match or exceed seeded data
      expect(summary.totalAssets).toBeGreaterThanOrEqual(10);
      expect(summary.totalTickets).toBeGreaterThanOrEqual(20);
      expect(summary.openTickets).toBeGreaterThanOrEqual(8);
      expect(summary.assetsUnderMaintenance).toBeGreaterThanOrEqual(3);

      // Verify chart aggregations structure
      expect(summary.ticketsByStatus).toHaveProperty("Open");
      expect(summary.ticketsByStatus).toHaveProperty("In progress");
      expect(summary.ticketsByStatus).toHaveProperty("Resolved");
      expect(summary.ticketsByStatus).toHaveProperty("Closed");

      expect(summary.ticketsByPriority).toHaveProperty("Low");
      expect(summary.ticketsByPriority).toHaveProperty("Medium");
      expect(summary.ticketsByPriority).toHaveProperty("High");
      expect(summary.ticketsByPriority).toHaveProperty("Critical");

      expect(summary.assetsByStatus).toHaveProperty("Active");
      expect(summary.assetsByStatus).toHaveProperty("Under maintenance");
      expect(summary.assetsByStatus).toHaveProperty("Retired");
    });

    it("should allow Technician to retrieve dashboard summary metrics", async () => {
      const res = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${techToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("summary");
    });

    it("should allow Viewer to retrieve dashboard summary metrics", async () => {
      const res = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("summary");
    });

    it("should reject unauthenticated request with 401", async () => {
      const res = await request(app).get("/api/dashboard/summary");
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Authorization token required" });
    });

    it("should accurately recalculate overdue metrics when tickets transition between Open and Resolved", async () => {
      // 1. Get baseline overdue count
      const baselineRes = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${adminToken}`);
      const baselineOverdue = baselineRes.body.summary.overdueTickets;

      // 2. Create an overdue open ticket (due date 5 days ago)
      const pastDueDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const createRes = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Overdue calculation test ticket",
          description: "Controlled test for overdue calculation.",
          priority: TicketPriority.High,
          dueDate: pastDueDate,
          assetId: testAssetId,
        });

      expect(createRes.status).toBe(201);
      controlledTicketId = createRes.body.ticket.id;

      // 3. Verify overdue count increments by 1
      const afterCreateRes = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(afterCreateRes.body.summary.overdueTickets).toBe(baselineOverdue + 1);

      // 4. Progress and Resolve the ticket following strict workflow (Open -> In progress -> Resolved)
      const inProgressRes = await request(app)
        .patch(`/api/tickets/${controlledTicketId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "In progress" });
      expect(inProgressRes.status).toBe(200);

      const resolveRes = await request(app)
        .patch(`/api/tickets/${controlledTicketId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "Resolved" });
      expect(resolveRes.status).toBe(200);

      // 5. Verify overdue count returns to baseline (resolved tickets are not overdue)
      const afterResolveRes = await request(app)
        .get("/api/dashboard/summary")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(afterResolveRes.body.summary.overdueTickets).toBe(baselineOverdue);

      // Clean up
      await prisma.ticket.delete({ where: { id: controlledTicketId } });
      controlledTicketId = "";
    });
  });
});
