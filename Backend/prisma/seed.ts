import { PrismaClient } from "@prisma/client";
import process from "process";


const prisma = new PrismaClient();

const products = [
  { slug: "maple-chair", name: "Maple Chair", category: "seating", priceCents: 64900, imageUrl: "/images/products/maple-chair.webp", description: "Steam-bent maple, hand-finished. The chair the workshop is named for." },
  { slug: "sofa", name: "Heartwood Sofa", category: "seating", priceCents: 249900, imageUrl: "/images/products/sofa.webp", description: "Three-seat sofa on a solid maple frame with feather-wrapped cushions." },
  { slug: "coffee-table", name: "Coffee Table", category: "tables", priceCents: 89900, imageUrl: "/images/products/coffee-table.webp", description: "Low table in figured maple with a hand-rubbed oil finish." },
  { slug: "side-table", name: "Side Table", category: "tables", priceCents: 39900, imageUrl: "/images/products/side-table.webp", description: "Compact companion table, dovetailed by hand." },
  { slug: "floor-lamp", name: "Floor Lamp", category: "lighting", priceCents: 54900, imageUrl: "/images/products/floor-lamp.webp", description: "Turned maple stem with a linen drum shade." },
  { slug: "area-rug", name: "Area Rug", category: "textiles", priceCents: 74900, imageUrl: "/images/products/area-rug.webp", description: "Hand-loomed wool in workshop-neutral tones." },
];

async function main() {
  for (const p of products) {
    await prisma.product.upsert({ where: { slug: p.slug }, update: p, create: p });
  }
  console.log(`Seeded ${products.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());