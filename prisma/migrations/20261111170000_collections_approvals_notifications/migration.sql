-- CreateEnum
CREATE TYPE "CollectionAction" AS ENUM ('CALL', 'EMAIL', 'WHATSAPP', 'VISIT', 'LETTER', 'LEGAL_ACTION', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalState" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- AlterTable
ALTER TABLE "FeeInstallment" ADD COLUMN     "reminderSent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "deliveryError" TEXT,
ADD COLUMN     "emailStatus" TEXT,
ADD COLUMN     "whatsappStatus" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "escalatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notificationPrefs" JSONB;

-- CreateTable
CREATE TABLE "CollectionNote" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "action" "CollectionAction" NOT NULL,
    "outcome" TEXT NOT NULL,
    "promisedAmount" DECIMAL(14,2),
    "promisedDate" TIMESTAMP(3),
    "nextFollowUp" TIMESTAMP(3),
    "assigneeId" TEXT,
    "createdById" TEXT,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientApproval" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "matterId" TEXT,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "status" "ApprovalState" NOT NULL DEFAULT 'PENDING',
    "response" TEXT,
    "respondedAt" TIMESTAMP(3),
    "respondedById" TEXT,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionNote_clientId_date_idx" ON "CollectionNote"("clientId", "date");

-- CreateIndex
CREATE INDEX "CollectionNote_nextFollowUp_idx" ON "CollectionNote"("nextFollowUp");

-- CreateIndex
CREATE INDEX "ClientApproval_clientId_status_idx" ON "ClientApproval"("clientId", "status");

-- AddForeignKey
ALTER TABLE "CollectionNote" ADD CONSTRAINT "CollectionNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientApproval" ADD CONSTRAINT "ClientApproval_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

