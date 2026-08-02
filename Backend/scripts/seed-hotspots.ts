/**
 * Seed the 19 products and 23 placements that make up the outro film's
 * shoppable hotspots.
 *
 * Every name, description, image and coordinate below is lifted verbatim
 * from Frontend/src/components/sections/OutroScene.tsx, so once the site
 * reads from the API the composition is unchanged.
 *
 * Safe to re-run: products upsert on slug, placements on (product, scene).
 *
 *   npx tsx scripts/seed-hotspots.ts
 */
// Load .env before the client is constructed. The server gets this via
// config/env.ts on boot, but a standalone script has no such bootstrap.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

type Seed = {
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
};

const PRODUCTS: Seed[] = [
  { slug: "aria-lounge-chair",  name: "Aria Lounge Chair",  description: "Comfort designed to welcome you home.",              imageUrl: "/images/products/maple-chair.webp",   category: "seating"  },
  { slug: "haven-sectional",    name: "Haven Sectional",    description: "Deep seats in traceable natural linen.",             imageUrl: "/images/products/sofa.webp",          category: "seating"  },
  { slug: "orbit-coffee-table", name: "Orbit Coffee Table", description: "Turned from a single walnut blank.",                 imageUrl: "/images/products/coffee-table.webp",  category: "tables"   },
  { slug: "pebble-side-table",  name: "Pebble Side Table",  description: "A quiet perch for the evening cup.",                 imageUrl: "/images/products/side-table.webp",    category: "tables"   },
  { slug: "column-floor-lamp",  name: "Column Floor Lamp",  description: "Soft, paper-diffused light.",                        imageUrl: "/images/products/floor-lamp.webp",    category: "lighting" },
  { slug: "terra-weave-rug",    name: "Terra Weave Rug",    description: "Hand-knotted jute, edge to edge.",                   imageUrl: "/images/products/area-rug.webp",      category: "textiles" },
  { slug: "glow-table-lamp",    name: "Glow Table Lamp",    description: "A warm mushroom of light for the sideboard.",        imageUrl: "/images/products/table-lamp.webp",    category: "lighting" },
  { slug: "longtable-no-4",     name: "Longtable No. 4",    description: "Seats eight, remembers every one.",                  imageUrl: "/images/products/dining-table.webp",  category: "tables"   },
  { slug: "credenza-low",       name: "Credenza Low",       description: "Quiet storage in oiled walnut.",                     imageUrl: "/images/products/sideboard.webp",     category: "storage"  },
  { slug: "bow-dining-chairs",  name: "Bow Dining Chairs",  description: "Steam-bent backs, linen seats.",                     imageUrl: "/images/products/dining-chairs.webp", category: "seating"  },
  { slug: "tiered-pendant",     name: "Tiered Pendant",     description: "Layered light over the table.",                      imageUrl: "/images/products/pendant-light.webp", category: "lighting" },
  { slug: "lag-platform-bed",   name: "Låg Platform Bed",   description: "Floating solid-timber frame, no hardware in sight.", imageUrl: "/images/products/bed.webp",           category: "beds"     },
  { slug: "ember-wall-light",   name: "Ember Wall Light",   description: "Warm pools of light where you need them.",           imageUrl: "/images/products/wall-lamp.webp",     category: "lighting" },
  { slug: "foot-bench",         name: "Foot Bench",         description: "The landing spot for the day's end.",                imageUrl: "/images/products/bench.webp",         category: "seating"  },
  { slug: "dune-bedroom-rug",   name: "Dune Bedroom Rug",   description: "Barefoot-soft wool underfoot.",                      imageUrl: "/images/products/bedroom-rug.webp",   category: "textiles" },
  { slug: "vista-outdoor-sofa", name: "Vista Outdoor Sofa", description: "All-weather comfort, golden hour included.",         imageUrl: "/images/products/outdoor-sofa.webp",  category: "outdoor"  },
  { slug: "rope-lounge-chair",  name: "Rope Lounge Chair",  description: "Hand-woven cord over a teak frame.",                 imageUrl: "/images/products/outdoor-chair.webp", category: "outdoor"  },
  { slug: "plateau-low-table",  name: "Plateau Low Table",  description: "Weatherproof stone-top centrepiece.",                imageUrl: "/images/products/terrace-table.webp", category: "outdoor"  },
  { slug: "ceramic-planters",   name: "Ceramic Planters",   description: "Glazed terracotta, frost-safe.",                     imageUrl: "/images/products/planter.webp",       category: "decor"    },
];

type Placement = {
  slug: string;
  scene: string;
  x: number;
  y: number;
  x0?: number;
  y0?: number;
  side: "left" | "right";
  sortOrder: number;
};

