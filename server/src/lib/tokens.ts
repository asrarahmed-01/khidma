import jwt, { type SignOptions } from "jsonwebtoken";
import { config } from "../config";
import type { Role } from "../generated/prisma/client";

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
}

export function signAccessToken(user: { id: string; role: Role }): string {
  const options: SignOptions = {
    expiresIn: config.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    algorithm: "HS256",
  };
  return jwt.sign({ role: user.role }, config.JWT_SECRET, { ...options, subject: user.id });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ["HS256"] });
  if (typeof decoded === "string" || !decoded.sub) throw new Error("Malformed token");
  return { sub: decoded.sub, role: decoded.role as Role };
}
