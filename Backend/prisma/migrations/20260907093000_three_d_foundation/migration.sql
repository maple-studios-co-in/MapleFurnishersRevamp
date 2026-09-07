-- CreateEnum
CREATE TYPE "ThreeDJobStatus" AS ENUM ('awaiting_delivery', 'completed');

-- CreateEnum
CREATE TYPE "ThreeDAssetKind" AS ENUM ('web_model', 'blender_master', 'preview', 'texture', 'reference');

-- CreateEnum
CREATE TYPE "ThreeDVersionStatus" AS ENUM ('draft', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "ThreeDProduct" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "sourceTenantId" TEXT,
    "sourceModelId" TEXT,
    "sourceRevision" TEXT,
    "publishedVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreeDProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreeDImport" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sourceRevision" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreeDImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreeDJob" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "recipeVersion" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "ThreeDJobStatus" NOT NULL DEFAULT 'awaiting_delivery',
    "importId" TEXT,
    "inputSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ThreeDJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreeDAsset" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "ThreeDAssetKind" NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreeDAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreeDVersion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "jobId" TEXT,
    "manifest" JSONB NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" "ThreeDVersionStatus" NOT NULL DEFAULT 'draft',
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreeDVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreeDPublication" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "previousVersionId" TEXT,
    "publishedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreeDPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ThreeDProduct_slug_key" ON "ThreeDProduct"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ThreeDProduct_publishedVersionId_key" ON "ThreeDProduct"("publishedVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ThreeDProduct_sourceTenantId_sourceModelId_key" ON "ThreeDProduct"("sourceTenantId", "sourceModelId");

-- CreateIndex
CREATE UNIQUE INDEX "ThreeDImport_productId_sourceRevision_key" ON "ThreeDImport"("productId", "sourceRevision");

-- CreateIndex
CREATE UNIQUE INDEX "ThreeDJob_productId_idempotencyKey_key" ON "ThreeDJob"("productId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ThreeDAsset_storageKey_key" ON "ThreeDAsset"("storageKey");

-- CreateIndex
CREATE INDEX "ThreeDAsset_productId_idx" ON "ThreeDAsset"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ThreeDVersion_jobId_key" ON "ThreeDVersion"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "ThreeDVersion_productId_sequence_key" ON "ThreeDVersion"("productId", "sequence");

-- CreateIndex
CREATE INDEX "ThreeDPublication_productId_createdAt_idx" ON "ThreeDPublication"("productId", "createdAt");

-- AddForeignKey
ALTER TABLE "ThreeDProduct" ADD CONSTRAINT "ThreeDProduct_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "ThreeDVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreeDImport" ADD CONSTRAINT "ThreeDImport_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ThreeDProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreeDJob" ADD CONSTRAINT "ThreeDJob_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ThreeDProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreeDJob" ADD CONSTRAINT "ThreeDJob_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ThreeDImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreeDAsset" ADD CONSTRAINT "ThreeDAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ThreeDProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreeDVersion" ADD CONSTRAINT "ThreeDVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ThreeDProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreeDVersion" ADD CONSTRAINT "ThreeDVersion_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ThreeDJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreeDPublication" ADD CONSTRAINT "ThreeDPublication_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ThreeDProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreeDPublication" ADD CONSTRAINT "ThreeDPublication_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ThreeDVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
