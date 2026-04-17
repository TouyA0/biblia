CREATE TABLE "ProposalEvent" (
  "id"         TEXT         NOT NULL,
  "proposalId" TEXT         NOT NULL,
  "type"       TEXT         NOT NULL,
  "actorId"    TEXT,
  "note"       TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProposalEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProposalEvent"
  ADD CONSTRAINT "ProposalEvent_proposalId_fkey"
  FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProposalEvent"
  ADD CONSTRAINT "ProposalEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ProposalEvent_proposalId_idx" ON "ProposalEvent"("proposalId");
