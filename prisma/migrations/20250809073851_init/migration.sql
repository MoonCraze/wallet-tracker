-- CreateTable
CREATE TABLE "TransferEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "side" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "TransferEvent_walletAddress_timestamp_idx" ON "TransferEvent"("walletAddress", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "TransferEvent_walletAddress_tokenAddress_signature_key" ON "TransferEvent"("walletAddress", "tokenAddress", "signature");
