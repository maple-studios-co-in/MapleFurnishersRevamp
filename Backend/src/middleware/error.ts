import type { NextFunction, Request, Response } from "express";
import { isProd } from "../config/env";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, details: err.details });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: isProd ? "Internal server error" : String(err) });
}