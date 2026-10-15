import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/db/prisma";

describe("Stage 5 - Comments API Integration Tests", () => {
  let adminToken: string;
  let techToken: string;
  let viewerToken: string;
  let viewerUserId: string;
  let testTicketId: string;
  let createdCommentId: string;

  beforeAll(async () => {
    // Acquire tokens
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
    viewerUserId = viewerLogin.body.user.id;

    // Grab a seeded ticket that already has comments
    const seededTicket = await prisma.ticket.findFirst({
      where: { comments: { some: {} } },
    });
    expect(seededTicket).not.toBeNull();
    testTicketId = seededTicket!.id;
  });

  afterAll(async () => {
    if (createdCommentId) {
      await prisma.comment.deleteMany({
        where: { id: createdCommentId },
      });
    }
    await prisma.$disconnect();
  });

  describe("GET /api/tickets/:id/comments", () => {
    it("should retrieve comments for a ticket with author info", async () => {
      const res = await request(app)
        .get(`/api/tickets/${testTicketId}/comments`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("comments");
      expect(Array.isArray(res.body.comments)).toBe(true);
      expect(res.body.comments.length).toBeGreaterThan(0);
      expect(res.body.comments[0]).toHaveProperty("user");
      expect(res.body.comments[0].user).toHaveProperty("name");
      expect(res.body.comments[0].user).toHaveProperty("email");
      expect(res.body.comments[0].user).toHaveProperty("role");
      expect(res.body.comments[0]).toHaveProperty("createdAt");
    });

    it("should reject malformed non-UUID ticket ID with 400", async () => {
      const res = await request(app)
        .get("/api/tickets/not-a-valid-uuid/comments")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/must be a valid UUID/i);
    });

    it("should return 404 for valid but nonexistent ticket UUID", async () => {
      const res = await request(app)
        .get("/api/tickets/00000000-0000-0000-0000-000000000000/comments")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Ticket not found" });
    });

    it("should reject unauthenticated request with 401", async () => {
      const res = await request(app).get(`/api/tickets/${testTicketId}/comments`);
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/tickets/:id/comments", () => {
    it("should allow a Viewer to add a comment with correct author attribution", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicketId}/comments`)
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({
          body: "Audited safety isolation logs; verified tagging is up to date.",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("comment");
      expect(res.body.comment.body).toBe(
        "Audited safety isolation logs; verified tagging is up to date.",
      );
      expect(res.body.comment.user.id).toBe(viewerUserId);
      expect(res.body.comment.user.email).toBe("viewer@famt.dev");

      createdCommentId = res.body.comment.id;
    });

    it("should allow a Technician to add a comment", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicketId}/comments`)
        .set("Authorization", `Bearer ${techToken}`)
        .send({
          body: "Secondary seal kit arrived on site; beginning installation.",
        });

      expect(res.status).toBe(201);
      expect(res.body.comment.user.email).toBe("tech@famt.dev");

      // Clean up right away
      await prisma.comment.delete({ where: { id: res.body.comment.id } });
    });

    it("should allow an Admin to add a comment", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicketId}/comments`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          body: "Approved work order extension.",
        });

      expect(res.status).toBe(201);
      expect(res.body.comment.user.email).toBe("admin@famt.dev");

      // Clean up right away
      await prisma.comment.delete({ where: { id: res.body.comment.id } });
    });

    it("should reject comment creation with empty body with 400", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicketId}/comments`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ body: "" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/cannot be empty/i);
    });

    it("should reject comment creation with unknown extra fields with 400", async () => {
      const res = await request(app)
        .post(`/api/tickets/${testTicketId}/comments`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          body: "Valid body",
          spoofedAuthorId: "00000000-0000-0000-0000-000000000000",
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 404 when adding comment to nonexistent ticket", async () => {
      const res = await request(app)
        .post("/api/tickets/00000000-0000-0000-0000-000000000000/comments")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ body: "Test comment on ghost ticket" });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Ticket not found" });
    });
  });
});
