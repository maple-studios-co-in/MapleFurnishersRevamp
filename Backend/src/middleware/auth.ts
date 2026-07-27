import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../lib/errors";

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new AppError(401, "Missing bearer token");
  try {
    jwt.verify(header.slice(7), env.JWT_SECRET);
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }
  next();
}