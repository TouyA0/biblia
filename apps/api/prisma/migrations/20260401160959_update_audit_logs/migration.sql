-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "userAgent" TEXT,
ALTER COLUMN "targetType" DROP NOT NULL,
ALTER COLUMN "targetId" DROP NOT NULL;
