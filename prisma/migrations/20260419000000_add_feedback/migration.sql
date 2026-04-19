-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "memberId" TEXT,
    "familyId" TEXT,
    "userName" TEXT,
    "userEmail" TEXT,
    "pageUrl" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "screenshot" TEXT,
    "consoleLogs" JSONB,
    "category" TEXT NOT NULL DEFAULT 'bug',
    "status" TEXT NOT NULL DEFAULT 'open',
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_status_idx" ON "Feedback"("status");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Feedback_familyId_idx" ON "Feedback"("familyId");
