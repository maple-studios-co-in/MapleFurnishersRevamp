import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { requireAdmin } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

const ProductInput = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, "lowercase letters, digits and dashes only"),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).default(""),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3).default("USD"),
  imageUrl: z.string().min(1),
  category: z.string().min(1).max(60),
  isPublished: z.boolean().default(true),
});

const SCENES = ["day-room", "evening-room", "dining", "bedroom", "terrace"] as const;

const PlacementInput = z.object({
  scene: z.enum(SCENES),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  x0: z.number().min(0).max(100).nullish(),
  y0: z.number().min(0).max(100).nullish(),
  side: z.enum(["left", "right"]).default("right"),
  sortOrder: z.number().int().default(0),
});

/**
 * ADMIN product management. Mounted at the SAME path as the public product
 * router (/api/products) but registered FIRST, so its concrete routes —
 * /all, /:id/placements — win before the public router's /:slug catch-all
 * can swallow them.
 */
export const adminProductsRouter = Router();

adminProductsRouter.get("/all", requireAdmin, async (_req, res) => {
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ products });
});

adminProductsRouter.post("/", requireAdmin, validate(ProductInput), async (req, res) => {
  const product = await prisma.product.create({ data: req.body });
  res.status(201).json({ product });
});

adminProductsRouter.patch(
  "/:id",
  requireAdmin,
  validate(ProductInput.partial()),
  async (req, res) => {
    const id = String(req.params.id);
    try {
      const product = await prisma.product.update({ where: { id }, data: req.body });
      res.json({ product });
    } catch {
      throw new AppError(404, "Product not found");
    }
  },
);

adminProductsRouter.delete("/:id", requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  try {
    await prisma.product.delete({ where: { id } });
  } catch {
    throw new AppError(404, "Product not found");
  }
  res.status(204).end();
});

/* ── Placements: where a product appears on the film ─────────────────── */

/** Every placement for one product, for the admin's edit form. */
adminProductsRouter.get("/:id/placements", requireAdmin, async (req, res) => {
  const placements = await prisma.productPlacement.findMany({
    where: { productId: String(req.params.id) },
    orderBy: [{ scene: "asc" }, { sortOrder: "asc" }],
  });
  res.json({ placements });
});

/**
 * Add or move a placement. Upsert on (productId, scene) so re-saving the
 * same scene nudges the existing dot instead of creating a duplicate.
 */
adminProductsRouter.put(
  "/:id/placements",
  requireAdmin,
  validate(PlacementInput),
  async (req, res) => {
    const productId = String(req.params.id);
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new AppError(404, "Product not found");

    const { scene, ...rest } = req.body;
    const placement = await prisma.productPlacement.upsert({
      where: { productId_scene: { productId, scene } },
      update: rest,
      create: { productId, scene, ...rest },
    });
    res.json({ placement });
  },
);

/** Remove a product from one scene, leaving the product itself intact. */
adminProductsRouter.delete("/:id/placements/:scene", requireAdmin, async (req, res) => {
  try {
    await prisma.productPlacement.delete({
      where: {
        productId_scene: {
          productId: String(req.params.id),
          scene: String(req.params.scene),
        },
      },
    });
  } catch {
    throw new AppError(404, "Placement not found");
  }
  res.status(204).end();
});
