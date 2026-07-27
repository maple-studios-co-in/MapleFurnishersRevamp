import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../../config/env";
import { AppError } from "../../lib/errors";
import { loginLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";

const LoginSchema = z.object({ email: z.email(), password: z.string().min(8) });

export const authRouter = Router();

authRouter.post("/login", loginLimiter, validate(LoginSchema), async (req, res) => {
  const { email, password } = req.body;
  const emailOk = email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase();
  const passOk = await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH);
  if (!emailOk || !passOk) throw new AppError(401, "Invalid credentials");
  const token = jwt.sign({ sub: email }, env.JWT_SECRET, { expiresIn: "12h" });
  res.json({ token, expiresInSeconds: 12 * 60 * 60 });
});