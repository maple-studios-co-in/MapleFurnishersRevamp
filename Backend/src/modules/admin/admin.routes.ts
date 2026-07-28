import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAdmin } from "../../middleware/auth";

export const adminRouter = Router();

adminRouter.get("/stats", requireAdmin, async (_req, res) => {
  const [
    totalProducts,
    publishedProducts,
    totalInquiries,
    newInquiries,
    contactedInquiries,
    closedInquiries,
    activeSubscribers,
    recentInquiries,
    recentSubscribers,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { isPublished: true } }),
    prisma.inquiry.count(),
    prisma.inquiry.count({ where: { status: "NEW" } }),
    prisma.inquiry.count({ where: { status: "CONTACTED" } }),
    prisma.inquiry.count({ where: { status: "CLOSED" } }),
    prisma.subscriber.count({ where: { unsubscribedAt: null } }),
    prisma.inquiry.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.subscriber.findMany({
      where: { unsubscribedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  res.json({
    products: {
      total: totalProducts,
      published: publishedProducts,
      draft: totalProducts - publishedProducts,
    },
    inquiries: {
      total: totalInquiries,
      new: newInquiries,
      contacted: contactedInquiries,
      closed: closedInquiries,
      recent: recentInquiries,
    },
    subscribers: {
      active: activeSubscribers,
      recent: recentSubscribers,
    },
  });
});
