-- AlterTable
ALTER TABLE "DeckCard" ADD COLUMN     "language" TEXT;

-- AlterTable
ALTER TABLE "SyncRun" ALTER COLUMN "division" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "eventDate" TEXT,
ADD COLUMN     "reportedPlayerCountApproximate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resultsCoverage" TEXT NOT NULL DEFAULT 'COMPLETE_STANDINGS',
ALTER COLUMN "division" DROP NOT NULL,
ALTER COLUMN "season" DROP NOT NULL,
ALTER COLUMN "reportedPlayerCount" DROP NOT NULL,
ALTER COLUMN "sourceCompleted" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TournamentEntry" ALTER COLUMN "points" DROP NOT NULL,
ALTER COLUMN "wins" DROP NOT NULL,
ALTER COLUMN "losses" DROP NOT NULL,
ALTER COLUMN "ties" DROP NOT NULL,
ALTER COLUMN "disqualified" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TournamentDuplicateCandidate" (
    "id" TEXT NOT NULL,
    "tournamentAId" TEXT NOT NULL,
    "tournamentBId" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentDuplicateCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultDuplicateCandidate" (
    "id" TEXT NOT NULL,
    "entryAId" TEXT NOT NULL,
    "entryBId" TEXT NOT NULL,
    "tournamentCandidateId" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultDuplicateCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentDuplicateCandidate_tournamentAId_tournamentBId_key" ON "TournamentDuplicateCandidate"("tournamentAId", "tournamentBId");

-- CreateIndex
CREATE UNIQUE INDEX "ResultDuplicateCandidate_entryAId_entryBId_key" ON "ResultDuplicateCandidate"("entryAId", "entryBId");

-- AddForeignKey
ALTER TABLE "TournamentDuplicateCandidate" ADD CONSTRAINT "TournamentDuplicateCandidate_tournamentAId_fkey" FOREIGN KEY ("tournamentAId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentDuplicateCandidate" ADD CONSTRAINT "TournamentDuplicateCandidate_tournamentBId_fkey" FOREIGN KEY ("tournamentBId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultDuplicateCandidate" ADD CONSTRAINT "ResultDuplicateCandidate_entryAId_fkey" FOREIGN KEY ("entryAId") REFERENCES "TournamentEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultDuplicateCandidate" ADD CONSTRAINT "ResultDuplicateCandidate_entryBId_fkey" FOREIGN KEY ("entryBId") REFERENCES "TournamentEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultDuplicateCandidate" ADD CONSTRAINT "ResultDuplicateCandidate_tournamentCandidateId_fkey" FOREIGN KEY ("tournamentCandidateId") REFERENCES "TournamentDuplicateCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NULL represents a genuinely unknown division. It still participates in identity/job exclusion.
DROP INDEX "Tournament_source_externalId_division_key";
CREATE UNIQUE INDEX "Tournament_source_externalId_division_key" ON "Tournament" ("source", "externalId", "division") NULLS NOT DISTINCT;
DROP INDEX "SyncRun_one_running_per_event";
CREATE UNIQUE INDEX "SyncRun_one_running_per_event" ON "SyncRun" ("source", "externalId", "division") NULLS NOT DISTINCT WHERE "status" = 'RUNNING';
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_coverage_check" CHECK ("resultsCoverage" IN ('COMPLETE_STANDINGS', 'PUBLISHED_RESULTS', 'UNKNOWN'));
ALTER TABLE "TournamentDuplicateCandidate" ADD CONSTRAINT "TournamentDuplicateCandidate_order_check" CHECK ("tournamentAId" < "tournamentBId");
ALTER TABLE "ResultDuplicateCandidate" ADD CONSTRAINT "ResultDuplicateCandidate_order_check" CHECK ("entryAId" < "entryBId");
