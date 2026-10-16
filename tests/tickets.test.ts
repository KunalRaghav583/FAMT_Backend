import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/db/prisma";
import { TicketPriority, TicketStatus } from "@prisma/client";

describe("Stage 5 - Tickets API Integration Tests", () => {
  let adminToken: string;
  let adminUserId: string;
  let techToken: string;
  let viewerToken: string;
  let unassignedTechToken: string;
  let techUserId: string;
  let viewerUserId: string;
  let testAssetId: string;
  let seededTicketId: string;
  let closedTicketId: string;
  let createdTicketId: string;

  beforeAll(async () => {
    // Acquire tokens
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@famt.dev", password: "Password123!" });
    adminToken = adminLogin.body.token;
    adminUserId = adminLogin.body.user.id;

    const techLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "tech@famt.dev", password: "Password123!" });
    techToken = techLogin.body.token;
    techUserId = techLogin.body.user.id;

    const viewerLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "viewer@famt.dev", password: "Password123!" });
    viewerToken = viewerLogin.body.token;
    viewerUserId = viewerLogin.body.user.id;

    // Register & login an unassigned technician for access control tests
    await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Unassigned Technician",
        email: "unassignedtech@famt.dev",
        password: "Password123!",
        role: "Technician",
      });

    const unassignedLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "unassignedtech@famt.dev", password: "Password123!" });
    unassignedTechToken = unassignedLogin.body.token;

    // Grab an asset
    const asset = await prisma.asset.findFirst();
    expect(asset).not.toBeNull();
    testAssetId = asset!.id;

    // Grab a seeded open ticket assigned to tech
    const seededTicket = await prisma.ticket.findFirst({
      where: {
        status: TicketStatus.Open,
        assigneeId: techUserId,
      },
    });
    expect(seededTicket).not.toBeNull();
    seededTicketId = seededTicket!.id;

    // Grab a seeded closed ticket
    const closedTicket = await prisma.ticket.findFirst({
      where: { status: TicketStatus.Closed },
    });
    expect(closedTicket).not.toBeNull();
    closedTicketId = closedTicket!.id;
  });

  afterAll(async () => {
    // Clean up created test tickets and unassigned technician
    if (createdTicketId) {
      await prisma.comment.deleteMany({ where: { ticketId: createdTicketId } });
      await prisma.ticket.deleteMany({ where: { id: createdTicketId } });
    }
    await prisma.user.deleteMany({
      where: { email: "unassignedtech@famt.dev" },
    });
    await prisma.$disconnect();
  });

  describe("GET /api/tickets", () => {
    it("should list tickets with pagination", async () => {
      const res = await request(app)
        .get("/api/tickets")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("tickets");
      expect(res.body).toHaveProperty("pagination");
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(20);
      expect(res.body.tickets[0]).toHaveProperty("asset");
      expect(res.body.tickets[0]).toHaveProperty("creator");
    });

    it("should filter tickets by status (including 'In progress' with spaces)", async () => {
      const res = await request(app)
        .get("/api/tickets?status=In progress")
        .set("Authorization", `Bearer ${techToken}`);

      expect(res.status).toBe(200);
      expect(res.body.tickets.length).toBeGreaterThan(0);
      for (const t of res.body.tickets) {
        expect(t.status).toBe(TicketStatus.In_progress);
      }
    });

    it("should filter tickets by priority", async () => {
      const res = await request(app)
        .get("/api/tickets?priority=Critical")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.tickets.length).toBeGreaterThan(0);
      for (const t of res.body.tickets) {
        expect(t.priority).toBe(TicketPriority.Critical);
      }
    });

    it("should filter tickets by assigneeId ('My tickets' view for technician)", async () => {
      const res = await request(app)
        .get(`/api/tickets?assigneeId=${techUserId}`)
        .set("Authorization", `Bearer ${techToken}`);

      expect(res.status).toBe(200);
      expect(res.body.tickets.length).toBeGreaterThan(0);
      for (const t of res.body.tickets) {
        expect(t.assigneeId).toBe(techUserId);
      }
    });

    it("should support combined filters (status + priority + assigneeId)", async () => {
      const res = await request(app)
        .get(`/api/tickets?status=Open&priority=Critical&assigneeId=${techUserId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const t of res.body.tickets) {
        expect(t.status).toBe(TicketStatus.Open);
        expect(t.priority).toBe(TicketPriority.Critical);
        expect(t.assigneeId).toBe(techUserId);
      }
    });

    it("should reject invalid status with 400", async () => {
      const res = await request(app)
        .get("/api/tickets?status=InvalidStatus")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should reject malformed assigneeId with 400", async () => {
      const res = await request(app)
        .get("/api/tickets?assigneeId=not-a-uuid")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/must be a valid UUID/i);
    });

    it("should reject unauthenticated request with 401", async () => {
      const res = await request(app).get("/api/tickets");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/tickets/:id", () => {
    it("should allow an Admin to retrieve any single ticket with full relations", async () => {
      const res = await request(app)
        .get(`/api/tickets/${seededTicketId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("ticket");
      expect(res.body.ticket.id).toBe(seededTicketId);
      expect(res.body.ticket).toHaveProperty("asset");
      expect(res.body.ticket).toHaveProperty("assignee");
      expect(res.body.ticket).toHaveProperty("creator");
      expect(res.body.ticket).toHaveProperty("comments");
    });

    it("should allow the assigned Technician to retrieve their ticket", async () => {
      const res = await request(app)
        .get(`/api/tickets/${seededTicketId}`)
        .set("Authorization", `Bearer ${techToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("ticket");
      expect(res.body.ticket.id).toBe(seededTicketId);
    });

    it("should forbid unassigned Technician from accessing ticket details with 403", async () => {
      const res = await request(app)
        .get(`/api/tickets/${seededTicketId}`)
        .set("Authorization", `Bearer ${unassignedTechToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(
        /Forbidden: Only an Admin or the assigned technician can access this ticket/i,
      );
    });

    it("should forbid Viewer from accessing ticket details with 403", async () => {
      const res = await request(app)
        .get(`/api/tickets/${seededTicketId}`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(
        /Forbidden: Only an Admin or the assigned technician can access this ticket/i,
      );
    });

    it("should reject malformed ticket ID with 400", async () => {
      const res = await request(app)
        .get("/api/tickets/invalid-ticket-uuid")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/must be a valid UUID/i);
    });

    it("should return 404 for valid but nonexistent ticket UUID", async () => {
      const res = await request(app)
        .get("/api/tickets/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Ticket not found" });
    });
  });

  describe("POST /api/tickets", () => {
    it("should allow any logged-in user to create a ticket (Viewer raising a ticket)", async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({
          title: "Vibration alarm tripped on crude pump",
          description: "High harmonic vibration observed on secondary drive bearing.",
          priority: "High",
          dueDate,
          assetId: testAssetId,
          assigneeId: techUserId,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("ticket");
      expect(res.body.ticket.title).toBe("Vibration alarm tripped on crude pump");
      expect(res.body.ticket.status).toBe(TicketStatus.Open);
      // Security check: createdBy must match the authenticated Viewer's ID
      expect(res.body.ticket.creator.id).toBe(viewerUserId);

      createdTicketId = res.body.ticket.id;
    });

    it("should reject ticket creation assigned to a Viewer user with 400", async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Invalid assignment test",
          description: "Attempting to assign ticket to a viewer.",
          priority: "Low",
          dueDate,
          assetId: testAssetId,
          assigneeId: viewerUserId, // Viewer cannot be assignee!
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/Cannot assign.*to a Viewer/i);
    });

    it("should reject ticket creation assigned to an Admin user with 400", async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Invalid assignment to admin",
          description: "Attempting to assign ticket to an Admin user.",
          priority: "Low",
          dueDate,
          assetId: testAssetId,
          assigneeId: adminUserId,
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/Cannot assign.*to an Admin user/i);
    });

    it("should reject ticket creation with nonexistent asset ID with 400", async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Nonexistent asset test",
          description: "Invalid asset ID.",
          priority: "Low",
          dueDate,
          assetId: "00000000-0000-0000-0000-000000000000",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Referenced asset does not exist/i);
    });

    it("should reject ticket creation with unknown extra fields with 400", async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Strict validation test",
          description: "Extra unexpected field.",
          priority: "Low",
          dueDate,
          assetId: testAssetId,
          unexpectedParam: "fail",
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should reject ticket creation with non-Open status (e.g. 'In progress', 'Resolved', 'Closed') with 400", async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const invalidStatuses = ["In progress", "Resolved", "Closed"];
      for (const status of invalidStatuses) {
        const res = await request(app)
          .post("/api/tickets")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            title: `Bypass attempt with ${status}`,
            description: "Attempting to create ticket directly in non-Open status.",
            priority: "Medium",
            dueDate,
            assetId: testAssetId,
            status,
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(
          /New tickets must always start with 'Open' status/i,
        );
      }
    });

    it("should allow creating a ticket with explicit 'Open' status", async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          title: "Ticket with explicit Open status",
          description: "Explicitly sending Open status.",
          priority: "Low",
          dueDate,
          assetId: testAssetId,
          status: "Open",
        });

      expect(res.status).toBe(201);
      expect(res.body.ticket.status).toBe(TicketStatus.Open);

      await prisma.ticket.delete({ where: { id: res.body.ticket.id } });
    });
  });

  describe("PUT /api/tickets/:id", () => {
    it("should allow the assigned Technician to update their ticket", async () => {
      const res = await request(app)
        .put(`/api/tickets/${createdTicketId}`)
        .set("Authorization", `Bearer ${techToken}`)
        .send({
          title: "Vibration alarm tripped - Diagnosed",
          description: "Bearing inspected; replacement seal ordered.",
        });

      expect(res.status).toBe(200);
      expect(res.body.ticket.title).toBe("Vibration alarm tripped - Diagnosed");
    });

    it("should allow an Admin to update any ticket", async () => {
      const res = await request(app)
        .put(`/api/tickets/${createdTicketId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          priority: "Critical",
        });

      expect(res.status).toBe(200);
      expect(res.body.ticket.priority).toBe(TicketPriority.Critical);
    });

    it("should forbid unassigned Viewer from updating a ticket with 403", async () => {
      const res = await request(app)
        .put(`/api/tickets/${createdTicketId}`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ title: "Hacked" });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(
        /Forbidden: Only an Admin or the assigned technician/i,
      );
    });

    it("should forbid a Technician from reopening a Closed ticket with 403", async () => {
      const res = await request(app)
        .put(`/api/tickets/${closedTicketId}`)
        .set("Authorization", `Bearer ${techToken}`)
        .send({ status: "Open" });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Only an Admin can reopen a closed ticket/i);
    });

    it("should reject update with empty body with 400", async () => {
      const res = await request(app)
        .put(`/api/tickets/${createdTicketId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/At least one field must be provided/i);
    });
  });

  describe("PATCH /api/tickets/:id/status", () => {
    it("should allow assigned Technician to update status (Open -> In progress)", async () => {
      const res = await request(app)
        .patch(`/api/tickets/${createdTicketId}/status`)
        .set("Authorization", `Bearer ${techToken}`)
        .send({ status: "In progress" });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe(TicketStatus.In_progress);
    });

    it("should allow assigned Technician to update status (In progress -> Resolved)", async () => {
      const res = await request(app)
        .patch(`/api/tickets/${createdTicketId}/status`)
        .set("Authorization", `Bearer ${techToken}`)
        .send({ status: "Resolved" });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe(TicketStatus.Resolved);
    });

    it("should allow Admin to close ticket (Resolved -> Closed)", async () => {
      const res = await request(app)
        .patch(`/api/tickets/${createdTicketId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "Closed" });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe(TicketStatus.Closed);
    });

    it("should forbid a Technician from reopening a Closed ticket with 403", async () => {
      const res = await request(app)
        .patch(`/api/tickets/${createdTicketId}/status`)
        .set("Authorization", `Bearer ${techToken}`)
        .send({ status: "Open" });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Only an Admin can reopen a closed ticket/i);
    });

    it("should allow an Admin to reopen a Closed ticket (Closed -> Open)", async () => {
      const res = await request(app)
        .patch(`/api/tickets/${createdTicketId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "Open" });

      expect(res.status).toBe(200);
      expect(res.body.ticket.status).toBe(TicketStatus.Open);
    });

    it("should forbid Viewer from moving ticket status with 403", async () => {
      const res = await request(app)
        .patch(`/api/tickets/${createdTicketId}/status`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ status: "In progress" });

      expect(res.status).toBe(403);
    });

    it("should reject invalid status with 400", async () => {
      const res = await request(app)
        .patch(`/api/tickets/${createdTicketId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "NotAStatus" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should reject illegal skipping status transition (Open -> Closed) with 400", async () => {
      const res = await request(app)
        .patch(`/api/tickets/${seededTicketId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "Closed" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid status transition/i);
    });

    it("should reject illegal skipping status transition by Technician (Open -> Resolved) with 400", async () => {
      const res = await request(app)
        .patch(`/api/tickets/${seededTicketId}/status`)
        .set("Authorization", `Bearer ${techToken}`)
        .send({ status: "Resolved" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid status transition/i);
    });

    it("should reject illegal skipping status transition by Admin (Open -> Resolved) with 400", async () => {
      const res = await request(app)
        .patch(`/api/tickets/${seededTicketId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "Resolved" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(
        /Invalid status transition from 'Open' to 'Resolved'/i,
      );
    });

    it("should reject illegal reopening to non-Open status (Closed -> In progress) with 400", async () => {
      // First ensure ticket is closed
      const tempTicket = await prisma.ticket.create({
        data: {
          title: "Closed ticket for invalid reopen test",
          description: "Testing invalid reopen target.",
          priority: TicketPriority.Low,
          status: TicketStatus.Closed,
          dueDate: new Date(),
          assetId: testAssetId,
          createdBy: adminUserId,
        },
      });

      const res = await request(app)
        .patch(`/api/tickets/${tempTicket.id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "In progress" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/closed ticket can only be reopened to 'Open'/i);

      await prisma.ticket.delete({ where: { id: tempTicket.id } });
    });
  });
});
