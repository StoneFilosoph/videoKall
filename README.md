# VideoKall - Simple Family Video Calling

A lightweight, self-hosted video calling application for family use. Features simple room creation with a special code and easy-to-share calling addresses.

## Features

- **Simple room creation** - Enter your special code to create a call
- **Easy sharing** - Generate unique calling addresses like `kx7m-p9qw-r3nt`
- **1:1 video calls** - High quality peer-to-peer video with WebRTC
- **Self-hosted TURN server** - Works behind restrictive firewalls and NATs
- **Docker deployment** - One command to run everything

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- A server with ports 80, 443, 3478, 5349, and 49152-49200 available

### Easy Setup (Recommended)

Use the interactive setup wizard that walks you through the entire configuration:

**On Windows (PowerShell):**
```powershell
.\setup.ps1
```

**On Linux/Mac:**
```bash
chmod +x setup.sh
./setup.sh
```

The wizard will:
- ✅ Detect your IP address automatically
- ✅ Generate secure credentials
- ✅ Create the `.env` configuration file
- ✅ Generate SSL certificates for HTTPS
- ✅ Configure nginx for HTTPS
- ✅ Save all credentials to a file for reference

After running the setup, just start with:
```bash
docker-compose up -d
```

### Manual Setup

If you prefer to configure manually:

1. **Clone or download this project**

2. **Create your configuration file**
   ```bash
   cp env.example .env
   ```

3. **Edit `.env` with your settings**
   ```env
   # Change the special code to something only your family knows
   SPECIAL_CODE=YOUR_SECRET_CODE
   
   # Change TURN credentials
   TURN_USERNAME=your_username
   TURN_PASSWORD=your_strong_password
   
   # Set your server's public IP (required for remote access)
   EXTERNAL_IP=your.server.ip.address
   ```

4. **Start the application**
   ```bash
   docker-compose up -d
   ```

5. **Access the application**
   - Open `http://your-server-ip` in your browser
   - For HTTPS (required for camera access in production), see the HTTPS section below

## How It Works

### Creating a Call (Host)

1. Open the VideoKall website
2. Enter your special code in "Start a Call"
3. Click "Create Room"
4. Share the generated calling address with your family member

### Joining a Call (Guest)

1. Open the VideoKall website
2. Enter the calling address in "Join a Call"
3. Click "Join Room"
4. You're connected!

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Stack                          │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   nginx     │  │  signaling  │  │   turnserver    │ │
│  │  (web)      │  │  (Node.js)  │  │   (coturn)      │ │
│  │  :80/:443   │  │   :3000     │  │  :3478/:5349    │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│         │                │                    │         │
└─────────┼────────────────┼────────────────────┼─────────┘
          │                │                    │
    Static files     WebSocket          TURN relay
    & WS proxy       signaling         (fallback)
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SPECIAL_CODE` | `FAMILY2024` | Secret code for creating rooms |
| `TURN_USERNAME` | `videokall` | TURN server username |
| `TURN_PASSWORD` | `videokall123` | TURN server password |
| `TURN_REALM` | `videokall.local` | TURN server realm |
| `EXTERNAL_IP` | (empty) | Your server's public IP address |

### Ports

| Port | Protocol | Service |
|------|----------|---------|
| 80 | TCP | Web interface (HTTP) |
| 443 | TCP | Web interface (HTTPS) |
| 3478 | TCP/UDP | TURN/STUN server |
| 5349 | TCP/UDP | TURN/STUN over TLS |
| 49152-49200 | UDP | TURN relay ports |

## Enabling HTTPS

For production use, you need HTTPS for camera/microphone access. Here's how to set it up:

### Option 1: Using Let's Encrypt with Certbot

1. Install certbot on your host machine
2. Get certificates:
   ```bash
   certbot certonly --standalone -d your-domain.com
   ```
3. Copy certificates to the nginx/certs folder:
   ```bash
   cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/certs/cert.pem
   cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/certs/key.pem
   ```
4. Uncomment the HTTPS server block in `nginx/nginx.conf`
5. Restart: `docker-compose restart web`

### Option 2: Self-Signed Certificate (for testing)

```bash
mkdir -p nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/key.pem \
  -out nginx/certs/cert.pem \
  -subj "/CN=localhost"
```

## Troubleshooting

### Video/Audio not working

- Ensure HTTPS is enabled (browsers require secure context for camera access)
- Check that your browser has permission to access camera/microphone
- Try a different browser

### Connection fails or times out

- Verify `EXTERNAL_IP` is set to your server's public IP
- Check that ports 3478 and 49152-49200 are open in your firewall
- Ensure both peers can reach your server

### "Room not found" error

- Room codes are case-insensitive
- Rooms expire after 24 hours
- The host must create the room first

## Development

### Running locally without Docker

1. Start the signaling server:
   ```bash
   cd signaling
   npm install
   npm start
   ```

2. Serve the frontend:
   ```bash
   cd frontend
   npx serve .
   ```

3. For TURN, you'll need to install coturn separately or use public STUN servers only.

### Project Structure

```
VideoKall/
├── docker-compose.yml      # Container orchestration
├── .env                    # Configuration (create from .env.example)
├── frontend/
│   ├── index.html          # Main UI
│   ├── style.css           # Styling
│   └── app.js              # WebRTC client logic
├── signaling/
│   ├── server.js           # WebSocket signaling server
│   ├── package.json        # Node.js dependencies
│   └── Dockerfile          # Container build
├── turnserver/
│   ├── turnserver.conf     # Coturn configuration
│   ├── entrypoint.sh       # Startup script
│   └── Dockerfile          # Container build
└── nginx/
    ├── nginx.conf          # Web server configuration
    └── certs/              # SSL certificates (optional)
```

## Security Notes

This application is designed for private family use:

- The special code should be kept secret and only shared with trusted family members
- Room addresses are randomly generated (36^12 ≈ 4.7 × 10^18 combinations)
- No persistent storage - all rooms exist only in memory
- Consider using a VPN or private network for additional security

## License

MIT License - Feel free to use and modify for your needs.

