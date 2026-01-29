# Next.js Frontend Application for Helius Wallet Tracker

## Project Overview

Build a modern Next.js 14+ frontend application with authentication to visualize and manage the Helius Wallet Tracker data. The application will connect to the existing backend API at `helius.sarislabs.com` and provide a secure, real-time dashboard for monitoring wallet activities and coordinated trades.

## Backend API Reference

### Authentication Flow

The backend uses **JWT-based authentication**. You must login first to get a token, then include it in protected requests.

```
POST /api/auth/login     → Get JWT token (public)
GET  /api/auth/me        → Get current user (requires JWT)
POST /api/auth/logout    → Logout (requires JWT)
```

### Endpoint Protection Matrix

| Endpoint | Auth Required | Description |
|----------|---------------|-------------|
| `GET /health` | ❌ None | Health check |
| `GET /stream/all` | ❌ None | SSE stream (all events) |
| `GET /stream/coordinated` | ❌ None | SSE stream (coordinated only) |
| `GET /stream/transfers` | ❌ None | SSE stream (transfers only) |
| `POST /helius` | 🔐 Webhook secret | Helius webhook (internal) |
| `POST /api/auth/login` | ❌ None | Login endpoint |
| `GET /api/auth/me` | 🔑 JWT | Get current user |
| `POST /api/auth/logout` | 🔑 JWT | Logout |
| `GET /config` | 🔑 JWT | Get configuration |
| `PATCH /config` | 🔑 JWT | Update configuration |
| `GET /config/exclude-tokens` | 🔑 JWT | Get excluded tokens |
| `POST /config/exclude-tokens` | 🔑 JWT | Add excluded token |
| `DELETE /config/exclude-tokens/:addr` | 🔑 JWT | Remove excluded token |
| `GET /dev/db/transfers` | 🔑 JWT | Fetch transfers |
| `GET /dev/db/coordinated` | 🔑 JWT | Fetch coordinated trades |
| `GET /dev/db/stats` | 🔑 JWT | Get statistics |

### Default Credentials (Change in Production!)

```
Username: admin
Password: admin@123  (set via ADMIN_PASSWORD env var)
```

## Core Requirements

### 1. Authentication System
- **JWT-based authentication** with backend `/api/auth/*` endpoints
- Store JWT token in memory or secure storage (not localStorage for sensitive apps)
- Include `Authorization: Bearer <token>` header on protected requests
- Auto-logout on 401 response or token expiry
- Login/Logout UI with form validation

### 2. Dashboard Features

#### Real-Time Transfer Monitor (PUBLIC - No Auth Needed)
- Live feed of wallet transfers using Server-Sent Events (SSE)
- Connect to `/stream/all` or `/stream/transfers` (no auth required)
- Display: Wallet address, token address, amount, timestamp, side (BUY/SELL)
- Color-coded buy (green) and sell (red) indicators
- Auto-scroll with pause/resume functionality

#### Coordinated Trades Detection View (PUBLIC - No Auth Needed)
- Real-time alerts via `/stream/coordinated` (no auth required)
- Display: Token address, window timeframe, unique wallet count, triggered time
- Expandable details showing all participating wallets
- Severity indicators based on wallet count

#### Database Analytics (PROTECTED - Auth Required)
- Fetch from `/dev/db/stats`, `/dev/db/transfers`, `/dev/db/coordinated`
- Total transfer count and coordinated trade count
- Charts and graphs with date range filters
- Export data to CSV/JSON

#### Configuration Management (PROTECTED - Auth Required)
- View/update via `/config` endpoints
- All config changes require valid JWT
- Form validation before updates
- Success/error notifications

### 3. API Integration

#### Backend Endpoints Summary

**Authentication (JWT-based)**
```
POST /api/auth/login    - Login, returns { ok, token, user }
GET  /api/auth/me       - Get current user (requires Bearer token)
POST /api/auth/logout   - Logout (requires Bearer token)
```

**Public Endpoints (No Auth)**
```
GET /health             - Health check
GET /stream/all         - SSE stream (transfer + coordinated events)
GET /stream/transfers   - SSE stream (transfer events only)
GET /stream/coordinated - SSE stream (coordinated events only)
```

