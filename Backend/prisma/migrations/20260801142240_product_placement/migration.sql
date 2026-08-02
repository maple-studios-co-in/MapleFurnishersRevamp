-- CreateTable
CREATE TABLE "ProductPlacement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "scene" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "x0" DOUBLE PRECISION,
    "y0" DOUBLE PRECISION,
    "side" TEXT NOT NULL DEFAULT 'right',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPlacement_scene_idx" ON "ProductPlacement"("scene");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPlacement_productId_scene_key" ON "ProductPlacement"("productId", "scene");

-- AddForeignKey
ALTER TABLE "ProductPlacement" ADD CONSTRAINT "ProductPlacement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
