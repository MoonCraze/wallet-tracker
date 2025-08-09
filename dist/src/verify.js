// Shared-secret verification tolerant to header format variance from providers
export function verifyHeliusSecret(req, expected) {
    const h = req.headers;
    const candidates = [];
    const toArr = (v) => typeof v === "string" ? [v] : Array.isArray(v) ? (v.filter((x) => typeof x === "string")) : [];
    candidates.push(...toArr(h["x-helius-secret"]));
    candidates.push(...toArr(h["authorization"]));
    for (let raw of candidates) {
        if (!raw)
            continue;
        const v = String(raw).trim();
        if (v === expected)
            return true; // exact
        // Authorization: Bearer <secret>
        const mBearer = v.match(/^Bearer\s+(.+)$/i);
        if (mBearer && mBearer[1] === expected)
            return true;
        // Some providers send the literal "Authorization: ..." as the value
        const mAuthInline = v.match(/^Authorization\s*:\s*(?:Bearer\s+)?(.+)$/i);
        if (mAuthInline && mAuthInline[1] === expected)
            return true;
        // Tolerate "X-Helius-Secret: <secret>" mistakenly placed in Authorization
        const mXHelius = v.match(/^X-Helius-Secret\s*:\s*(.+)$/i);
        if (mXHelius && mXHelius[1] === expected)
            return true;
    }
    return false;
}
