-- CreateEnum
CREATE TYPE "UpdateSource" AS ENUM ('OFFICE', 'COURT');

-- CreateEnum
CREATE TYPE "FilingKind" AS ENUM ('REQUEST', 'COMMUNICATION');

-- CreateEnum
CREATE TYPE "FilingDirection" AS ENUM ('SUBMITTED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "FilingStatus" AS ENUM ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ExecutionActionType" AS ENUM ('DECISION', 'BANK_ATTACHMENT', 'TRAVEL_BAN', 'TRAVEL_BAN_LIFTED', 'PROPERTY_ATTACHMENT', 'VEHICLE_ATTACHMENT', 'ATTACHMENT_LIFTED', 'EXECUTION_HEARING', 'AMOUNT_COLLECTED', 'DEPOSIT', 'EXPERT_REPORT', 'VALUATION', 'AUCTION', 'COURT_FEE', 'REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "CourtUpdateKind" AS ENUM ('HEARING', 'DECISION', 'EXECUTION', 'PARTY', 'DOCUMENT', 'STAGE', 'NEW_CASE', 'OTHER');

-- CreateEnum
CREATE TYPE "CourtUpdateStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED');

-- AlterTable
ALTER TABLE "Hearing" ADD COLUMN     "source" "UpdateSource" NOT NULL DEFAULT 'OFFICE';

-- AlterTable
ALTER TABLE "MatterEvent" ADD COLUMN     "source" "UpdateSource" NOT NULL DEFAULT 'OFFICE';

-- CreateTable
CREATE TABLE "CourtFiling" (
    "id" TEXT NOT NULL,
    "kind" "FilingKind" NOT NULL DEFAULT 'REQUEST',
    "direction" "FilingDirection" NOT NULL DEFAULT 'SUBMITTED',
    "matterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reference" TEXT,
    "status" "FilingStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "responseDueAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),
    "response" TEXT,
    "assigneeId" TEXT,
    "createdById" TEXT,
    "notes" TEXT,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CourtFiling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionAction" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "type" "ExecutionActionType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "amount" DECIMAL(14,2),
    "source" "UpdateSource" NOT NULL DEFAULT 'OFFICE',
    "courtUpdateId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExecutionAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtUpdate" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalId" TEXT,
    "courtSystem" TEXT,
    "courtCaseNo" TEXT NOT NULL,
    "matterId" TEXT,
    "kind" "CourtUpdateKind" NOT NULL,
    "executionType" "ExecutionActionType",
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "amount" DECIMAL(14,2),
    "nextHearingAt" TIMESTAMP(3),
    "payload" JSONB,
    "status" "CourtUpdateStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3),
    "appliedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourtUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourtFiling_matterId_idx" ON "CourtFiling"("matterId");

-- CreateIndex
CREATE INDEX "CourtFiling_followUpAt_idx" ON "CourtFiling"("followUpAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionAction_courtUpdateId_key" ON "ExecutionAction"("courtUpdateId");

-- CreateIndex
CREATE INDEX "ExecutionAction_matterId_date_idx" ON "ExecutionAction"("matterId", "date");

-- CreateIndex
CREATE INDEX "CourtUpdate_status_createdAt_idx" ON "CourtUpdate"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CourtUpdate_courtCaseNo_idx" ON "CourtUpdate"("courtCaseNo");

-- CreateIndex
CREATE UNIQUE INDEX "CourtUpdate_source_externalId_key" ON "CourtUpdate"("source", "externalId");

-- AddForeignKey
ALTER TABLE "CourtFiling" ADD CONSTRAINT "CourtFiling_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtFiling" ADD CONSTRAINT "CourtFiling_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionAction" ADD CONSTRAINT "ExecutionAction_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtUpdate" ADD CONSTRAINT "CourtUpdate_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

