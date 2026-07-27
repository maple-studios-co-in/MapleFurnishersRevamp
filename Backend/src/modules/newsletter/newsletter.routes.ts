import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAdmin } from "../../middleware/auth";
import { publicFormLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";

const SubscribeSchema = z.object({ email: z.email() });

export const newsletterRouter = Router();

newsletterRouter.post("/", publicFormLimiter, validate(SubscribeSchema), async (req, res) => {
  const email = req.body.email.toLowerCase();
  // Upsert: re-subscribing an existing address just clears unsubscribedAt,
  // and the response never reveals whether the address was already known.
  await prisma.subscriber.upsert({
    where: { email },
    update: { unsubscribedAt: null },
    create: { email },
  });
  res.status(201).json({ message: "Thank you — you're on the list." });
});

newsletterRouter.get("/", requireAdmin, async (_req, res) => {
  const subscribers = await prisma.subscriber.findMany({
    where: { unsubscribedAt: null },
    orderBy: { createdAt: "desc" },
  });
  res.json({ count: subscribers.length, subscribers });
});