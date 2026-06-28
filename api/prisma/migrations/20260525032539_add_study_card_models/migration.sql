-- CreateTable
CREATE TABLE "StudyCardModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moduleCode" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StudyCardQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moduleId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "stem" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'single_choice',
    "optionsJson" TEXT NOT NULL DEFAULT '[]',
    "answer" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudyCardQuestion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "StudyCardModule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudyCardKnowledgeCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "bodyJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudyCardKnowledgeCard_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "StudyCardQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StudyCardModule_moduleCode_key" ON "StudyCardModule"("moduleCode");

-- CreateIndex
CREATE INDEX "StudyCardQuestion_moduleId_idx" ON "StudyCardQuestion"("moduleId");

-- CreateIndex
CREATE INDEX "StudyCardKnowledgeCard_questionId_idx" ON "StudyCardKnowledgeCard"("questionId");
