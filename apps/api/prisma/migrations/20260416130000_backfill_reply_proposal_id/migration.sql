-- Backfill proposalId on replies whose parent comment has a proposalId
UPDATE "Comment" child
SET "proposalId" = parent."proposalId"
FROM "Comment" parent
WHERE child."parentId" = parent.id
  AND parent."proposalId" IS NOT NULL
  AND child."proposalId" IS NULL;
