-- CreateTable
CREATE TABLE "CoordinatedTrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenAddress" TEXT NOT NULL,
    "windowStart" DATETIME NOT NULL,
    "windowEnd" DATETIME NOT NULL,
    "triggeredAt" DATETIME NOT NULL,
    "uniqueWalletCount" INTEGER NOT NULL,
    "walletAddresses" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "CoordinatedTrade_tokenAddress_windowStart_idx" ON "CoordinatedTrade"("tokenAddress", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "CoordinatedTrade_tokenAddress_windowStart_key" ON "CoordinatedTrade"("tokenAddress", "windowStart");

-- CreateIndex
CREATE INDEX "TransferEvent_tokenAddress_timestamp_idx" ON "TransferEvent"("tokenAddress", "timestamp");
