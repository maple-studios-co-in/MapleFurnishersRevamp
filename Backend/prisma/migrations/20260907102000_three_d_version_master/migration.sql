-- Private source master lineage is optional for manually supplied GLB deliveries.
ALTER TABLE "ThreeDVersion" ADD COLUMN "masterAssetId" TEXT;
ALTER TABLE "ThreeDVersion" ADD CONSTRAINT "ThreeDVersion_masterAssetId_fkey"
FOREIGN KEY ("masterAssetId") REFERENCES "ThreeDAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
