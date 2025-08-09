import { z } from "zod";
import { WSOL_MINT } from "./utils/parse.js";

export const ConfigSchema = z.object({
  excludeTokens: z.array(z.string()).default([WSOL_MINT]),
  minAmount: z.number().min(0).default(1),
  dedupBySignatureOnly: z.boolean().default(false),
  coordinatedWindowMinutes: z.number().int().min(1).default(5),
  coordinatedMinWallets: z.number().int().min(1).default(5),
  debugEvents: z.boolean().default(false),
  debugEventsVerbose: z.boolean().default(false),
});

export type AppConfig = z.infer<typeof ConfigSchema> & {
  excludeTokensSet: Set<string>;
};

function envBool(name: string, def = false) {
  const v = process.env[name];
  if (!v) return def;
  return v === "1" || v.toLowerCase() === "true";
}

// Initialize from env
const initial = ConfigSchema.parse({
  excludeTokens: (process.env.EXCLUDE_TOKENS || WSOL_MINT)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  minAmount: Number.isFinite(parseFloat(process.env.MIN_AMOUNT || ""))
    ? parseFloat(process.env.MIN_AMOUNT as string)
    : 1,
  dedupBySignatureOnly: envBool("DEDUP_BY_SIGNATURE_ONLY", false),
  coordinatedWindowMinutes: Number(process.env.COORDINATED_WINDOW_MINUTES || 5),
  coordinatedMinWallets: Number(process.env.COORDINATED_MIN_WALLETS || 5),
  debugEvents: envBool("DEBUG_EVENTS", false),
  debugEventsVerbose: envBool("DEBUG_EVENTS_VERBOSE", false),
});

let CONFIG: AppConfig = {
  ...initial,
  excludeTokensSet: new Set(initial.excludeTokens),
};

export function getConfig(): AppConfig {
  return CONFIG;
}

export function setConfig(patch: Partial<z.input<typeof ConfigSchema>>): AppConfig {
  const merged = { ...CONFIG, ...patch } as any;
  const parsed = ConfigSchema.parse({
    excludeTokens: merged.excludeTokens,
    minAmount: merged.minAmount,
    dedupBySignatureOnly: merged.dedupBySignatureOnly,
    coordinatedWindowMinutes: merged.coordinatedWindowMinutes,
    coordinatedMinWallets: merged.coordinatedMinWallets,
    debugEvents: merged.debugEvents,
    debugEventsVerbose: merged.debugEventsVerbose,
  });
  CONFIG = { ...parsed, excludeTokensSet: new Set(parsed.excludeTokens) };
  return CONFIG;
}

export function configToJSON(c: AppConfig) {
  const { excludeTokensSet, ...rest } = c;
  return { ...rest };
}
