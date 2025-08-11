# Cross-Origin Setup Guide

## Quick Setup for Cross-Origin Access

### 1. Server Configuration

Add the following to your `.env` file:

```bash
# Enable CORS for all origins (development)
ALLOWED_ORIGINS=*

# Enable development endpoints
ALLOW_DEV_ENDPOINTS=1

# Other required settings
PORT=8080
WEBHOOK_SECRET=super-secret
DATABASE_URL="file:./prisma/dev.db"
```

### 2. For Different Network Locations

#### Same Local Network
If accessing from another PC on the same network:

1. **Find your server's IP address**:
   ```bash
   # Windows
   ipconfig
   
   # Linux/Mac
   ifconfig
   ```

2. **Update frontend URL**:
   ```javascript
   // Replace localhost with your server's IP
   const apiUrl = 'http://192.168.1.100:8080';
   ```

#### Remote Access via Tunneling

**Option A: Cloudflare Tunnel (Recommended)**
```bash
# Install cloudflared
# Then run:
cloudflared tunnel --url http://localhost:8080
```

**Option B: ngrok**
```bash
# Install ngrok
# Then run:
ngrok http 8080
```

### 3. Production Setup

For production, restrict CORS to specific domains:

```bash
# Production .env
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
ALLOW_DEV_ENDPOINTS=0
```

### 4. Testing Cross-Origin Access

1. **Open the test page**: `examples/cors-test.html`
2. **Update the API URL** to your server's address
3. **Click "Test CORS Support"** to verify connectivity
4. **Test endpoints** using the provided buttons

### 5. Common Issues & Solutions

#### Issue: "CORS error" or "Network error"
**Solution**: 
- Make sure `ALLOWED_ORIGINS=*` is set
- Restart the server after changing environment variables
- Check if the server is accessible at the specified URL

#### Issue: "404 Not Found" for `/dev/db/coordinated`
**Solution**: 
- Make sure `ALLOW_DEV_ENDPOINTS=1` is set
- Restart the server

#### Issue: EventSource connection fails
**Solution**: 
- Check that the server supports SSE endpoints
- Verify CORS headers are properly set for SSE
- Try using `withCredentials: true` in EventSource options

### 6. Environment Variables Summary

| Variable | Development | Production |
|----------|-------------|------------|
| `ALLOWED_ORIGINS` | `*` | `https://yourdomain.com` |
| `ALLOW_DEV_ENDPOINTS` | `1` | `0` |
| `NODE_ENV` | `development` | `production` |

### 7. Frontend Code Examples

**Vanilla JavaScript**:
```javascript
const apiUrl = 'http://192.168.1.100:8080'; // Your server IP

// Fetch with CORS
const response = await fetch(`${apiUrl}/dev/db/coordinated`, {
    mode: 'cors',
    credentials: 'include'
});

// SSE with CORS
const eventSource = new EventSource(`${apiUrl}/stream/coordinated`, {
    withCredentials: true
});
```

**React**:
```jsx
const API_BASE_URL = 'http://192.168.1.100:8080';

function CoordinatedTrades() {
    useEffect(() => {
        const eventSource = new EventSource(`${API_BASE_URL}/stream/coordinated`, {
            withCredentials: true
        });
        
        eventSource.onmessage = (event) => {
            const trade = JSON.parse(event.data);
            // Handle new trade
        };
        
        return () => eventSource.close();
    }, []);
}
```

### 8. Security Considerations

- **Development**: Use `ALLOWED_ORIGINS=*` for testing
- **Production**: Always specify exact domains in `ALLOWED_ORIGINS`
- **HTTPS**: Use HTTPS in production for security
- **Firewall**: Configure firewall rules appropriately

### 9. Verification Steps

1. ✅ Server starts without errors
2. ✅ CORS test passes in `cors-test.html`
3. ✅ Can fetch `/health` endpoint from different origin
4. ✅ Can fetch `/config` endpoint
5. ✅ Can fetch `/dev/db/coordinated` endpoint
6. ✅ SSE connection works for `/stream/coordinated`

### 10. Troubleshooting Commands

```bash
# Check if server is running
curl http://localhost:8080/health

# Test CORS from command line
curl -H "Origin: http://example.com" -H "Access-Control-Request-Method: GET" \
     -X OPTIONS http://localhost:8080/config

# Check environment variables (PowerShell)
docker exec helius-wallet-tracker-helius-tracker-1 env | grep ALLOWED_ORIGINS
```
