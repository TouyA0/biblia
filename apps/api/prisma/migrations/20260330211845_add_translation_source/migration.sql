-- AlterTable
ALTER TABLE "Translation" ADD COLUMN     "isReference" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source" TEXT;
