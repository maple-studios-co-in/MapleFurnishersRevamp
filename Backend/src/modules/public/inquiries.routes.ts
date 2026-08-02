import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { sendMail } from "../../lib/mailer";
import { prisma } from "../../lib/prisma";
import { publicFormLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";

const InquirySchema = z.object({
  name: z.string().min(2).max(100),
  email: z.email(),
  phone: z.string().max(30).optional(),
  message: z.string().min(10).max(2000),
});

/** PUBLIC consultation form — called by the site's contact section. */
export const publicInquiriesRouter = Router();

publicInquiriesRouter.post(
  "/",
  publicFormLimiter,
  validate(InquirySchema),
  async (req, res) => {
    const inquiry = await prisma.inquiry.create({ data: req.body });
    // Fire-and-forget: a slow or broken mailbox must never fail the
    // customer's request.
    void sendMail({
      to: env.INQUIRY_NOTIFY_TO ?? env.ADMIN_EMAIL,
      subject: `New consultation inquiry — ${inquiry.name}`,
      text: `Name: ${inquiry.name}\nEmail: ${inquiry.email}\nPhone: ${inquiry.phone ?? "—"}\n\n${inquiry.message}`,
    });
    res
      .status(201)
      .json({ message: "Thank you — we'll be in touch within two business days." });
  },
);
