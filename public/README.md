# HTML Frontend Documentation

## Overview
All HTML files now include authentication awareness and cross-linking between pages. The system supports both public (unauthenticated) and authenticated access.

## Available Pages

### 1. **index.html** (Landing Page)
- **URL**: `/` or `/index.html`
- **Purpose**: Main landing page with links to all features
- **Features**:
  - Authentication status display
  - Grid layout of all available pages
  - Health status and config links
  - Responsive design

### 2. **login.html** (Authentication)
- **URL**: `/login.html`
- **Purpose**: Admin login interface
- **Features**:
  - Username/password authentication
  - JWT token storage in localStorage
  - Auto-detect existing sessions
  - Login/logout functionality
  - Links to all other pages

**API Endpoint Used**: 
- `POST /api/auth/login` - Login with credentials
- `POST /api/auth/logout` - Logout (clears token)
- `GET /api/auth/me` - Verify current session

**Credentials** (from .env):
- Username: `admin` (or ADMIN_USERNAME)
- Password: `changeme123` (or ADMIN_PASSWORD)

### 3. **test.html** (Endpoint Testing)
- **URL**: `/test.html`
- **Purpose**: Comprehensive API testing interface
- **Features**:
  - Test all API endpoints (health, config, database)
  - Real-time SSE streams (transfers, coordinated, all)
  - Configuration management
  - Token exclude list management
  - Webhook testing with custom payloads
  - Authentication status display
  - Base URL configuration

**API Endpoints Used**:
- `GET /health` - Health check
- `GET /config` - Get configuration
- `PATCH /config` - Update configuration
- `GET /dev/db/transfers` - Recent transfers
- `GET /dev/db/coordinated` - Coordinated trades
- `GET /dev/db/stats` - Database statistics
- `GET /config/exclude-tokens` - Get excluded tokens
- `POST /config/exclude-tokens` - Add token to exclude list
- `DELETE /config/exclude-tokens/:address` - Remove excluded token
- `POST /helius` - Test webhook endpoint
- `EventSource /stream/transfers` - Transfer events stream
- `EventSource /stream/coordinated` - Coordinated trades stream
- `EventSource /stream/all` - All events stream

### 4. **realtime-test.html** (Realtime Console)
- **URL**: `/realtime-test.html`
- **Purpose**: Advanced real-time event monitoring console
- **Features**:
  - Live SSE connection to `/stream/all`
  - Transfers table with filtering (wallet, token, signature, side)
  - Coordinated trades table
  - Live configuration display and editing
  - Click-to-copy for addresses
  - Auto-connect on page load
  - Authentication status indicator
  - Dark theme optimized for monitoring

**API Endpoints Used**:
- `EventSource /stream/all` - All events (named events)
- `GET /config` - Fetch current configuration
- `PATCH /config` - Update configuration
- `POST /dev/transfers` - Emit test transfer events
- `POST /dev/coordinated` - Emit test coordinated events

### 5. **coordinated-trades-live.html** (Live Monitor)
- **URL**: `/coordinated-trades-live.html`
- **Purpose**: Dedicated dashboard for coordinated trade detection
- **Features**:
  - Real-time coordinated trade alerts
  - Visual cards showing trade details
  - Token information with Solscan links
  - Wallet list display
  - Time window visualization
  - Trade count statistics
  - Auto-reconnect on disconnect
  - Authentication status display

**API Endpoints Used**:
- `EventSource /stream/coordinated` - Coordinated trades only

## Authentication Integration

All HTML files now include:

1. **Auth Status Display**: Shows whether user is logged in or in public mode
2. **Auto-Detection**: Checks localStorage for JWT token on page load
3. **Session Verification**: Calls `GET /api/auth/me` to verify token validity
4. **Cross-Page Navigation**: Links to login and other pages in headers
5. **Token Storage**: JWT stored in `localStorage.getItem('jwt_token')`

### How Authentication Works

