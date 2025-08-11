# 🌐 Remote Access Guide

Your Helius Wallet Tracker is now accessible from anywhere! Here's how to connect from other computers:

## 🔗 Internet Access (Recommended)

**Via Cloudflare Tunnel:**
- **Main Dashboard**: https://helius.wonderswhisper.com/realtime-test.html
- **Remote Client**: https://helius.wonderswhisper.com/remote-client.html
- **API Health**: https://helius.wonderswhisper.com/health
- **SSE Stream**: https://helius.wonderswhisper.com/stream/all

## 🏠 Local Network Access

**From any PC on your network:**
- **Main Dashboard**: http://192.168.19.1:8080/realtime-test.html
- **Remote Client**: http://192.168.19.1:8080/remote-client.html
- **SSE Stream**: http://192.168.19.1:8080/stream/all

## 📱 For Developers

### JavaScript SSE Client Example

```javascript
// Connect to real-time data stream
const eventSource = new EventSource('https://helius.wonderswhisper.com/stream/all');

// Listen for wallet transfer events
eventSource.addEventListener('transfers', (event) => {
    const transfers = JSON.parse(event.data);
    transfers.forEach(transfer => {
        console.log(`${transfer.side}: ${transfer.amount} ${transfer.tokenAddress}`);
        console.log(`Wallet: ${transfer.walletAddress}`);
        console.log(`Time: ${transfer.timestamp}`);
    });
});

// Listen for coordinated trading events
eventSource.addEventListener('coordinated', (event) => {
    const coordinated = JSON.parse(event.data);
    console.log(`🔥 Coordinated trade detected!`);
    console.log(`Token: ${coordinated.tokenAddress}`);
    console.log(`Wallets involved: ${coordinated.uniqueWalletCount}`);
    console.log(`Window: ${coordinated.windowStart} to ${coordinated.windowEnd}`);
});

// Handle connection events
eventSource.onopen = () => console.log('✅ Connected to Helius tracker');
eventSource.onerror = () => console.log('❌ Connection lost');
```

### Python SSE Client Example

```python
import requests
import json
from sseclient import SSEClient

# Connect to the SSE stream
messages = SSEClient('https://helius.wonderswhisper.com/stream/all')

for msg in messages:
    if msg.event == 'transfers':
        transfers = json.loads(msg.data)
        for transfer in transfers:
            print(f"{transfer['side']}: {transfer['amount']} {transfer['tokenAddress']}")
            print(f"Wallet: {transfer['walletAddress']}")
            print(f"Time: {transfer['timestamp']}")
            print("---")
    
    elif msg.event == 'coordinated':
        coordinated = json.loads(msg.data)
        print(f"🔥 Coordinated trade detected!")
        print(f"Token: {coordinated['tokenAddress']}")
        print(f"Wallets: {coordinated['uniqueWalletCount']}")
        print("===")
```

### REST API Endpoints

```bash
# Health check
curl https://helius.wonderswhisper.com/health

# Get current configuration
curl https://helius.wonderswhisper.com/config

# Update configuration (PATCH)
curl -X PATCH https://helius.wonderswhisper.com/config \
  -H "Content-Type: application/json" \
  -d '{"minAmount": 10, "debugEvents": true}'

# Trigger sample data (if dev endpoints enabled)
curl -X POST https://helius.wonderswhisper.com/dev/transfers \
  -H "Content-Type: application/json" \
  -d '[]'
```

## 📋 Event Data Formats

### Transfer Event
```json
{
  "walletAddress": "ABC123...",
  "tokenAddress": "DEF456...",
  "amount": "1.23",
  "signature": "GHI789...",
  "timestamp": "2025-08-11T10:30:00.000Z",
  "side": "BUY"
}
```

### Coordinated Trade Event
```json
{
  "tokenAddress": "DEF456...",
  "windowStart": "2025-08-11T10:25:00.000Z",
  "windowEnd": "2025-08-11T10:30:00.000Z",
  "triggeredAt": "2025-08-11T10:30:15.000Z",
  "uniqueWalletCount": 7,
  "walletAddresses": ["ABC123...", "XYZ789..."]
}
```

## 🛠️ Management

### On the Host PC (where Docker is running):

```powershell
# Check status
.\tunnel.ps1 status

# Start tunnel
.\tunnel.ps1 start

# Stop tunnel  
.\tunnel.ps1 stop

# Test connection
.\tunnel.ps1 test

# View Docker logs
docker-compose --env-file .env.production logs -f

# Restart application
docker-compose --env-file .env.production restart
```

## 🔒 Security Notes

- HTTPS is automatically provided by Cloudflare
- The tunnel is secured with Cloudflare's authentication
- Local network access requires firewall configuration
- Change default webhook secrets in production

## 🆘 Troubleshooting

### If remote access isn't working:

1. **Check tunnel status**: `.\tunnel.ps1 status`
2. **Verify Docker is running**: `docker-compose --env-file .env.production ps`
3. **Test local access**: http://localhost:8080/health
4. **Check tunnel logs**: Look for "Registered tunnel connection" messages

### Common issues:

- **Tunnel not starting**: Check if cloudflared is logged in
- **Local app not responding**: Restart Docker container
- **SSE not connecting**: Check browser console for CORS errors
- **No data flowing**: Verify Helius webhook is configured correctly

## 📞 Support

Your Helius Wallet Tracker is now production-ready and accessible from anywhere in the world! 🌍

The combination of Docker + Cloudflare Tunnel provides:
- ✅ Secure HTTPS access
- ✅ No port forwarding needed
- ✅ Dynamic IP support
- ✅ Built-in DDoS protection
- ✅ Real-time SSE streaming
- ✅ Production-grade reliability
