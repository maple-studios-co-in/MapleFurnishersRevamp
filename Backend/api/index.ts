/**
 * Vercel serverless entry point.
 *
 * Vercel invokes this module for every request (vercel.json rewrites all
 * paths here). An Express app is itself a (req, res) handler, so exporting
 * it is all that's needed. Locally, `npm run dev` still uses src/server.ts
 * with a long-running listener — this file is production-only.
 */
import { createApp } from "../src/app";

export default createApp();
