-- CreateTable
CREATE TABLE "StudyCardAuthorization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "openId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudyCardAuthorization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudyCardAuthorization_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "LicenseToken" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StudyCardAuthorization_userId_key" ON "StudyCardAuthorization"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyCardAuthorization_openId_key" ON "StudyCardAuthorization"("openId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyCardAuthorization_tokenId_key" ON "StudyCardAuthorization"("tokenId");
