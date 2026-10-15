import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthenticatedUserPayload } from "../types/auth.types";

export function signToken(
  payload: AuthenticatedUserPayload,
  expiresIn = env.JWT_EXPIRES_IN,
): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): AuthenticatedUserPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  return decoded as AuthenticatedUserPayload;
}
