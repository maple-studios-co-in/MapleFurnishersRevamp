import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAdmin } from "../../middleware/auth";

/** ADMIN subscriber list. Mounted after the public POST route. */
export const adminNewsletterRouter = Router();

adminNewsletterRouter.get("/", requireAdmin, async (_req, res) => {
  const subscribers = await prisma.subscriber.findMany({
    where: { unsubscribedAt: null },
    orderBy: { createdAt: "desc" },
  });
  res.json({ count: subscribers.length, subscribers });
});
