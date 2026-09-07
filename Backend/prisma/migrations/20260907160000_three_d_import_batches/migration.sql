-- CreateEnum
CREATE TYPE "ThreeDImportBatchStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ThreeDImportItemStatus" AS ENUM ('pending', 'running', 'imported', 'unchanged', 'failed', 'cancelled');

-- AlterTable
ALTER TABLE "ThreeDJob" ADD COLUMN     "geometryGroupId" TEXT;

-- AlterTable
ALTER TABLE "ThreeDVersion" ADD COLUMN     "geometryGroupId" TEXT;

-- CreateTable
CREATE TABLE "ThreeDImportBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" "ThreeDImportBatchStatus" NOT NULL DEFAULT 'queued',
    "cursor" TEXT,
    "nextCursor" TEXT,
    "listLoadedAt" TIMESTAMP(3),
    "bytesReserved" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "attemptDeadline" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreeDImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreeDImportItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sourceRevision" TEXT NOT NULL,
    "status" "ThreeDImportItemStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ThreeDImportItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThreeDImportBatch_tenantId_status_createdAt_idx" ON "ThreeDImportBatch"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ThreeDImportBatch_tenantId_idempotencyKey_key" ON "ThreeDImportBatch"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ThreeDImportItem_batchId_modelId_key" ON "ThreeDImportItem"("batchId", "modelId");

-- CreateIndex
CREATE UNIQUE INDEX "ThreeDImportItem_batchId_position_key" ON "ThreeDImportItem"("batchId", "position");

-- AddForeignKey
ALTER TABLE "ThreeDImportItem" ADD CONSTRAINT "ThreeDImportItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ThreeDImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Worker claims also use a transaction advisory lock; this constraint guards future writers.
CREATE UNIQUE INDEX "ThreeDImportBatch_one_running_per_tenant" ON "ThreeDImportBatch"("tenantId") WHERE "status" = 'running';
ALTER TABLE "ThreeDImportBatch" ADD CONSTRAINT "ThreeDImportBatch_bytes_budget" CHECK ("bytesReserved" BETWEEN 0 AND 524288000);
