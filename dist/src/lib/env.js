import { z } from "zod";
const EnvSchema = z.object({
    PORT: z.string().default("8080").transform(Number),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.string().min(1),
    WEBHOOK_SECRET: z.string().min(1),
    ALLOWED_ORIGINS: z.string().optional(),
    // Feature flags
    ALLOW_DEV_ENDPOINTS: z.string().optional().transform(val => val === "1" || val === "true"),
    // App configuration
    EXCLUDE_TOKENS: z.string().optional(),
    MIN_AMOUNT: z.string().optional().transform(val => val ? parseFloat(val) : 1),
    DEDUP_BY_SIGNATURE_ONLY: z.string().optional().transform(val => val === "1" || val === "true"),
    COORDINATED_WINDOW_MINUTES: z.string().default("5").transform(Number),
    COORDINATED_MIN_WALLETS: z.string().default("5").transform(Number),
    // Debug flags
    DEBUG_EVENTS: z.string().optional().transform(val => val === "1" || val === "true"),
    DEBUG_EVENTS_VERBOSE: z.string().optional().transform(val => val === "1" || val === "true"),
});
let env;
export function validateEnv() {
    try {
        env = EnvSchema.parse(process.env);
        return env;
    }
    catch (error) {
        console.error("❌ Invalid environment variables:", error);
        process.exit(1);
    }
}
export function getEnv() {
    if (!env) {
        throw new Error("Environment not validated. Call validateEnv() first.");
    }
    return env;
}
