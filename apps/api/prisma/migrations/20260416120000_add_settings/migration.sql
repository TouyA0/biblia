CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "Setting" ADD CONSTRAINT "Setting_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Setting" ("key", "value", "updatedAt") VALUES
    ('vote_threshold_accept', '5', NOW()),
    ('vote_threshold_reject', '-3', NOW());
