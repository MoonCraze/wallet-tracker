-- CreateTable
CREATE TABLE "TransferEvent" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "side" TEXT NOT NULL,

    CONSTRAINT "TransferEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoordinatedTrade" (
    "id" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "uniqueWalletCount" INTEGER NOT NULL,
    "walletAddresses" TEXT NOT NULL,

    CONSTRAINT "CoordinatedTrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransferEvent_walletAddress_timestamp_idx" ON "TransferEvent"("walletAddress", "timestamp");

-- CreateIndex
CREATE INDEX "TransferEvent_tokenAddress_timestamp_idx" ON "TransferEvent"("tokenAddress", "timestamp");

-- CreateIndex
CREATE INDEX "TransferEvent_signature_idx" ON "TransferEvent"("signature");

-- CreateIndex
CREATE UNIQUE INDEX "TransferEvent_walletAddress_tokenAddress_signature_key" ON "TransferEvent"("walletAddress", "tokenAddress", "signature");

-- CreateIndex
CREATE INDEX "CoordinatedTrade_tokenAddress_windowStart_idx" ON "CoordinatedTrade"("tokenAddress", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "CoordinatedTrade_tokenAddress_windowStart_key" ON "CoordinatedTrade"("tokenAddress", "windowStart");
