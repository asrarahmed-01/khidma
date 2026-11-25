import type { Request, RequestHandler } from "express";
import { prisma } from "../db";
import type { Role, User } from "../generated/prisma/client";
import { forbidden, unauthorized } from "../lib/errors";
import { verifyAccessToken } from "../lib/tokens";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Verifies the Bearer token, then loads the user from the database on every request.
 * Loading the user (instead of trusting the role inside the token) means a role change,
 * such as an admin approving a technician, takes effect immediately without a re-login.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw unauthorized();

  let userId: string;
  try {
    userId = verifyAccessToken(header.slice("Bearer ".length)).sub;
  } catch {
    throw unauthorized("Invalid or expired token");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized("Account no longer exists");

  req.user = user;
  next();
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) {
      throw forbidden(`This action requires one of these roles: ${roles.join(", ")}`);
    }
    next();
  };

/** Returns the authenticated user; use only on routes behind `requireAuth`. */
export function currentUser(req: Request): User {
  if (!req.user) throw unauthorized();
  return req.user;
}
