import { Router } from "express";
import { AppError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";

/**
 * PUBLIC product reads — everything the marketing site is allowed to see.
 * No auth: these responses are the website's content.
 */
export const publicProductsRouter = Router();

/**
 * The shoppable hotspots for the outro film, grouped by scene.
 *
 * Shaped to match the Hotspot interface OutroScene already uses, so the
 * component can swap its hardcoded SCENES array for this with no reshaping.
 *
 * MUST stay above `/:slug` — Express matches in order, so `/:slug` would
 * otherwise capture "scenes" and 404.
 */
publicProductsRouter.get("/scenes", async (_req, res) => {
  const placements = await prisma.productPlacement.findMany({
    where: { product: { isPublished: true } },
    orderBy: { sortOrder: "asc" },
    include: { product: true },
  });

  const scenes: Record<string, unknown[]> = {};
  for (const p of placements) {
    (scenes[p.scene] ??= []).push({
      slug: p.product.slug,
      name: p.product.name,
      desc: p.product.description,
      img: p.product.imageUrl,
      priceCents: p.product.priceCents,
      currency: p.product.currency,
      x: p.x,
      y: p.y,
      x0: p.x0,
      y0: p.y0,
      side: p.side,
    });
  }
  res.json({ scenes });
});

publicProductsRouter.get("/", async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({ products });
});

publicProductsRouter.get("/:slug", async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { slug: req.params.slug, isPublished: true },
  });
  if (!product) throw new AppError(404, "Product not found");
  res.json({ product });
});
