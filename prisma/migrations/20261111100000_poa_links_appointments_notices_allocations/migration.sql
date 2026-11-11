-- CreateEnum
CREATE TYPE "AppointmentKind" AS ENUM ('CLIENT_MEETING', 'INTERNAL_MEETING', 'CONSULTATION', 'COURT_VISIT', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContactPreference" AS ENUM ('IN_PERSON', 'PHONE', 'WHATSAPP', 'EMAIL', 'VIDEO');

-- CreateEnum
CREATE TYPE "NoticeDirection" AS ENUM ('OUTGOING', 'INCOMING');

-- CreateEnum
CREATE TYPE "NoticeMethod" AS ENUM ('NOTARY', 'COURT_BAILIFF', 'COURIER', 'REGISTERED_MAIL', 'EMAIL', 'WHATSAPP', 'HAND_DELIVERY', 'OTHER');

-- CreateEnum
CREATE TYPE "NoticeStatus" AS ENUM ('DRAFT', 'SENT', 'DELIVERED', 'REFUSED', 'FAILED');

-- AlterTable
ALTER TABLE "PowerOfAttorney" ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterPoa" (
    "matterId" TEXT NOT NULL,
    "poaId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedById" TEXT,

    CONSTRAINT "MatterPoa_pkey" PRIMARY KEY ("matterId","poaId")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "AppointmentKind" NOT NULL DEFAULT 'CLIENT_MEETING',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "location" TEXT,
    "onlineLink" TEXT,
    "clientId" TEXT,
    "matterId" TEXT,
    "organizerId" TEXT NOT NULL,
    "language" TEXT,
    "contactPreference" "ContactPreference",
    "notes" TEXT,
    "outcome" TEXT,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentAttendee" (
    "appointmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AppointmentAttendee_pkey" PRIMARY KEY ("appointmentId","userId")
);

-- CreateTable
CREATE TABLE "LegalNotice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "direction" "NoticeDirection" NOT NULL DEFAULT 'OUTGOING',
    "clientId" TEXT NOT NULL,
    "matterId" TEXT,
    "counterparty" TEXT NOT NULL,
    "method" "NoticeMethod" NOT NULL DEFAULT 'NOTARY',
    "status" "NoticeStatus" NOT NULL DEFAULT 'DRAFT',
    "reference" TEXT,
    "sentAt" TIMESTAMP(3),
    "servedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "graceDays" INTEGER,
    "dueDate" TIMESTAMP(3),
    "deadlineId" TEXT,
    "documentId" TEXT,
    "assigneeId" TEXT,
    "createdById" TEXT,
    "notes" TEXT,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LegalNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_invoiceId_key" ON "PaymentAllocation"("paymentId", "invoiceId");

-- CreateIndex
CREATE INDEX "Appointment_startAt_idx" ON "Appointment"("startAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalNotice_deadlineId_key" ON "LegalNotice"("deadlineId");

-- CreateIndex
CREATE INDEX "LegalNotice_dueDate_idx" ON "LegalNotice"("dueDate");

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterPoa" ADD CONSTRAINT "MatterPoa_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterPoa" ADD CONSTRAINT "MatterPoa_poaId_fkey" FOREIGN KEY ("poaId") REFERENCES "PowerOfAttorney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentAttendee" ADD CONSTRAINT "AppointmentAttendee_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentAttendee" ADD CONSTRAINT "AppointmentAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalNotice" ADD CONSTRAINT "LegalNotice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalNotice" ADD CONSTRAINT "LegalNotice_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalNotice" ADD CONSTRAINT "LegalNotice_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Existing single-invoice payments become one allocation each, so settlement keeps working unchanged.
INSERT INTO "PaymentAllocation" ("id", "paymentId", "invoiceId", "amount")
SELECT 'alloc_' || p."id", p."id", p."invoiceId", p."amount"
FROM "Payment" p
WHERE p."invoiceId" IS NOT NULL;