**Protected Endpoints (Require JWT)**
```
GET    /config                         - Get current configuration
PATCH  /config                         - Update configuration
GET    /config/exclude-tokens          - Get excluded tokens list
POST   /config/exclude-tokens          - Add token to exclude list
DELETE /config/exclude-tokens/:address - Remove token from exclude list

GET /dev/db/transfers?limit=50    - Fetch transfer records
GET /dev/db/coordinated?limit=50  - Fetch coordinated trade records  
GET /dev/db/stats                 - Get { transferCount, coordinatedCount }
```

## Technical Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand or React Context
- **Authentication**: NextAuth.js v5 (Auth.js)
- **HTTP Client**: Axios or fetch API
- **Real-Time**: EventSource API for SSE
- **Charts**: Recharts or Chart.js
- **Forms**: React Hook Form + Zod validation
- **Tables**: TanStack Table (React Table v8)
- **Notifications**: React Hot Toast or Sonner
- **Date Handling**: date-fns or Day.js

### Development Tools
- ESLint + Prettier
- TypeScript strict mode
- Environment variables management

## Project Structure

```
helius-wallet-tracker-frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                    # Main dashboard
│   │   │   ├── transfers/
│   │   │   │   └── page.tsx                # Transfers list
│   │   │   ├── coordinated/
│   │   │   │   └── page.tsx                # Coordinated trades
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx                # Charts & analytics
│   │   │   ├── config/
│   │   │   │   └── page.tsx                # Configuration
│   │   │   └── wallets/
│   │   │       └── page.tsx                # Wallet management
│   │   ├── api/
│   │   │   └── auth/
│   │   │       └── [...nextauth]/
│   │   │           └── route.ts            # NextAuth config
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                             # shadcn/ui components
│   │   ├── dashboard/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── StatsCards.tsx
│   │   ├── transfers/
│   │   │   ├── TransfersList.tsx
│   │   │   ├── TransferRow.tsx
│   │   │   └── TransferFilters.tsx
│   │   ├── coordinated/
│   │   │   ├── CoordinatedTradeCard.tsx
│   │   │   ├── CoordinatedTradesList.tsx
│   │   │   └── WalletsList.tsx
│   │   ├── analytics/
│   │   │   ├── TransfersChart.tsx
│   │   │   ├── VolumeChart.tsx
│   │   │   └── TokensChart.tsx
│   │   ├── config/
│   │   │   └── ConfigForm.tsx
│   │   └── shared/
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── DataTable.tsx
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts                   # Axios instance
│   │   │   ├── transfers.ts                # Transfer API calls
│   │   │   ├── coordinated.ts              # Coordinated API calls
│   │   │   ├── config.ts                   # Config API calls
│   │   │   └── sse.ts                      # SSE connection handler
│   │   ├── auth/
│   │   │   └── authOptions.ts              # NextAuth configuration
│   │   ├── hooks/
│   │   │   ├── useSSE.ts                   # SSE hook
│   │   │   ├── useTransfers.ts             # Transfers data hook
│   │   │   ├── useCoordinated.ts           # Coordinated data hook
│   │   │   └── useAuth.ts                  # Auth hook
│   │   ├── store/
│   │   │   └── dashboardStore.ts           # Global state
│   │   ├── types/
│   │   │   ├── transfer.ts
│   │   │   ├── coordinated.ts
│   │   │   └── config.ts
│   │   └── utils/
│   │       ├── formatters.ts               # Date, number formatters
│   │       └── validators.ts               # Form validators
│   └── middleware.ts                       # Auth middleware
├── public/
├── .env.local
├── .env.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## Implementation Details

### 1. Environment Variables (.env.local)

```env
# Backend API
NEXT_PUBLIC_API_URL=https://helius.sarislabs.com

# SSE Streams (public, no auth needed)
NEXT_PUBLIC_SSE_URL=https://helius.sarislabs.com/stream/all
NEXT_PUBLIC_SSE_TRANSFERS_URL=https://helius.sarislabs.com/stream/transfers
NEXT_PUBLIC_SSE_COORDINATED_URL=https://helius.sarislabs.com/stream/coordinated

