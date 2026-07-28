import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { corsOrigins } from "./config/env";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { adminRouter } from "./modules/admin/admin.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { inquiriesRouter } from "./modules/inquiries/inquiries.routes";
import { newsletterRouter } from "./modules/newsletter/newsletter.routes";
import { productsRouter } from "./modules/products/products.routes";

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

  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/newsletter", newsletterRouter);
  app.use("/api/inquiries", inquiriesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}