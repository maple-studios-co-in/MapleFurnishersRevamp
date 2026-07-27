import nodemailer from "nodemailer";
import { env } from "../config/env";
import { logger } from "./logger";

const configured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

const transporter = configured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 465,
      secure: (env.SMTP_PORT ?? 465) === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  : null;

export async function sendMail(opts: { to: string; subject: string; text: string }) {
  if (!transporter) {
    logger.warn({ subject: opts.subject }, "SMTP not configured — skipping email");
    return;
  }
  try {
    await transporter.sendMail({ from: `"Maple Furnishers" <${env.SMTP_USER}>`, ...opts });
  } catch (err) {
    logger.error({ err }, "Failed to send email");
  }
}