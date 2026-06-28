-- CreateTable
CREATE TABLE "StudyCardMastery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "mastered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "StudyCardMastery_userId_idx" ON "StudyCardMastery"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyCardMastery_userId_questionId_key" ON "StudyCardMastery"("userId", "questionId");
