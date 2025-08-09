import type { Request } from "express";

// Simple shared-secret verification via header
export function verifyHeliusSecret(req: Request, expected: string) {
  const header = req.headers["x-helius-secret"];
  return typeof header === "string" && header === expected;
}