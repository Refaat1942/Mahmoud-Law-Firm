-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "altPhone" TEXT,
ADD COLUMN     "mobile" TEXT;

-- AlterTable
ALTER TABLE "PowerOfAttorney" ADD COLUMN     "documentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PowerOfAttorney_documentId_key" ON "PowerOfAttorney"("documentId");

-- AddForeignKey
ALTER TABLE "PowerOfAttorney" ADD CONSTRAINT "PowerOfAttorney_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

