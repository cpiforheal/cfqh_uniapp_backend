-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "openId" TEXT NOT NULL,
    "nickname" TEXT,
    "avatarUrl" TEXT,
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" DATETIME,
    "lastClientEnv" TEXT,
    "lastPlatform" TEXT,
    "lastDevice" TEXT,
    "lastSdkVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserLoginLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "openId" TEXT NOT NULL,
    "nickname" TEXT,
    "clientEnv" TEXT,
    "platform" TEXT,
    "device" TEXT,
    "sdkVersion" TEXT,
    "appVersion" TEXT,
    "source" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserLoginLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LicenseToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unused',
    "subjectScope" TEXT NOT NULL DEFAULT 'nursing',
    "resourceScope" TEXT NOT NULL DEFAULT 'all',
    "maxBindCount" INTEGER NOT NULL DEFAULT 1,
    "groupTag" TEXT,
    "boundUserId" TEXT,
    "boundOpenId" TEXT,
    "boundAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LicenseActivationAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codeInput" TEXT NOT NULL,
    "codeNormalized" TEXT,
    "tokenId" TEXT,
    "userId" TEXT,
    "openId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "tokenStatus" TEXT,
    "clientEnv" TEXT,
    "platform" TEXT,
    "device" TEXT,
    "sdkVersion" TEXT,
    "appVersion" TEXT,
    "source" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LicenseActivationAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LicenseActivationAttempt_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "LicenseToken" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserAuthorization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "licenseTokenId" TEXT NOT NULL,
    "subjectScope" TEXT NOT NULL DEFAULT 'nursing',
    "resourceScope" TEXT NOT NULL DEFAULT 'all',
    "activatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserAuthorization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserAuthorization_licenseTokenId_fkey" FOREIGN KEY ("licenseTokenId") REFERENCES "LicenseToken" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KnowledgePoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectCode" TEXT NOT NULL DEFAULT 'nursing',
    "name" TEXT NOT NULL,
    "chapter" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectCode" TEXT NOT NULL DEFAULT 'nursing',
    "moduleCode" TEXT NOT NULL DEFAULT 'anatomy',
    "moduleName" TEXT NOT NULL DEFAULT '人体解剖学',
    "chapter" TEXT NOT NULL DEFAULT '待补充小章节',
    "chapterSort" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "stem" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "knowledgeTags" TEXT NOT NULL,
    "optionsJson" TEXT NOT NULL DEFAULT '[]',
    "answer" TEXT NOT NULL,
    "analysis" TEXT NOT NULL,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CaseMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectCode" TEXT NOT NULL DEFAULT 'nursing',
    "title" TEXT NOT NULL,
    "background" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "relatedKnowledgeTags" TEXT NOT NULL,
    "analysisFocus" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ConfusingPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectCode" TEXT NOT NULL DEFAULT 'nursing',
    "title" TEXT NOT NULL,
    "leftConcept" TEXT NOT NULL,
    "rightConcept" TEXT NOT NULL,
    "contrastSummary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MemoryTip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectCode" TEXT NOT NULL DEFAULT 'nursing',
    "title" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "relatedKnowledgeTags" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VideoLesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectCode" TEXT NOT NULL DEFAULT 'nursing',
    "moduleCode" TEXT NOT NULL DEFAULT 'anatomy',
    "moduleName" TEXT NOT NULL DEFAULT '人体解剖学',
    "chapter" TEXT NOT NULL DEFAULT '待补充小章节',
    "title" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "knowledgeTags" TEXT NOT NULL,
    "coverUrl" TEXT,
    "assetKey" TEXT,
    "videoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VideoAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectCode" TEXT NOT NULL DEFAULT 'nursing',
    "filename" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "sizeMB" REAL NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'local',
    "downloadUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DailyPractice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectCode" TEXT NOT NULL DEFAULT 'nursing',
    "date" DATETIME NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionTitle" TEXT NOT NULL,
    "knowledgeTags" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PracticeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "submittedAnswer" TEXT,
    "selectedOption" TEXT,
    "isCorrect" BOOLEAN NOT NULL,
    "practiceMode" TEXT NOT NULL DEFAULT 'daily',
    "sequenceNo" INTEGER,
    "totalCount" INTEGER,
    "durationMs" INTEGER,
    "sessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mistake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "wrongCount" INTEGER NOT NULL DEFAULT 1,
    "lastWrongAt" DATETIME,
    "nextReviewAt" DATETIME,
    "selectedOption" TEXT,
    "mastered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Mistake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Mistake_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VideoPlayRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "watchDurationMs" INTEGER,
    "progress" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoPlayRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" TEXT,
    "operatorId" TEXT,
    "operator" TEXT NOT NULL DEFAULT 'admin',
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'teacher',
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    CONSTRAINT "AdminSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subjectCode" TEXT NOT NULL DEFAULT 'nursing',
    "durationMin" INTEGER NOT NULL,
    "totalScore" REAL NOT NULL,
    "maxStudents" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "stem" TEXT NOT NULL,
    "optionsJson" TEXT NOT NULL DEFAULT '[]',
    "answer" TEXT NOT NULL,
    "analysis" TEXT,
    "score" REAL NOT NULL,
    "isObjective" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamLicense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "boundUserId" TEXT,
    "boundOpenId" TEXT,
    "boundAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamLicense_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "objectiveScore" REAL,
    "subjectiveScore" REAL,
    "totalScore" REAL,
    "rank" INTEGER,
    "hideCount" INTEGER NOT NULL DEFAULT 0,
    "hideDurationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamSession_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamSession_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "ExamLicense" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT,
    "isCorrect" BOOLEAN,
    "score" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExamQuestion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamComment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_openId_key" ON "User"("openId");

