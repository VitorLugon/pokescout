CREATE TABLE "IdentityReview" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerAId" TEXT NOT NULL REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "playerBId" TEXT NOT NULL REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "decision" TEXT NOT NULL,
  "reviewer" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "evidenceUrls" JSONB NOT NULL,
  "evidence" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdentityReview_pair_check" CHECK ("playerAId" < "playerBId"),
  CONSTRAINT "IdentityReview_decision_check" CHECK ("decision" IN ('SAME_PERSON', 'DIFFERENT_PEOPLE', 'UNCERTAIN'))
);
CREATE INDEX "IdentityReview_playerAId_playerBId_createdAt_idx" ON "IdentityReview"("playerAId", "playerBId", "createdAt");
CREATE TABLE "DecklistReview" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "deckId" TEXT NOT NULL REFERENCES "Deck"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "runId" TEXT NOT NULL REFERENCES "SyncRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "outcome" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "beforeCards" JSONB NOT NULL,
  "afterCards" JSONB,
  "previousImportedAt" TIMESTAMP(3),
  "retrievedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DecklistReview_outcome_check" CHECK ("outcome" IN ('IMPORTED', 'UNCHANGED', 'CHANGED', 'FAILED'))
);
CREATE INDEX "DecklistReview_deckId_createdAt_idx" ON "DecklistReview"("deckId", "createdAt");
CREATE INDEX "DecklistReview_runId_idx" ON "DecklistReview"("runId");