# NextAuth (for session management wrapper)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-key-here

# Backend login credentials (used by NextAuth to get JWT from backend)
BACKEND_AUTH_URL=https://helius.sarislabs.com/api/auth
```

### 2. Authentication Setup

The backend provides JWT tokens. Use NextAuth as a wrapper to manage session state while fetching real JWTs from the backend.

**File: `src/app/api/auth/[...nextauth]/route.ts`**

```typescript
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          // Login to backend and get JWT
          const res = await fetch(`${process.env.BACKEND_AUTH_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: credentials?.username,
              password: credentials?.password,
            }),
          });

          const data = await res.json();

          if (res.ok && data.ok && data.token) {
            // Return user with JWT token
            return {
              id: data.user.id,
              name: data.user.username,
              email: `${data.user.username}@sarislabs.com`,
              role: data.user.role,
              accessToken: data.token, // Store JWT
            };
          }
          return null;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      }
    })
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours (matches backend JWT expiry)
  },
  callbacks: {
    async jwt({ token, user }) {
      // Persist backend JWT in the NextAuth token
      if (user) {
        token.role = user.role;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      // Make JWT available in session for API calls
      if (session.user) {
        session.user.role = token.role as string;
        session.accessToken = token.accessToken as string;
      }
      return session;
    }
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

**File: `src/types/next-auth.d.ts`** (Type extensions)

```typescript
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      role?: string;
    } & DefaultSession["user"];
    accessToken?: string;
  }

  interface User {
    role?: string;
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    accessToken?: string;
  }
}
```

**File: `src/middleware.ts`**

```typescript
export { default } from "next-auth/middleware";

