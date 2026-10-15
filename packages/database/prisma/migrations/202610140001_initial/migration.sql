-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "DecklistStatus" AS ENUM ('UNAVAILABLE', 'AVAILABLE', 'IMPORTED', 'FAILED');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAlias" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "searchKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceIdentity" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateLabel" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "format" TEXT,
    "expectedDeckSize" INTEGER,
    "country" TEXT,
    "season" INTEGER NOT NULL,
    "reportedPlayerCount" INTEGER NOT NULL,
    "sourceCompleted" BOOLEAN NOT NULL DEFAULT false,
    "fullySynchronized" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT NOT NULL,
    "upstreamIds" JSONB NOT NULL,
    "raw" JSONB NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentEntry" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "country" TEXT,
    "placement" INTEGER,
    "points" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "ties" INTEGER NOT NULL,
    "disqualified" BOOLEAN NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "raw" JSONB NOT NULL,

    CONSTRAINT "TournamentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "archetypeId" TEXT,
    "archetypeName" TEXT,
    "decklistUrl" TEXT,
    "availableAtSource" BOOLEAN NOT NULL DEFAULT false,
    "listStatus" "DecklistStatus" NOT NULL DEFAULT 'UNAVAILABLE',
    "listImportedAt" TIMESTAMP(3),
    "lastListAttemptAt" TIMESTAMP(3),
    "lastListError" TEXT,
    "rawList" JSONB,

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckCard" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "setCode" TEXT NOT NULL,
    "collectorNumber" TEXT NOT NULL,

    CONSTRAINT "DeckCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "entriesReceived" INTEGER NOT NULL DEFAULT 0,
    "entriesSaved" INTEGER NOT NULL DEFAULT 0,
    "listsImported" INTEGER NOT NULL DEFAULT 0,
    "pendingLists" INTEGER NOT NULL DEFAULT 0,
    "issues" JSONB NOT NULL,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerAlias_searchKey_idx" ON "PlayerAlias"("searchKey");

-- CreateIndex
CREATE INDEX "PlayerAlias_normalizedName_idx" ON "PlayerAlias"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAlias_playerId_originalName_key" ON "PlayerAlias"("playerId", "originalName");

-- CreateIndex
CREATE INDEX "SourceIdentity_playerId_idx" ON "SourceIdentity"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceIdentity_source_scope_externalId_key" ON "SourceIdentity"("source", "scope", "externalId");

-- CreateIndex
CREATE INDEX "Tournament_startsAt_idx" ON "Tournament"("startsAt");

-- CreateIndex
CREATE INDEX "Tournament_season_division_idx" ON "Tournament"("season", "division");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_source_externalId_division_key" ON "Tournament"("source", "externalId", "division");

-- CreateIndex
CREATE INDEX "TournamentEntry_playerId_tournamentId_idx" ON "TournamentEntry"("playerId", "tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentEntry_tournamentId_externalId_key" ON "TournamentEntry"("tournamentId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Deck_entryId_key" ON "Deck"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "DeckCard_deckId_position_key" ON "DeckCard"("deckId", "position");

-- CreateIndex
CREATE INDEX "SyncRun_source_externalId_division_startedAt_idx" ON "SyncRun"("source", "externalId", "division", "startedAt");

-- CreateIndex
CREATE INDEX "SyncRun_status_idx" ON "SyncRun"("status");

-- AddForeignKey
ALTER TABLE "PlayerAlias" ADD CONSTRAINT "PlayerAlias_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceIdentity" ADD CONSTRAINT "SourceIdentity_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TournamentEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckCard" ADD CONSTRAINT "DeckCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain constraints not expressible in Prisma's schema language.
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_counts_check" CHECK ("reportedPlayerCount" >= 0 AND ("expectedDeckSize" IS NULL OR "expectedDeckSize" > 0));
ALTER TABLE "TournamentEntry" ADD CONSTRAINT "TournamentEntry_result_check" CHECK (("placement" IS NULL OR "placement" > 0) AND "wins" >= 0 AND "losses" >= 0 AND "ties" >= 0 AND "points" >= 0);
ALTER TABLE "DeckCard" ADD CONSTRAINT "DeckCard_quantity_check" CHECK ("quantity" > 0 AND "position" >= 0);
ALTER TABLE "DeckCard" ADD CONSTRAINT "DeckCard_category_check" CHECK ("category" IN ('pokemon', 'trainer', 'energy'));
CREATE UNIQUE INDEX "SyncRun_one_running_per_event" ON "SyncRun" ("source", "externalId", "division") WHERE "status" = 'RUNNING';