```javascript
// Check if user is authenticated
const token = localStorage.getItem('jwt_token');

// Verify token with server
const response = await fetch('/api/auth/me', {
    headers: { 'Authorization': `Bearer ${token}` }
});

if (response.ok) {
    const data = await response.json();
    // User is authenticated: data.username, data.role
} else {
    // Token invalid or expired
    localStorage.removeItem('jwt_token');
}
```

### Adding Auth to API Requests (Future)

When endpoints are protected, add Authorization header:

```javascript
fetch('/api/some-endpoint', {
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`,
        'Content-Type': 'application/json'
    }
})
```

## Current Security Status

**All endpoints are currently PUBLIC** - No authentication required for:
- Health checks
- Configuration endpoints
- Database dev endpoints
- SSE streams
- Webhook endpoints

The authentication system is implemented but not enforced on API routes. To protect endpoints in the future, add `jwtAuth` middleware to routes in `src/routes/*.ts`.

## Static File Serving

Static files are served from the `public/` directory via Express:

```typescript
// In src/app.ts
app.use(express.static('public'));
```

All HTML files and assets are accessible at `https://helius.sarislabs.com/`.

## Base URL Configuration

HTML files default to:
- `window.location.origin` (current domain)
- `https://helius.sarislabs.com` (production)

Users can change the base URL in test interfaces to connect to different servers.

## Browser Compatibility

All HTML files use modern JavaScript features:
- `async/await` for API calls
- `fetch` API for HTTP requests
- `EventSource` for SSE connections
- `localStorage` for token persistence
- ES6+ syntax

**Minimum Requirements**: Chrome 67+, Firefox 61+, Safari 12+, Edge 79+

## Mobile Responsiveness

All pages include:
- Responsive meta viewport tag
- Flexible grid layouts
- Mobile-friendly buttons and inputs
- Touch-optimized controls

## Testing Workflow

1. **Start Server**: `npm run dev`
2. **Open Browser**: Navigate to `http://localhost:8080/`
3. **Test Public Access**: Browse all pages without logging in
4. **Login**: Go to `/login.html`, use admin credentials
5. **Test Authenticated**: Pages should show "🔐 Logged in as admin"
6. **Test Endpoints**: Use `/test.html` to verify API functionality
7. **Monitor Real-time**: Use `/realtime-test.html` for live events
8. **Watch Alerts**: Use `/coordinated-trades-live.html` for trade detection

## Future Enhancements

### Recommended Authentication Protection

Add JWT middleware to sensitive routes:

```typescript
// src/routes/config.ts
import { jwtAuth, requireRole } from "../middleware/jwtAuth.js";

// Protect config updates (require authentication)
router.patch("/config", jwtAuth, requireRole('admin'), (req, res, next) => {
  configController.updateConfig(req, res).catch(next);
});
```

### User Management

Currently single admin user. To add more users:
1. Create User model in Prisma schema
2. Store hashed passwords (bcrypt)
3. Add user registration endpoint
4. Add user management UI

### Role-Based Access

Extend authentication with roles:
- `viewer`: Read-only access
- `admin`: Full configuration control
- `api`: API-only access (for integrations)

## Troubleshooting

### "Authentication check failed"
- Server not running or unreachable
- Network connectivity issues
- Check browser console for errors

### "Token expired" or immediate logout
- JWT_SECRET changed on server
- Token format invalid
- Server restarted (tokens not persisted)

### SSE not connecting
- Check CORS configuration
- Verify `/stream/*` endpoints are accessible
- Browser may block EventSource on some networks
- Check firewall/proxy settings

### Endpoints return 404
- Verify ALLOW_DEV_ENDPOINTS=1 in .env for dev endpoints
- Check server logs for route registration
- Ensure server restarted after code changes

## Summary

✅ **5 HTML pages** with full cross-linking
✅ **Authentication UI** (login.html) integrated
✅ **Auth awareness** in all pages
✅ **JWT token management** via localStorage
✅ **Public access maintained** for all current endpoints
✅ **Static file serving** enabled in Express
✅ **Responsive design** for mobile/desktop
✅ **Real-time monitoring** with SSE
✅ **Comprehensive testing** interface
