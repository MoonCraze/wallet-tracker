import { verifyHeliusSecret } from "../verify.js";
import { getEnv } from "../lib/env.js";
import { AppError } from "./error.js";
export function authMiddleware(req, res, next) {
    const env = getEnv();
    const authorized = verifyHeliusSecret(req, env.WEBHOOK_SECRET);
    if (!authorized) {
        throw new AppError(401, "Unauthorized");
    }
    next();
}
