-- Freeze the display name and source revision with each model version.
ALTER TABLE "ThreeDVersion" ADD COLUMN "productName" TEXT;
ALTER TABLE "ThreeDVersion" ADD COLUMN "sourceRevision" TEXT;
UPDATE "ThreeDVersion" AS v SET "productName" = p."name", "sourceRevision" = p."sourceRevision"
FROM "ThreeDProduct" AS p WHERE p.id = v."productId";
ALTER TABLE "ThreeDVersion" ALTER COLUMN "productName" SET NOT NULL;
