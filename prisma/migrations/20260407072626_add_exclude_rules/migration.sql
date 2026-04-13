-- CreateEnum
CREATE TYPE "ExcludeRuleType" AS ENUM ('CLASS', 'METHOD');

-- CreateTable
CREATE TABLE "ExcludeRule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ExcludeRuleType" NOT NULL,
    "className" TEXT NOT NULL,
    "methodName" TEXT,
    "matchParams" BOOLEAN NOT NULL DEFAULT false,
    "params" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExcludeRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExcludeRule_projectId_idx" ON "ExcludeRule"("projectId");

-- AddForeignKey
ALTER TABLE "ExcludeRule" ADD CONSTRAINT "ExcludeRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
