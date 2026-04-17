-- WordTranslationStatus enum
CREATE TYPE "WordTranslationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- Extend WordTranslation
ALTER TABLE "WordTranslation"
  ADD COLUMN "status"     "WordTranslationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reason"     TEXT,
  ADD COLUMN "tags"       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- Migrate existing isValidated → status
UPDATE "WordTranslation" SET "status" = 'ACCEPTED', "reviewedAt" = NOW() WHERE "isValidated" = true;

-- FK reviewedBy
ALTER TABLE "WordTranslation"
  ADD CONSTRAINT "WordTranslation_reviewedBy_fkey"
  FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- WordTranslationVersion
CREATE TABLE "WordTranslationVersion" (
  "id"                TEXT         NOT NULL,
  "wordTranslationId" TEXT         NOT NULL,
  "translation"       TEXT         NOT NULL,
  "changeReason"      TEXT,
  "versionNumber"     INTEGER      NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WordTranslationVersion_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "WordTranslationVersion"
  ADD CONSTRAINT "WordTranslationVersion_wordTranslationId_fkey"
  FOREIGN KEY ("wordTranslationId") REFERENCES "WordTranslation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "WordTranslationVersion_wordTranslationId_idx" ON "WordTranslationVersion"("wordTranslationId");

-- WordTranslationEvent
CREATE TABLE "WordTranslationEvent" (
  "id"                TEXT         NOT NULL,
  "wordTranslationId" TEXT         NOT NULL,
  "type"              TEXT         NOT NULL,
  "actorId"           TEXT,
  "note"              TEXT,
  "score"             INTEGER,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WordTranslationEvent_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "WordTranslationEvent"
  ADD CONSTRAINT "WordTranslationEvent_wordTranslationId_fkey"
  FOREIGN KEY ("wordTranslationId") REFERENCES "WordTranslation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WordTranslationEvent"
  ADD CONSTRAINT "WordTranslationEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "WordTranslationEvent_wordTranslationId_idx" ON "WordTranslationEvent"("wordTranslationId");

-- wordTranslationId on Comment
ALTER TABLE "Comment"
  ADD COLUMN "wordTranslationId" TEXT;
ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_wordTranslationId_fkey"
  FOREIGN KEY ("wordTranslationId") REFERENCES "WordTranslation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Comment_wordTranslationId_idx" ON "Comment"("wordTranslationId");

-- General perf indexes
CREATE INDEX "WordTranslation_wordTokenId_idx" ON "WordTranslation"("wordTokenId");
