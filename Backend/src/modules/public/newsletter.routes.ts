import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { publicFormLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";

const SubscribeSchema = z.object({ email: z.email() });

/** PUBLIC newsletter signup — called by the site's footer form. */
export const publicNewsletterRouter = Router();

publicNewsletterRouter.post(
  "/",
  publicFormLimiter,
  validate(SubscribeSchema),
  async (req, res) => {
    const email = req.body.email.toLowerCase();
    // Upsert: re-subscribing an existing address just clears unsubscribedAt,
    // and the response never reveals whether the address was already known.
    await prisma.subscriber.upsert({
      where: { email },
      update: { unsubscribedAt: null },
      create: { email },
    });
    res.status(201).json({ message: "Thank you — you're on the list." });
  },
);