export const config = {
  // Only protect routes that need auth (config, analytics, etc.)
  // Streams are public and don't need protection
  matcher: [
    "/analytics/:path*",
    "/config/:path*",
    "/admin/:path*",
  ]
};
```

### 3. API Client Setup with JWT

**File: `src/lib/api/client.ts`**

```typescript
import axios from "axios";
import { getSession } from "next-auth/react";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - add JWT to protected requests
apiClient.interceptors.request.use(
  async (config) => {
    // Get session with JWT token
    const session = await getSession();
    
    if (session?.accessToken) {
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to login
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

**File: `src/lib/api/auth.ts`**

```typescript
import apiClient from "./client";

export async function getCurrentUser() {
  const { data } = await apiClient.get("/api/auth/me");
  return data;
}

export async function logout() {
  const { data } = await apiClient.post("/api/auth/logout");
  return data;
}
```

**File: `src/lib/api/config.ts`**

```typescript
import apiClient from "./client";
import type { SystemConfig } from "../types/config";

export async function getConfig(): Promise<SystemConfig> {
  const { data } = await apiClient.get("/config");
  return data;
}

export async function updateConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
  const { data } = await apiClient.patch("/config", config);
  return data;
}

export async function getExcludeTokens(): Promise<{ excludeTokens: string[] }> {
  const { data } = await apiClient.get("/config/exclude-tokens");
  return data;
}

export async function addExcludeToken(tokenAddress: string): Promise<any> {
  const { data } = await apiClient.post("/config/exclude-tokens", { tokenAddress });
  return data;
}

export async function removeExcludeToken(tokenAddress: string): Promise<any> {
  const { data } = await apiClient.delete(`/config/exclude-tokens/${tokenAddress}`);
  return data;
}
```

**File: `src/lib/api/transfers.ts`**

```typescript
import apiClient from "./client";
import type { TransferEvent } from "../types/transfer";

export async function getTransfers(limit: number = 50): Promise<TransferEvent[]> {
  const { data } = await apiClient.get("/dev/db/transfers", {
    params: { limit }
  });
  return data;
}

export async function getCoordinatedTrades(limit: number = 50) {
  const { data } = await apiClient.get("/dev/db/coordinated", {
    params: { limit }
  });
  return data;
}

export async function getStats() {
  const { data } = await apiClient.get("/dev/db/stats");
  return data;
}
```

### 4. SSE Hook for Real-Time Updates (Public - No Auth)

**File: `src/lib/hooks/useSSE.ts`**

```typescript
import { useEffect, useCallback, useRef, useState } from "react";

interface TransferEvent {
  walletAddress: string;
  tokenAddress: string;
  amount: string;
  signature: string;
  timestamp: string;
  side: "BUY" | "SELL";
}

interface CoordinatedEvent {
  tokenAddress: string;
  windowStart: string;
  windowEnd: string;
  triggeredAt: string;
  uniqueWalletCount: number;
  walletAddresses: string[];
}

interface SSECallbacks {
  onTransfer?: (data: TransferEvent) => void;
  onCoordinated?: (data: CoordinatedEvent) => void;
  onError?: (error: Event) => void;
}

export function useSSE(callbacks: SSECallbacks) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    // SSE streams are PUBLIC - no auth needed
    const url = process.env.NEXT_PUBLIC_SSE_URL || "https://helius.sarislabs.com/stream/all";
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log("SSE connected");
      setConnected(true);
    };

    // Listen for transfer events
    eventSource.addEventListener("transfer", (e) => {
      try {
        const data = JSON.parse(e.data);
        callbacks.onTransfer?.(data);
      } catch (err) {
        console.error("Failed to parse transfer event:", err);
      }
    });

    // Listen for coordinated trade events
    eventSource.addEventListener("coordinated", (e) => {
      try {
        const data = JSON.parse(e.data);
        callbacks.onCoordinated?.(data);
      } catch (err) {
        console.error("Failed to parse coordinated event:", err);
      }
    });

    eventSource.onerror = (error) => {
      console.error("SSE connection error, reconnecting in 5s...");
      setConnected(false);
      callbacks.onError?.(error);
      eventSource.close();
      setTimeout(connect, 5000);
    };

    eventSourceRef.current = eventSource;
  }, [callbacks]);

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { connected, disconnect, reconnect: connect };
}
```

**Alternative: Specific Stream Hooks**

```typescript
// For transfers only
export function useTransferStream(onTransfer: (data: TransferEvent) => void) {
  return useSSE({ onTransfer });
}

// For coordinated trades only  
export function useCoordinatedStream(onCoordinated: (data: CoordinatedEvent) => void) {
  return useSSE({ onCoordinated });
}
```

### 5. Main Dashboard Page

**File: `src/app/(dashboard)/page.tsx`**

This page shows real-time streams (public) but stats require auth.

```typescript
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSSE } from "@/lib/hooks/useSSE";
import { getStats } from "@/lib/api/transfers";
import StatsCards from "@/components/dashboard/StatsCards";
import TransfersList from "@/components/transfers/TransfersList";
import CoordinatedTradesList from "@/components/coordinated/CoordinatedTradesList";
import { Loader2 } from "lucide-react";

interface Transfer {
  walletAddress: string;
  tokenAddress: string;
  amount: string;
  signature: string;
  timestamp: string;
  side: "BUY" | "SELL";
}

interface CoordinatedTrade {
  tokenAddress: string;
  windowStart: string;
  windowEnd: string;
  triggeredAt: string;
  uniqueWalletCount: number;
  walletAddresses: string[];
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState({ transferCount: 0, coordinatedCount: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentTransfers, setRecentTransfers] = useState<Transfer[]>([]);
  const [recentCoordinated, setRecentCoordinated] = useState<CoordinatedTrade[]>([]);

  // Load stats (requires auth)
  useEffect(() => {
    if (session?.accessToken) {
      getStats()
        .then(setStats)
        .catch(console.error)
        .finally(() => setStatsLoading(false));
    }
  }, [session]);

  // Real-time updates via SSE (public - no auth needed)
  const { connected } = useSSE({
    onTransfer: (data) => {
      setRecentTransfers((prev) => [data, ...prev.slice(0, 49)]);
      setStats((s) => ({ ...s, transferCount: s.transferCount + 1 }));
    },
    onCoordinated: (data) => {
      setRecentCoordinated((prev) => [data, ...prev.slice(0, 19)]);
      setStats((s) => ({ ...s, coordinatedCount: s.coordinatedCount + 1 }));
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-muted-foreground">
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>
      
      {/* Stats - requires auth */}
      {session ? (
        statsLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <StatsCards stats={stats} />
        )
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Login to view database statistics</p>
        </div>
      )}

      {/* Real-time feeds - public, no auth needed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-4">
            Live Transfers 
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({recentTransfers.length})
            </span>
          </h2>
          <TransfersList transfers={recentTransfers} limit={20} />
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-4">
            Coordinated Trades
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({recentCoordinated.length})
            </span>
          </h2>
          <CoordinatedTradesList trades={recentCoordinated} limit={10} />
        </div>
      </div>
    </div>
  );
}
```

### 6. Login Page

**File: `src/app/(auth)/login/page.tsx`**

```typescript
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid username or password");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
          <CardDescription>
            Enter your credentials to access the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 6. Database Viewing Pages (Protected)

These pages display historical data from the database and require authentication.

**File: `src/app/(dashboard)/transfers/page.tsx`** - Transfer History

```typescript
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getTransfers } from "@/lib/api/transfers";
import { TransferEvent } from "@/lib/types/transfer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, ExternalLink, Search } from "lucide-react";
import { format } from "date-fns";

export default function TransfersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [transfers, setTransfers] = useState<TransferEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(100);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchData = async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const data = await getTransfers(limit);
      setTransfers(data);
    } catch (error) {
      console.error("Failed to fetch transfers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.accessToken) {
      fetchData();
    }
  }, [session, limit]);

  // Filter transfers by search term
  const filteredTransfers = transfers.filter((t) =>
    t.walletAddress.toLowerCase().includes(search.toLowerCase()) ||
    t.tokenAddress.toLowerCase().includes(search.toLowerCase()) ||
    t.signature.toLowerCase().includes(search.toLowerCase())
  );

  const truncateAddress = (addr: string) => 
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const openSolscan = (signature: string) => {
    window.open(`https://solscan.io/tx/${signature}`, "_blank");
  };

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Transfer History</h1>
        <Button onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Database Records ({filteredTransfers.length})</span>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search wallet, token, or signature..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="border rounded px-2 py-1"
              >
                <option value={50}>50 records</option>
                <option value={100}>100 records</option>
                <option value={250}>250 records</option>
                <option value={500}>500 records</option>
              </select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Signature</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.map((transfer, idx) => (
                  <TableRow key={transfer.id || idx}>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(transfer.timestamp), "MMM dd, HH:mm:ss")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {truncateAddress(transfer.walletAddress)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {truncateAddress(transfer.tokenAddress)}
                    </TableCell>
                    <TableCell>{Number(transfer.amount).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={transfer.side === "BUY" ? "default" : "destructive"}>
                        {transfer.side}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openSolscan(transfer.signature)}
                      >
                        <span className="font-mono text-xs">
                          {truncateAddress(transfer.signature)}
                        </span>
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**File: `src/app/(dashboard)/coordinated/page.tsx`** - Coordinated Trades History

```typescript
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getCoordinatedTrades } from "@/lib/api/transfers";
import { CoordinatedTrade, parseWalletAddresses } from "@/lib/types/coordinated";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, RefreshCw, ChevronDown, Users, Clock, ExternalLink } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export default function CoordinatedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [trades, setTrades] = useState<CoordinatedTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchData = async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const data = await getCoordinatedTrades(limit);
      setTrades(data);
    } catch (error) {
      console.error("Failed to fetch coordinated trades:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.accessToken) {
      fetchData();
    }
  }, [session, limit]);

  const getSeverityColor = (count: number) => {
    if (count >= 10) return "bg-red-500";
    if (count >= 7) return "bg-orange-500";
    if (count >= 5) return "bg-yellow-500";
    return "bg-blue-500";
  };

  const truncateAddress = (addr: string) => 
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Coordinated Trades History</h1>
        <div className="flex items-center gap-4">
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            <option value={25}>25 records</option>
            <option value={50}>50 records</option>
            <option value={100}>100 records</option>
          </select>
          <Button onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {trades.map((trade, idx) => {
          const wallets = parseWalletAddresses(trade);
          const isExpanded = expandedId === (trade.id || String(idx));
          
          return (
            <Card key={trade.id || idx}>
              <Collapsible open={isExpanded} onOpenChange={() => 
                setExpandedId(isExpanded ? null : (trade.id || String(idx)))
              }>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-12 rounded ${getSeverityColor(trade.uniqueWalletCount)}`} />
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <span className="font-mono text-sm">
                              {truncateAddress(trade.tokenAddress)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`https://solscan.io/token/${trade.tokenAddress}`, "_blank");
                              }}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </CardTitle>
                          <CardDescription className="flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {trade.uniqueWalletCount} wallets
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(trade.triggeredAt), { addSuffix: true })}
                            </span>
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">
                          {format(new Date(trade.windowStart), "HH:mm")} - {format(new Date(trade.windowEnd), "HH:mm")}
                        </Badge>
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold mb-2">Participating Wallets ({wallets.length})</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {wallets.map((wallet, i) => (
                          <Button
                            key={i}
                            variant="ghost"
                            size="sm"
                            className="justify-start font-mono text-xs"
                            onClick={() => window.open(`https://solscan.io/account/${wallet}`, "_blank")}
                          >
                            {truncateAddress(wallet)}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

