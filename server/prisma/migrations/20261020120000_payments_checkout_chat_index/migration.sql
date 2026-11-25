-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "checkoutUrl" TEXT,
ADD COLUMN     "failureMessage" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "providerInvoiceId" TEXT,
ADD COLUMN     "returnUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerInvoiceId_key" ON "Payment"("providerInvoiceId");

-- CreateIndex
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");
