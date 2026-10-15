import { Role } from "@prisma/client";
import { Request } from "express";

export interface AuthenticatedUserPayload {
  id: string;
  email: string;
  role: Role;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUserPayload;
}