-- CreateIndex
CREATE INDEX "UserLoginLog_openId_idx" ON "UserLoginLog"("openId");

-- CreateIndex
CREATE INDEX "UserLoginLog_createdAt_idx" ON "UserLoginLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseToken_code_key" ON "LicenseToken"("code");

-- CreateIndex
CREATE INDEX "LicenseActivationAttempt_openId_idx" ON "LicenseActivationAttempt"("openId");

-- CreateIndex
CREATE INDEX "LicenseActivationAttempt_tokenId_idx" ON "LicenseActivationAttempt"("tokenId");

-- CreateIndex
CREATE INDEX "LicenseActivationAttempt_userId_idx" ON "LicenseActivationAttempt"("userId");

-- CreateIndex
CREATE INDEX "LicenseActivationAttempt_reason_idx" ON "LicenseActivationAttempt"("reason");

-- CreateIndex
CREATE INDEX "LicenseActivationAttempt_createdAt_idx" ON "LicenseActivationAttempt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserAuthorization_userId_key" ON "UserAuthorization"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoAsset_fileKey_key" ON "VideoAsset"("fileKey");

-- CreateIndex
CREATE INDEX "PracticeRecord_userId_idx" ON "PracticeRecord"("userId");

-- CreateIndex
CREATE INDEX "PracticeRecord_questionId_idx" ON "PracticeRecord"("questionId");

-- CreateIndex
CREATE INDEX "PracticeRecord_sessionId_idx" ON "PracticeRecord"("sessionId");

-- CreateIndex
CREATE INDEX "PracticeRecord_createdAt_idx" ON "PracticeRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_questionId_key" ON "Favorite"("userId", "questionId");

-- CreateIndex
CREATE INDEX "Mistake_userId_idx" ON "Mistake"("userId");

-- CreateIndex
CREATE INDEX "Mistake_nextReviewAt_idx" ON "Mistake"("nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "Mistake_userId_questionId_key" ON "Mistake"("userId", "questionId");

-- CreateIndex
CREATE INDEX "VideoPlayRecord_userId_idx" ON "VideoPlayRecord"("userId");

-- CreateIndex
CREATE INDEX "VideoPlayRecord_videoId_idx" ON "VideoPlayRecord"("videoId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");

-- CreateIndex
CREATE INDEX "AdminAuditLog_operatorId_idx" ON "AdminAuditLog"("operatorId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE INDEX "AdminUser_role_idx" ON "AdminUser"("role");

-- CreateIndex
CREATE INDEX "AdminUser_status_idx" ON "AdminUser"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_adminUserId_idx" ON "AdminSession"("adminUserId");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE INDEX "ExamQuestion_examId_idx" ON "ExamQuestion"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamLicense_code_key" ON "ExamLicense"("code");

-- CreateIndex
CREATE INDEX "ExamLicense_examId_idx" ON "ExamLicense"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSession_licenseId_key" ON "ExamSession"("licenseId");

-- CreateIndex
CREATE INDEX "ExamSession_examId_idx" ON "ExamSession"("examId");

-- CreateIndex
CREATE INDEX "ExamSession_userId_idx" ON "ExamSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAnswer_sessionId_questionId_key" ON "ExamAnswer"("sessionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamComment_sessionId_key" ON "ExamComment"("sessionId");
