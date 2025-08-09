export type Side = "BUY" | "SELL";

export interface ParsedTransfer {
  walletAddress: string; // the tracked wallet
  tokenAddress: string;  // SPL mint or WSOL mint for SOL
  amount: string;        // decimal string
  signature: string;
  timestamp: string;     // ISO string
  side: Side;            // BUY if wallet receives token, SELL if sends
}