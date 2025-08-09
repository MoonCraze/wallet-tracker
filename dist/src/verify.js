// Simple shared-secret verification via header
export function verifyHeliusSecret(req, expected) {
    const header = req.headers["x-helius-secret"];
    return typeof header === "string" && header === expected;
}
