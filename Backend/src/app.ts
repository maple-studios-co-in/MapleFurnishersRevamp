import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { corsOrigins } from "./config/env";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { authRouter } from "./modules/admin/auth.routes";
import { adminInquiriesRouter } from "./modules/admin/inquiries.routes";
import { adminNewsletterRouter } from "./modules/admin/newsletter.routes";
import { adminProductsRouter } from "./modules/admin/products.routes";
import { adminStatsRouter } from "./modules/admin/stats.routes";
import { publicInquiriesRouter } from "./modules/public/inquiries.routes";
import { publicNewsletterRouter } from "./modules/public/newsletter.routes";
import { publicProductsRouter } from "./modules/public/products.routes";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1); // correct client IPs for rate limiting behind a host's proxy
  app.use(helmet());
  app.use(cors({ origin: corsOrigins }));
  app.use(express.json({ limit: "100kb" }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: Math.round(process.uptime()) });
  });

  /* ── Routes ────────────────────────────────────────────────────────
     Split by audience: modules/public/* is what the marketing site may
     call unauthenticated; modules/admin/* is everything behind
     requireAdmin. Several pairs share a mount path, and the ADMIN router
     is always registered first — Express matches in order, and the public
     routers end in a `/:slug` catch-all that would otherwise swallow
     concrete admin paths like /all and /:id/placements. */
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminStatsRouter);

  app.use("/api/products", adminProductsRouter);
  app.use("/api/products", publicProductsRouter);

  app.use("/api/newsletter", adminNewsletterRouter);
  app.use("/api/newsletter", publicNewsletterRouter);

  app.use("/api/inquiries", adminInquiriesRouter);
  app.use("/api/inquiries", publicInquiriesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}