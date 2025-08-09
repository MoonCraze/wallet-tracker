import { PrismaClient } from "@prisma/client";
// Avoid creating multiple PrismaClient instances in dev/watch
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ||
    new PrismaClient({
        // Keep logs quiet; we'll handle errors via try/catch in code
        log: ["warn"],
    });
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = prisma;
