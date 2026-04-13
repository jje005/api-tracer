/*
  Warnings:

  - You are about to drop the column `uploadedAt` on the `ModuleVersion` table. All the data in the column will be lost.
  - You are about to drop the column `uploadedAt` on the `TestSuite` table. All the data in the column will be lost.
  - Added the required column `dirPath` to the `TestSuite` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ModuleVersion" DROP COLUMN "uploadedAt",
ADD COLUMN     "dirPath" TEXT,
ADD COLUMN     "parsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TestSuite" DROP COLUMN "uploadedAt",
ADD COLUMN     "dirPath" TEXT NOT NULL,
ADD COLUMN     "parsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
