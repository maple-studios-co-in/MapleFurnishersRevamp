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

export const productsRouter = Router();

productsRouter.get("/", async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({ products });
});

productsRouter.get("/:slug", async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { slug: req.params.slug, isPublished: true },
  });
  if (!product) throw new AppError(404, "Product not found");
  res.json({ product });
});

productsRouter.post("/", requireAdmin, validate(ProductInput), async (req, res) => {
  const product = await prisma.product.create({ data: req.body });
  res.status(201).json({ product });
});

productsRouter.patch("/:id", requireAdmin, validate(ProductInput.partial()), async (req, res) => {
  const id = String(req.params.id);
  try {
    const product = await prisma.product.update({ where: { id }, data: req.body });
    res.json({ product });
  } catch {
    throw new AppError(404, "Product not found");
  }
});

productsRouter.delete("/:id", requireAdmin, async (req, res) => {
  const id = String(req.params.id);
  try {
    await prisma.product.delete({ where: { id } });
  } catch {
    throw new AppError(404, "Product not found");
  }
  res.status(204).end();
});