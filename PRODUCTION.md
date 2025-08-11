# Helius Wallet Tracker - Production Setup Guide

## Quick Start with Docker

### 1. Prerequisites
- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) for Windows
- Ensure Docker is running

### 2. Configure Environment
```powershell
# Copy and edit the production environment file
Copy-Item .env.production .env.production.local
# Edit .env.production.local with your settings (see Configuration section below)
# Rename it to .env.production when ready
Rename-Item .env.production.local .env.production
```

### 3. Deploy
```powershell
# Run the deployment script
.\deploy.ps1
```

The script will:
- Build the Docker image
- Set up the database
- Start the application
- Show you the access URLs

## Configuration

Edit `.env.production` with your settings:

### Required Settings
```env
HELIUS_API_KEY=your_helius_api_key_here
WEBHOOK_URL=https://your-domain.com/helius
WEBHOOK_SECRET=your-super-secret-webhook-password
```

### Optional Settings
```env
# Token filtering
EXCLUDE_TOKENS=So11111111111111111111111111111111111111112  # Exclude SOL
MIN_AMOUNT=1                                                  # Minimum transaction amount

# Coordination detection
COORDINATED_WINDOW_MINUTES=5                                  # Time window for coordination
COORDINATED_MIN_WALLETS=3                                     # Minimum wallets for coordination

# Debugging (set to 0 for production)
DEBUG_EVENTS=0
DEBUG_EVENTS_VERBOSE=0
```

## Accessing from Other PCs

### Option 1: Local Network Access
After deployment, your app will be accessible at:
- `http://YOUR_PC_IP:8080` (replace YOUR_PC_IP with your actual IP)

To find your IP:
```powershell
ipconfig | findstr "IPv4"
```

### Option 2: Internet Access (Port Forwarding)
1. **Router Setup**: Forward port 8080 from your router to your PC
2. **Windows Firewall**: Allow port 8080
   ```powershell
   netsh advfirewall firewall add rule name="Helius Tracker" dir=in action=allow protocol=TCP localport=8080
   ```
3. **Access via**: `http://YOUR_PUBLIC_IP:8080`

### Option 3: Cloudflare Tunnel (Recommended for Internet)
```powershell
# Install Cloudflare tunnel
winget install Cloudflare.cloudflared

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create helius-tracker

# Run tunnel
cloudflared tunnel run helius-tracker --url http://localhost:8080
```

## SSE (Server-Sent Events) Endpoints

Your app provides real-time data streams:

- **All Events**: `/stream/all` - Combined transfers and coordination events
- **Transfers Only**: `/stream/transfers` - Individual wallet transactions
- **Coordination Only**: `/stream/coordinated` - Coordinated trading events

### Example Client Code
```javascript
// Connect to SSE stream
const eventSource = new EventSource('http://YOUR_IP:8080/stream/all');

// Listen for transfer events
eventSource.addEventListener('transfers', (event) => {
    const transfers = JSON.parse(event.data);
    console.log('New transfers:', transfers);
});

// Listen for coordination events
eventSource.addEventListener('coordinated', (event) => {
    const coordination = JSON.parse(event.data);
    console.log('Coordinated trade detected:', coordination);
});
```

## Management Commands

```powershell
# View logs
docker-compose --env-file .env.production logs -f

# Stop application
docker-compose --env-file .env.production down

# Restart application
docker-compose --env-file .env.production restart

# View container status
docker-compose --env-file .env.production ps

# Access container shell
docker-compose --env-file .env.production exec helius-tracker sh

# View database with Prisma Studio (development)
docker-compose --env-file .env.production exec helius-tracker npx prisma studio
```

## Monitoring

### Health Check
- URL: `http://localhost:8080/health`
- Returns: `{"ok": true}` if healthy

### Web Dashboard
- URL: `http://localhost:8080/realtime-test.html`
- Real-time monitoring interface

### Configuration API
- Get config: `GET http://localhost:8080/config`
- Update config: `PATCH http://localhost:8080/config`

## Security Considerations

### Production Security
1. **Change default secrets** in `.env.production`
2. **Use HTTPS** with reverse proxy (nginx/Cloudflare)
3. **Firewall rules** - only allow necessary ports
4. **Regular updates** - keep Docker images updated

### Network Security
```powershell
# Windows Firewall - allow only specific IPs
netsh advfirewall firewall add rule name="Helius Tracker Specific" dir=in action=allow protocol=TCP localport=8080 remoteip=192.168.1.0/24
```

## Troubleshooting

### Common Issues

1. **Docker not starting**
   ```powershell
   # Check Docker service
   Get-Service docker
   # Restart Docker Desktop
   ```

2. **Port already in use**
   ```powershell
   # Check what's using port 8080
   netstat -ano | findstr :8080
   # Kill process if needed
   taskkill /F /PID <PID>
   ```

3. **Database issues**
   ```powershell
   # Reset database
   docker-compose --env-file .env.production down -v
   .\deploy.ps1
   ```

4. **SSL/HTTPS for webhooks**
   - Helius requires HTTPS for webhooks
   - Use Cloudflare tunnel or nginx with SSL certificate

### Logs and Debugging
```powershell
# Application logs
docker-compose --env-file .env.production logs helius-tracker

# Enable debug mode temporarily
$env:DEBUG_EVENTS=1
docker-compose --env-file .env.production restart
```

## Scaling and Performance

### Resource Limits
Add to `docker-compose.yml`:
```yaml
services:
  helius-tracker:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
```

### Multiple Instances
```yaml
services:
  helius-tracker:
    scale: 2  # Run 2 instances
    ports:
      - "8080-8081:8080"  # Map to different ports
```
