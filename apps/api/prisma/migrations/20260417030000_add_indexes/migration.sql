-- ============================================================
-- Indexes manquants — couvre tous les WHERE et ORDER BY de l'API
-- IF NOT EXISTS pour les 4 déjà créés par la migration précédente
-- ============================================================

-- Chapter
CREATE INDEX IF NOT EXISTS "Chapter_bookId_idx" ON "Chapter"("bookId");

-- Verse
CREATE INDEX IF NOT EXISTS "Verse_chapterId_idx" ON "Verse"("chapterId");

-- VerseText
CREATE INDEX IF NOT EXISTS "VerseText_verseId_idx" ON "VerseText"("verseId");
CREATE INDEX IF NOT EXISTS "VerseText_verseId_language_idx" ON "VerseText"("verseId", "language");

-- Translation
CREATE INDEX IF NOT EXISTS "Translation_verseId_idx" ON "Translation"("verseId");
CREATE INDEX IF NOT EXISTS "Translation_verseId_isActive_idx" ON "Translation"("verseId", "isActive");

-- WordToken
CREATE INDEX IF NOT EXISTS "WordToken_verseTextId_idx" ON "WordToken"("verseTextId");
CREATE INDEX IF NOT EXISTS "WordToken_lemma_idx" ON "WordToken"("lemma");

-- WordTranslation (wordTokenId déjà créé dans migration précédente)
CREATE INDEX IF NOT EXISTS "WordTranslation_wordTokenId_idx" ON "WordTranslation"("wordTokenId");
CREATE INDEX IF NOT EXISTS "WordTranslation_status_idx" ON "WordTranslation"("status");
CREATE INDEX IF NOT EXISTS "WordTranslation_createdBy_idx" ON "WordTranslation"("createdBy");

-- Proposal
CREATE INDEX IF NOT EXISTS "Proposal_translationId_idx" ON "Proposal"("translationId");
CREATE INDEX IF NOT EXISTS "Proposal_status_idx" ON "Proposal"("status");
CREATE INDEX IF NOT EXISTS "Proposal_createdBy_idx" ON "Proposal"("createdBy");

-- ProposalVersion
CREATE INDEX IF NOT EXISTS "ProposalVersion_proposalId_idx" ON "ProposalVersion"("proposalId");

-- WordTranslationVersion (déjà créé dans migration précédente)
CREATE INDEX IF NOT EXISTS "WordTranslationVersion_wordTranslationId_idx" ON "WordTranslationVersion"("wordTranslationId");

-- WordTranslationEvent (déjà créé dans migration précédente)
CREATE INDEX IF NOT EXISTS "WordTranslationEvent_wordTranslationId_idx" ON "WordTranslationEvent"("wordTranslationId");

-- ProposalEvent
CREATE INDEX IF NOT EXISTS "ProposalEvent_proposalId_idx" ON "ProposalEvent"("proposalId");

-- Vote (les @@unique couvrent userId+proposalId et userId+wordTranslationId,
--       mais pas les lookups sur proposalId / wordTranslationId seuls)
CREATE INDEX IF NOT EXISTS "Vote_proposalId_idx" ON "Vote"("proposalId");
CREATE INDEX IF NOT EXISTS "Vote_wordTranslationId_idx" ON "Vote"("wordTranslationId");

-- Comment (wordTranslationId déjà créé dans migration précédente)
CREATE INDEX IF NOT EXISTS "Comment_verseId_idx" ON "Comment"("verseId");
CREATE INDEX IF NOT EXISTS "Comment_proposalId_idx" ON "Comment"("proposalId");
CREATE INDEX IF NOT EXISTS "Comment_wordTokenId_idx" ON "Comment"("wordTokenId");
CREATE INDEX IF NOT EXISTS "Comment_wordTranslationId_idx" ON "Comment"("wordTranslationId");
CREATE INDEX IF NOT EXISTS "Comment_parentId_idx" ON "Comment"("parentId");
CREATE INDEX IF NOT EXISTS "Comment_createdBy_idx" ON "Comment"("createdBy");

-- AuditLog
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- Session
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");

-- Notification
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");
