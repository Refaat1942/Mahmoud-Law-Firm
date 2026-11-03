-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT;

-- CreateIndex
CREATE INDEX "InvoiceLine_sourceType_sourceId_idx" ON "InvoiceLine"("sourceType", "sourceId");

