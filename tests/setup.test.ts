import request from "supertest";
import express from "express";
import rateLimit from "express-rate-limit";
import app from "../src/app";
import { APP_NAME, API_VERSION } from "../src/server";
import { validateEnv } from "../src/config/env";
import { authLimiter, apiLimiter } from "../src/middleware/rate-limit.middleware";
import { ZodError } from "zod";

describe("Stage 1 Tooling and Setup Verification", () => {
  it("should load configuration constants without error", () => {
    expect(APP_NAME).toBe("Field Asset Maintenance Tracker");
    expect(API_VERSION).toBe("1.0.0");
  });

  describe("Environment & JWT Secret Security Validation", () => {
    const validDbUrl =
      "postgresql://postgres:password@localhost:5432/famt_dev?schema=public";

    it("should fail validation in production if JWT_SECRET is missing or empty", () => {
      expect(() =>
        validateEnv({
          NODE_ENV: "production",
          DATABASE_URL: validDbUrl,
        }),
      ).toThrow(ZodError);

      expect(() =>
        validateEnv({
          NODE_ENV: "production",
          DATABASE_URL: validDbUrl,
          JWT_SECRET: "   ",
        }),
      ).toThrow(ZodError);
    });

    it("should fail validation in production if JWT_SECRET is less than 32 characters", () => {
      expect(() =>
        validateEnv({
          NODE_ENV: "production",
          DATABASE_URL: validDbUrl,
          JWT_SECRET: "short-key-less-than-32-chars",
        }),
      ).toThrow(ZodError);
    });

    it("should fail validation in production if JWT_SECRET uses known insecure defaults or samples", () => {
      const insecureSecrets = [
        "famt-default-jwt-secret-key-change-in-prod",
        "replace-with-a-secure-random-secret-in-production",
        "your-secret-key-min-32-chars",
        "some-prefix-password-exceeding-thirty-two-chars-long",
      ];

      for (const secret of insecureSecrets) {
        expect(() =>
          validateEnv({
            NODE_ENV: "production",
            DATABASE_URL: validDbUrl,
            JWT_SECRET: secret,
          }),
        ).toThrow(ZodError);
      }
    });

    it("should pass validation in production when JWT_SECRET is strong (>= 32 chars) and secure", () => {
      const secureSecret =
        "c9a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcd";
      const parsed = validateEnv({
        NODE_ENV: "production",
        DATABASE_URL: validDbUrl,
        JWT_SECRET: secureSecret,
      });

      expect(parsed.JWT_SECRET).toBe(secureSecret);
      expect(parsed.NODE_ENV).toBe("production");
    });

    it("should fail validation in development if JWT_SECRET is missing or empty", () => {
      expect(() =>
        validateEnv({
          NODE_ENV: "development",
          DATABASE_URL: validDbUrl,
          JWT_SECRET: "",
        }),
      ).toThrow(ZodError);
    });

    it("should pass validation in development with a valid non-empty JWT_SECRET", () => {
      const parsed = validateEnv({
        NODE_ENV: "development",
        DATABASE_URL: validDbUrl,
        JWT_SECRET: "dev-secret-key-famt-local",
      });

      expect(parsed.JWT_SECRET).toBe("dev-secret-key-famt-local");
      expect(parsed.NODE_ENV).toBe("development");
    });

    it("should supply a safe test secret in test environment when not explicitly configured", () => {
      const parsed = validateEnv({
        NODE_ENV: "test",
        DATABASE_URL: validDbUrl,
      });

      expect(parsed.JWT_SECRET).toBeDefined();
      expect(parsed.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
      expect(parsed.NODE_ENV).toBe("test");
    });
  });

  describe("HTTP Security Headers (Helmet)", () => {
    it("should set essential security headers and strip X-Powered-By", async () => {
      const res = await request(app).get("/api/health");

      expect(res.status).toBe(200);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });
  });

  describe("Rate Limiting Middleware", () => {
    it("should enforce rate limiting and respond with 429 when max requests are exceeded", async () => {
      const testApp = express();
      const testLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 2,
        statusCode: 429,
        message: { error: "Too many requests" },
      });
      testApp.use(testLimiter);
      testApp.get("/test", (_req, res) => res.status(200).json({ ok: true }));

      const r1 = await request(testApp).get("/test");
      expect(r1.status).toBe(200);

      const r2 = await request(testApp).get("/test");
      expect(r2.status).toBe(200);

      const r3 = await request(testApp).get("/test");
      expect(r3.status).toBe(429);
      expect(r3.body).toEqual({ error: "Too many requests" });
    });

    it("should export defined authLimiter and apiLimiter", () => {
      expect(authLimiter).toBeDefined();
      expect(apiLimiter).toBeDefined();
    });
  });
});
