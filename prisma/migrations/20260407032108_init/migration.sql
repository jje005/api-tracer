-- CreateEnum
CREATE TYPE "ModuleType" AS ENUM ('AAR', 'JAR');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('ADDED', 'REMOVED', 'MODIFIED', 'SAME');

-- CreateEnum
CREATE TYPE "TcLanguage" AS ENUM ('JAVA', 'KOTLIN');

-- CreateEnum
CREATE TYPE "CoverageStatus" AS ENUM ('COVERED', 'PARTIAL', 'UNCOVERED');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ModuleType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleVersion" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiEntry" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "methodName" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '[]',
    "returnType" TEXT NOT NULL,
    "accessModifier" TEXT NOT NULL DEFAULT 'public',
    "isStatic" BOOLEAN NOT NULL DEFAULT false,
    "isDeprecated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiSnapshot" (
    "id" TEXT NOT NULL,
    "moduleVersionId" TEXT NOT NULL,
    "apiEntryId" TEXT NOT NULL,
    "changeType" "ChangeType" NOT NULL DEFAULT 'SAME',

    CONSTRAINT "ApiSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSuite" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" "TcLanguage" NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestSuite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "suiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "calledApis" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coverage" (
    "id" TEXT NOT NULL,
    "apiId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "status" "CoverageStatus" NOT NULL DEFAULT 'COVERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "apiId" TEXT NOT NULL,
    "suggestedTestName" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "sampleCode" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Module_projectId_name_key" ON "Module"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleVersion_moduleId_version_key" ON "ModuleVersion"("moduleId", "version");

-- CreateIndex
CREATE INDEX "ApiEntry_moduleId_idx" ON "ApiEntry"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiEntry_moduleId_className_methodName_params_key" ON "ApiEntry"("moduleId", "className", "methodName", "params");

-- CreateIndex
CREATE UNIQUE INDEX "ApiSnapshot_moduleVersionId_apiEntryId_key" ON "ApiSnapshot"("moduleVersionId", "apiEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "Coverage_apiId_testCaseId_key" ON "Coverage"("apiId", "testCaseId");

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleVersion" ADD CONSTRAINT "ModuleVersion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiEntry" ADD CONSTRAINT "ApiEntry_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiSnapshot" ADD CONSTRAINT "ApiSnapshot_moduleVersionId_fkey" FOREIGN KEY ("moduleVersionId") REFERENCES "ModuleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiSnapshot" ADD CONSTRAINT "ApiSnapshot_apiEntryId_fkey" FOREIGN KEY ("apiEntryId") REFERENCES "ApiEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "TestSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coverage" ADD CONSTRAINT "Coverage_apiId_fkey" FOREIGN KEY ("apiId") REFERENCES "ApiEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coverage" ADD CONSTRAINT "Coverage_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_apiId_fkey" FOREIGN KEY ("apiId") REFERENCES "ApiEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
