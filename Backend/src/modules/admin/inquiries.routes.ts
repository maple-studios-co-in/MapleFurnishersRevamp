import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { requireAdmin } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

const StatusSchema = z.object({ status: z.enum(["NEW", "CONTACTED", "CLOSED"]) });

/** ADMIN inquiry triage. Mounted after the public POST route. */
export const adminInquiriesRouter = Router();

adminInquiriesRouter.get("/", requireAdmin, async (_req, res) => {
  const inquiries = await prisma.inquiry.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ inquiries });
});

adminInquiriesRouter.patch(
  "/:id/status",
  requireAdmin,
  validate(StatusSchema),
  async (req, res) => {
    const id = String(req.params.id);
    try {
      const inquiry = await prisma.inquiry.update({
        where: { id },
        data: { status: req.body.status },
      });
      res.json({ inquiry });
    } catch {
      throw new AppError(404, "Inquiry not found");
    }
  },
);