**File: `src/app/(dashboard)/analytics/page.tsx`** - Analytics & Stats

```typescript
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getStats, getTransfers, getCoordinatedTrades } from "@/lib/api/transfers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, TrendingUp, Users, Activity, Database } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { format, subHours, startOfHour } from "date-fns";

interface Stats {
  transferCount: number;
  coordinatedCount: number;
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ transferCount: 0, coordinatedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [buyCount, setBuyCount] = useState(0);
  const [sellCount, setSellCount] = useState(0);
  const [hourlyData, setHourlyData] = useState<any[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchData = async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      // Fetch stats
      const statsData = await getStats();
      setStats(statsData);

      // Fetch transfers for charts
      const transfers = await getTransfers(500);
      
      // Calculate buy/sell ratio
      const buys = transfers.filter((t: any) => t.side === "BUY").length;
      const sells = transfers.filter((t: any) => t.side === "SELL").length;
      setBuyCount(buys);
      setSellCount(sells);

      // Group by hour for timeline
      const hourlyMap = new Map<string, { buys: number; sells: number }>();
      const now = new Date();
      
      // Initialize last 24 hours
      for (let i = 23; i >= 0; i--) {
        const hour = startOfHour(subHours(now, i));
        const key = format(hour, "HH:mm");
        hourlyMap.set(key, { buys: 0, sells: 0 });
      }

      // Count transfers per hour
      transfers.forEach((t: any) => {
        const hour = format(startOfHour(new Date(t.timestamp)), "HH:mm");
        if (hourlyMap.has(hour)) {
          const current = hourlyMap.get(hour)!;
          if (t.side === "BUY") current.buys++;
          else current.sells++;
        }
      });

      setHourlyData(
        Array.from(hourlyMap.entries()).map(([hour, data]) => ({
          hour,
          buys: data.buys,
          sells: data.sells,
          total: data.buys + data.sells,
        }))
      );
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.accessToken) {
      fetchData();
    }
  }, [session]);

  const pieData = [
    { name: "BUY", value: buyCount, color: "#22c55e" },
    { name: "SELL", value: sellCount, color: "#ef4444" },
  ];

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <Button onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Transfers</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.transferCount.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Coordinated Trades</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.coordinatedCount.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Buy Orders</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{buyCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sell Orders</CardTitle>
            <Activity className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{sellCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Activity Timeline (Last 24 Hours)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="buys" name="Buys" fill="#22c55e" />
                <Bar dataKey="sells" name="Sells" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Buy/Sell Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

### 7. TypeScript Types

**File: `src/lib/types/transfer.ts`**

```typescript
export interface TransferEvent {
  id?: string;
  walletAddress: string;
  tokenAddress: string;
  amount: string;
  signature: string;
  timestamp: string;
  side: "BUY" | "SELL";
}
```

**File: `src/lib/types/coordinated.ts`**

```typescript
export interface CoordinatedTrade {
  id?: string;
  tokenAddress: string;
  windowStart: string;
  windowEnd: string;
  triggeredAt: string;
  uniqueWalletCount: number;
  walletAddresses: string | string[]; // JSON string from DB, or parsed array from SSE
}

