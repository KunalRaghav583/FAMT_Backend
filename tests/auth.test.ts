import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { prisma } from "../src/db/prisma";
import { Role } from "@prisma/client";
import { env } from "../src/config/env";

describe("Stage 3 - Authentication & Authorization Integration Tests", () => {
  let adminToken: string;
  let techToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    // Authenticate seeded users to get tokens for test scenarios
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
  });

  afterAll(async () => {
    // Clean up test-created users
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ["newuser@famt.dev", "admincreated@famt.dev", "publicviewer@famt.dev"],
        },
      },
    });
    await prisma.$disconnect();
  });

  describe("POST /api/auth/register", () => {
    it("should successfully register a new user as Viewer by default", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "New Public User",
        email: "publicviewer@famt.dev",
        password: "SecurePassword123!",
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.name).toBe("New Public User");
      expect(res.body.user.email).toBe("publicviewer@famt.dev");
      expect(res.body.user.role).toBe(Role.Viewer);
      // Critical security check: password_hash must never be returned
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.password_hash).toBeUndefined();

      // Verify password was hashed in database
      const dbUser = await prisma.user.findUnique({
        where: { email: "publicviewer@famt.dev" },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.passwordHash).not.toBe("SecurePassword123!");
      expect(dbUser?.passwordHash.startsWith("$2b$")).toBe(true);
    });

    it("should forbid public unauthenticated users from granting themselves the Admin role", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Malicious Actor",
        email: "attacker@famt.dev",
        password: "Password123!",
        role: "Admin",
      });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/Public registration cannot grant Admin role/i);

      // Verify record was not created
      const attacker = await prisma.user.findUnique({
        where: { email: "attacker@famt.dev" },
      });
      expect(attacker).toBeNull();
    });

    it("should allow an authenticated Admin to register a user with Admin role", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Subordinate Admin",
          email: "admincreated@famt.dev",
          password: "SecurePassword123!",
          role: "Admin",
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe(Role.Admin);
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it("should reject duplicate email registration with 400", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Duplicate User",
        email: "admin@famt.dev",
        password: "Password123!",
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/already exists/i);
    });

    it("should reject invalid registration payloads with 400 and clear error format", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "A", // too short
        email: "invalid-email-format",
        password: "123", // too short
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(typeof res.body.error).toBe("string");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should successfully log in with valid credentials and return JWT token", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "admin@famt.dev",
        password: "Password123!",
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.email).toBe("admin@famt.dev");
      expect(res.body.user.role).toBe(Role.Admin);
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it("should reject login with incorrect password with 401", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "admin@famt.dev",
        password: "WrongPassword999!",
      });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Invalid email or password" });
    });

    it("should reject login with non-existent email with 401", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@famt.dev",
        password: "Password123!",
      });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Invalid email or password" });
    });

    it("should reject login with missing required fields with 400", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "admin@famt.dev",
        // missing password
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return the current user profile when valid token is supplied", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.email).toBe("admin@famt.dev");
      expect(res.body.user.role).toBe(Role.Admin);
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it("should reject unauthenticated request with 401", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Authorization token required" });
    });

    it("should reject malformed token with 401", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-signature-token-xyz");

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/invalid.*token/i);
    });

    it("should reject expired token with 401", async () => {
      // Create an explicitly expired token using the same secret
      const expiredToken = jwt.sign(
        { id: "some-id", email: "admin@famt.dev", role: Role.Admin, name: "Admin" },
        env.JWT_SECRET,
        { expiresIn: -10 }, // expired 10 seconds ago
      );

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/token expired/i);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should respond with 200 acknowledging logout", async () => {
      const res = await request(app).post("/api/auth/logout");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("Role-Based Access Control (requireRole)", () => {
    it("should allow Admin user to access admin-restricted endpoint", async () => {
      const res = await request(app)
        .get("/api/test-admin-access")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: "Admin access verified" });
    });

    it("should forbid Technician user from accessing admin-restricted endpoint with 403", async () => {
      const res = await request(app)
        .get("/api/test-admin-access")
        .set("Authorization", `Bearer ${techToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/Forbidden: role 'Technician' is not authorized/i);
    });

    it("should forbid Viewer user from accessing admin-restricted endpoint with 403", async () => {
      const res = await request(app)
        .get("/api/test-admin-access")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/Forbidden: role 'Viewer' is not authorized/i);
    });
  });

  describe("Error handler and 404 handler", () => {
    it("should return 404 in standard { error: message } format for unknown routes", async () => {
      const res = await request(app).get("/api/unknown-endpoint");

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Route not found" });
    });
  });
});
