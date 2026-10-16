import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const KNOWN_INSECURE_SECRETS = [
  "famt-default-jwt-secret-key-change-in-prod",
  "replace-with-a-secure-random-secret-in-production",
  "your-secret-key-min-32-chars",
  "secret",
  "password",
  "changeme",
  "jwt_secret",
];

export const envSchema = z
  .object({
    PORT: z.coerce.number().default(5000),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    JWT_SECRET: z.string().optional(),
    JWT_EXPIRES_IN: z.string().default("24h"),
    CORS_ORIGIN: z.string().default("http://localhost:5173"),
  })
  .superRefine((data, ctx) => {
    // 1. In production: strict validation
    if (data.NODE_ENV === "production") {
      if (!data.JWT_SECRET || data.JWT_SECRET.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "JWT_SECRET is required in production and must not be empty",
          path: ["JWT_SECRET"],
        });
        return;
      }

      if (data.JWT_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "In production, JWT_SECRET must be at least 32 characters long",
          path: ["JWT_SECRET"],
        });
      }

      const lowerSecret = data.JWT_SECRET.toLowerCase();
      const isKnownInsecure = KNOWN_INSECURE_SECRETS.some((insecure) =>
        lowerSecret.includes(insecure),
      );

      if (isKnownInsecure) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "In production, JWT_SECRET cannot use default, sample, or known insecure values",
          path: ["JWT_SECRET"],
        });
      }
    } else if (data.NODE_ENV === "development") {
      // 2. In development: must be present in .env and non-empty
      if (!data.JWT_SECRET || data.JWT_SECRET.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "JWT_SECRET is required in development. Please set it in your .env file.",
          path: ["JWT_SECRET"],
        });
      }
    }
  })
  .transform((data) => {
    // If running in test environment and JWT_SECRET wasn't explicitly supplied, use test secret
    const effectiveSecret =
      data.JWT_SECRET && data.JWT_SECRET.trim().length > 0
        ? data.JWT_SECRET
        : data.NODE_ENV === "test"
          ? "test-env-jwt-secret-key-must-be-min-32-chars-long"
          : "";

    return {
      ...data,
      JWT_SECRET: effectiveSecret,
    };
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(input: Record<string, unknown>): Env {
  return envSchema.parse(input);
}

export const env = envSchema.parse(process.env);