// Helper to parse wallet addresses
export function parseWalletAddresses(trade: CoordinatedTrade): string[] {
  if (Array.isArray(trade.walletAddresses)) {
    return trade.walletAddresses;
  }
  try {
    return JSON.parse(trade.walletAddresses);
  } catch {
    return [];
  }
}
```

**File: `src/lib/types/config.ts`**

```typescript
export interface SystemConfig {
  coordinatedWindowMinutes: number;
  coordinatedMinWallets: number;
  excludeTokens: string[];
  minAmount: number;
  dedupBySignatureOnly: boolean;
  debugEvents: boolean;
  debugEventsVerbose: boolean;
}
```

### 8. Dashboard Layout with Sidebar

**File: `src/app/(dashboard)/layout.tsx`**

```typescript
"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Users, 
  BarChart3, 
  Settings, 
  LogOut,
  Radio
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Live Streams", href: "/live", icon: Radio, public: true },
  { name: "Transfers", href: "/transfers", icon: ArrowLeftRight, protected: true },
  { name: "Coordinated", href: "/coordinated", icon: Users, protected: true },
  { name: "Analytics", href: "/analytics", icon: BarChart3, protected: true },
  { name: "Config", href: "/config", icon: Settings, protected: true },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r">
        <div className="p-6">
          <h1 className="text-xl font-bold">Helius Tracker</h1>
          <p className="text-sm text-muted-foreground">Wallet Monitor</p>
        </div>
        
        <nav className="px-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const isProtected = item.protected;
            const canAccess = !isProtected || session;
            
            return (
              <Link
                key={item.name}
                href={canAccess ? item.href : "/login"}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-muted",
                  !canAccess && "opacity-50"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
                {isProtected && !session && (
                  <span className="ml-auto text-xs">🔒</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t w-64">
          {session ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{session.user?.name}</p>
              <p className="text-xs text-muted-foreground">{session.user?.role}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button className="w-full">Sign In</Button>
            </Link>
          )}
        </div>
      </aside>


      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
```

### 9. Styling with Tailwind + shadcn/ui

Install shadcn/ui components:

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card table input badge alert dialog switch collapsible
```

### 10. Pages Summary

| Page | Route | Auth | Description |
|------|-------|------|-------------|
| Dashboard | `/` | Optional | Live SSE feeds + stats (if logged in) |
| Live Streams | `/live` | ❌ No | Public real-time view |
| Transfers | `/transfers` | ✅ Yes | Database transfer history with search |
| Coordinated | `/coordinated` | ✅ Yes | Database coordinated trades with details |
| Analytics | `/analytics` | ✅ Yes | Charts, stats, buy/sell ratios |
| Config | `/config` | ✅ Yes | System configuration management |
| Login | `/login` | ❌ No | Authentication page |

### 11. Key Features

#### A. Database Viewing (Protected)
- **Transfers Page**: Paginated table with search, filters, Solscan links
- **Coordinated Page**: Expandable cards with wallet lists
- **Analytics Page**: Charts for buy/sell ratio, timeline activity

#### B. Live Streams (Public)
- Real-time SSE connection to `/stream/all`
- Color-coded BUY/SELL indicators
- Connection status indicator
- Auto-reconnect on disconnect

#### C. Configuration (Protected)
- Update coordinated detection settings
- Manage excluded tokens list
- Toggle debug options

#### D. Responsive Design
- Mobile-first approach
- Collapsible sidebar on mobile
- Touch-friendly interactions
- Optimized table views for small screens

## Installation & Setup

```bash
# Create Next.js app
npx create-next-app@latest helius-tracker-frontend --typescript --tailwind --app

# Install dependencies
cd helius-tracker-frontend
npm install next-auth axios recharts react-hook-form @hookform/resolvers zod
npm install zustand date-fns react-hot-toast
npm install -D @types/node @types/react @types/react-dom

# Install shadcn/ui
npx shadcn-ui@latest init

# Install shadcn components
npx shadcn-ui@latest add button card table form input badge alert dialog

# Run development server
npm run dev
```

## Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Docker
```dockerfile
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

## Backend Authentication Status ✅

The backend already implements JWT authentication. No additional changes needed!

### Current Backend Auth Implementation

| Feature | Status | Details |
|---------|--------|---------|
| JWT Login | ✅ Done | `POST /api/auth/login` returns token |
| Protected Config | ✅ Done | `/config/*` requires Bearer token |
| Protected Dev Endpoints | ✅ Done | `/dev/*` requires Bearer token |
| Public SSE Streams | ✅ Done | `/stream/*` accessible without auth |
| Webhook Auth | ✅ Done | `x-helius-secret` header verification |

### Environment Variables (Backend)

```env
# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin@123

# Enable dev endpoints (optional)
ALLOW_DEV_ENDPOINTS=1
```

## Testing Checklist

### Authentication
- [ ] Login with valid credentials returns JWT token
- [ ] Login with invalid credentials shows error
- [ ] JWT token is stored in NextAuth session
- [ ] Protected routes redirect to login when unauthenticated
- [ ] Logout clears session properly
- [ ] Token expiry triggers re-authentication

### Public Features (No Auth Required)
- [ ] SSE stream `/stream/all` connects without auth
- [ ] SSE stream `/stream/transfers` works without auth
- [ ] SSE stream `/stream/coordinated` works without auth
- [ ] `/health` endpoint accessible without auth
- [ ] Real-time transfer updates appear in feed
- [ ] Real-time coordinated trade alerts appear

### Protected Features (Auth Required)
- [ ] `/config` returns 401 without token
- [ ] `/config` returns config with valid token
- [ ] Config updates save successfully
- [ ] Exclude tokens add/remove works
- [ ] `/dev/db/stats` returns statistics with token
- [ ] `/dev/db/transfers` returns data with token
- [ ] `/dev/db/coordinated` returns data with token

### UI/UX
- [ ] Loading states shown during API calls
- [ ] Error messages displayed for failed requests
- [ ] Success notifications for config updates
- [ ] Responsive design on mobile
- [ ] SSE reconnection on disconnect
- [ ] Charts render with correct data

## Additional Considerations

### Performance Optimization
- Implement virtual scrolling for large transfer lists
- Lazy load charts and analytics
- Use React.memo for expensive components
- Debounce search and filter inputs
- Implement pagination for historical data

### Security Best Practices
- Store JWT token in secure httpOnly cookie (via NextAuth)
- Never expose JWT_SECRET to client
- Use HTTPS in production
- Implement rate limiting on API calls
- Validate all user inputs

### Error Handling
- Global error boundary component
- API error toast notifications
- Retry logic for failed requests
- Graceful SSE reconnection (auto-retry after 5s)
- Fallback UI for missing data

### Accessibility
- ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader compatibility
- Proper color contrast ratios
- Focus management for modals

## Quick Start Commands

```bash
# 1. Create Next.js app
npx create-next-app@latest helius-frontend --typescript --tailwind --app

# 2. Install dependencies
cd helius-frontend
npm install next-auth@beta axios recharts react-hook-form @hookform/resolvers zod
npm install date-fns react-hot-toast lucide-react

# 3. Setup shadcn/ui
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input label badge alert switch

# 4. Add environment variables
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=https://helius.sarislabs.com
NEXT_PUBLIC_SSE_URL=https://helius.sarislabs.com/stream/all
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -base64 32)
BACKEND_AUTH_URL=https://helius.sarislabs.com/api/auth
EOF

# 5. Run development server
npm run dev
```

## Support & Resources

- Next.js Docs: https://nextjs.org/docs
- NextAuth.js v5: https://authjs.dev
- Tailwind CSS: https://tailwindcss.com
- shadcn/ui: https://ui.shadcn.com
- Recharts: https://recharts.org
- React Hook Form: https://react-hook-form.com

---

**This document provides a complete blueprint for building the frontend with the already-implemented backend authentication. The SSE streams are public for real-time data, while config and analytics endpoints require JWT authentication.**