/** sortOrder restarts per scene — it orders dots WITHIN a scene. */
const PLACEMENTS: Placement[] = [
  { slug: "aria-lounge-chair",  scene: "day-room",     x: 24, y: 55, side: "right", sortOrder: 0 },
  { slug: "haven-sectional",    scene: "day-room",     x: 63, y: 52, side: "left",  sortOrder: 1 },
  { slug: "orbit-coffee-table", scene: "day-room",     x: 50, y: 76, side: "right", sortOrder: 2 },
  { slug: "pebble-side-table",  scene: "day-room",     x: 10, y: 68, side: "right", sortOrder: 3 },
  { slug: "column-floor-lamp",  scene: "day-room",     x: 47, y: 30, side: "right", sortOrder: 4 },
  { slug: "terra-weave-rug",    scene: "day-room",     x: 36, y: 88, side: "right", sortOrder: 5 },

  { slug: "aria-lounge-chair",  scene: "evening-room", x: 24, y: 55, side: "right", sortOrder: 0 },
  { slug: "haven-sectional",    scene: "evening-room", x: 63, y: 52, side: "left",  sortOrder: 1 },
  { slug: "orbit-coffee-table", scene: "evening-room", x: 50, y: 76, side: "right", sortOrder: 2 },
  { slug: "glow-table-lamp",    scene: "evening-room", x: 13, y: 42, side: "right", sortOrder: 3 },

  { slug: "longtable-no-4",     scene: "dining",       x: 46, y: 62, side: "right", sortOrder: 0 },
  { slug: "credenza-low",       scene: "dining",       x: 78, y: 48, side: "left",  sortOrder: 1 },
  { slug: "bow-dining-chairs",  scene: "dining",       x: 28, y: 66, side: "right", sortOrder: 2 },
  { slug: "tiered-pendant",     scene: "dining",       x: 44, y: 18, side: "right", sortOrder: 3 },
  { slug: "glow-table-lamp",    scene: "dining",       x: 87, y: 42, side: "left",  sortOrder: 4 },

  { slug: "lag-platform-bed",   scene: "bedroom",      x: 42, y: 58, side: "right", sortOrder: 0 },
  { slug: "ember-wall-light",   scene: "bedroom",      x: 12, y: 38, side: "right", sortOrder: 1 },
  { slug: "foot-bench",         scene: "bedroom",      x: 48, y: 78, side: "right", sortOrder: 2 },
  { slug: "dune-bedroom-rug",   scene: "bedroom",      x: 26, y: 88, side: "right", sortOrder: 3 },

  // The terrace camera pushes in, so these carry a start AND an end point.
  { slug: "vista-outdoor-sofa", scene: "terrace", x: 26, y: 75, x0: 30, y0: 67, side: "right", sortOrder: 0 },
  { slug: "rope-lounge-chair",  scene: "terrace", x: 76, y: 81, x0: 72, y0: 70, side: "left",  sortOrder: 1 },
  { slug: "plateau-low-table",  scene: "terrace", x: 48, y: 86, x0: 48, y0: 71, side: "right", sortOrder: 2 },
  { slug: "ceramic-planters",   scene: "terrace", x: 81, y: 71, x0: 76, y0: 57, side: "left",  sortOrder: 3 },
];

async function main() {
  let renamed = 0;
  let created = 0;

  for (const p of PRODUCTS) {
    // The six rows already in the database are the SAME furniture under
    // different names (maple-chair vs aria-lounge-chair). Match them on
    // imageUrl and rename in place, so seeding does not leave duplicates.
    const existing =
      (await prisma.product.findUnique({ where: { slug: p.slug } })) ??
      (await prisma.product.findFirst({ where: { imageUrl: p.imageUrl } }));

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          slug: p.slug,
          name: p.name,
          description: p.description,
          imageUrl: p.imageUrl,
          category: p.category,
        },
      });
      if (existing.slug !== p.slug) renamed++;
    } else {
      await prisma.product.create({
        // priceCents 0 on purpose: the film carries no prices. Set real
        // ones in the admin — nothing on the site renders them yet.
        data: { ...p, priceCents: 0, currency: "USD", isPublished: true },
      });
      created++;
    }
  }

  let placed = 0;
  for (const pl of PLACEMENTS) {
    const product = await prisma.product.findUnique({ where: { slug: pl.slug } });
    if (!product) {
      console.warn(`  ! no product for ${pl.slug} — skipping placement`);
      continue;
    }
    const { slug: _slug, scene, ...rest } = pl;
    await prisma.productPlacement.upsert({
      where: { productId_scene: { productId: product.id, scene } },
      update: rest,
      create: { productId: product.id, scene, ...rest },
    });
    placed++;
  }

  const total = await prisma.product.count();
  console.log(
    `products: ${created} created, ${renamed} renamed in place · placements: ${placed} · catalogue now ${total}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
