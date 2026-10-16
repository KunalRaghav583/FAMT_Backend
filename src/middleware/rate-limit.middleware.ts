import rateLimit from "express-rate-limit";
import { env } from "../config/env";

/**
 * Strict rate limiter for authentication endpoints (/api/auth/login, /api/auth/register).
 * Protects against credential stuffing and brute-force dictionary attacks.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 20, // Max 20 requests per IP per 15-minute window
  standardHeaders: true, // Draft-6 RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  statusCode: 429,
  message: {
    error: "Too many authentication attempts, please try again after 15 minutes.",
  },
  skip: () => env.NODE_ENV === "test", // Skip during automated test suites
});

/**
 * General API rate limiter for all /api endpoints.
 * Protects against application-layer Denial of Service (DoS) and scraping.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 500, // Max 500 requests per IP per 15-minute window
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    error: "Too many requests from this IP, please try again after 15 minutes.",
  },
  skip: () => env.NODE_ENV === "test", // Skip during automated test suites
});
