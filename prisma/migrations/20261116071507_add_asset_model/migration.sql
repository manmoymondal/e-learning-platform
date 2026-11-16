-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('VIDEO', 'PDF', 'THUMBNAIL', 'PROFILE_PICTURE');

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "originalFilename" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileSize" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asset_assetType_idx" ON "Asset"("assetType");
