-- AlterTable: Add elimination bracket fields to Tournament
ALTER TABLE "Tournament" ADD COLUMN "format" TEXT NOT NULL DEFAULT 'score-based';
ALTER TABLE "Tournament" ADD COLUMN "gameId" TEXT;
ALTER TABLE "Tournament" ADD COLUMN "bracketSize" INTEGER;
ALTER TABLE "Tournament" ADD COLUMN "currentRound" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "BracketParticipant" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "eliminated" BOOLEAN NOT NULL DEFAULT false,
    "eliminatedAt" TIMESTAMP(3),
    "eliminatedIn" INTEGER,

    CONSTRAINT "BracketParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketMatch" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "player1Id" TEXT,
    "player2Id" TEXT,
    "winnerId" TEXT,
    "loserId" TEXT,
    "player1Score" INTEGER,
    "player2Score" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "roomCode" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BracketMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BracketParticipant_tournamentId_memberId_key" ON "BracketParticipant"("tournamentId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "BracketParticipant_tournamentId_seed_key" ON "BracketParticipant"("tournamentId", "seed");

-- CreateIndex
CREATE INDEX "BracketParticipant_tournamentId_eliminated_idx" ON "BracketParticipant"("tournamentId", "eliminated");

-- CreateIndex
CREATE UNIQUE INDEX "BracketMatch_tournamentId_round_position_key" ON "BracketMatch"("tournamentId", "round", "position");

-- CreateIndex
CREATE INDEX "BracketMatch_tournamentId_round_idx" ON "BracketMatch"("tournamentId", "round");

-- CreateIndex
CREATE INDEX "BracketMatch_tournamentId_status_idx" ON "BracketMatch"("tournamentId", "status");

-- AddForeignKey
ALTER TABLE "BracketParticipant" ADD CONSTRAINT "BracketParticipant_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketParticipant" ADD CONSTRAINT "BracketParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketMatch" ADD CONSTRAINT "BracketMatch_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
