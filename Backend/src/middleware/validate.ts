import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "../lib/errors";

export const validate =
  (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new AppError(
        400,
        "Validation failed",
        result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      );
    }
    req.body = result.data;
    next();
  };