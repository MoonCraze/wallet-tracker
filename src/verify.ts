import type { Request } from "express";

// Simple shared-secret verification via header
export function verifyHeliusSecret(req: Request, expected: string) {
  // Support either custom header or Authorization: Bearer <secret>
  const h = req.headers;
  const xSecret = h["x-helius-secret"];
  if (typeof xSecret === "string" && xSecret === expected) return true;

  const auth = h["authorization"];
  if (typeof auth === "string") {
    const m = auth.match(/^Bearer\s+(.*)$/i);
    if (m && m[1] === expected) return true;
  }
  return false;
}