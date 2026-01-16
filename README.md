# VideoKall - Simple Family Video Calling

A lightweight, self-hosted video calling application for family use. Features admin-managed rooms with persistent storage and easy-to-share calling links.

## Features

- **Admin room management** - Create and manage rooms with a special code
- **Persistent rooms** - Rooms are stored in SQLite and survive restarts
- **Easy sharing** - Generate unique calling links like `?join=kx7m-p9qw-r3nt`
- **Multi-participant video calls** - WebRTC mesh topology for peer-to-peer video
- **Self-hosted TURN server** - Works behind restrictive firewalls and NATs
- **Docker deployment** - One command to run everything
- **Let's Encrypt support** - Free trusted SSL certificates

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- A server with required ports available (see [Ports](#ports) section)

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

After running the setup, start with:

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
   - Default: `http://your-server-ip:8080` or `https://your-server-ip:8443`
   - For HTTPS with standard ports, see the [HTTPS section](#enabling-https)

## How It Works

### Creating a Room (Admin)

1. Open the VideoKall website
2. Enter your special code in the admin login
3. Click "Create Room" and give it a name
4. Copy the room link to share with family members

### Joining a Call (Guest)

1. Open the shared link (e.g., `https://your-server/?join=xxxx-xxxx-xxxx`)
2. Allow camera/microphone access
3. You're connected!

### Managing Rooms (Admin)

- View all rooms and participant counts
- Join any room directly
- Delete rooms when no longer needed
- Rooms persist until you delete them

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Docker Stack                             │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐      │
│  │   nginx     │  │  signaling  │  │   turnserver    │      │
│  │   (web)     │  │  (Node.js)  │  │   (coturn)      │      │
│  │ :8080/:8443 │  │   :3000     │  │  :3478/:5349    │      │
│  └─────────────┘  └─────────────┘  └─────────────────┘      │
│         │                │                    │              │
└─────────┼────────────────┼────────────────────┼──────────────┘
          │                │                    │
    Static files     WebSocket/API        TURN relay
    & WS proxy        signaling          (fallback)
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SPECIAL_CODE` | `FAMILY2024` | Secret code for admin access |
| `TURN_USERNAME` | `videokall` | TURN server username |
| `TURN_PASSWORD` | `videokall123` | TURN server password |
| `TURN_REALM` | `videokall.local` | TURN server realm |
| `EXTERNAL_IP` | (empty) | Your server's public IP address |
| `TURN_SERVER_PUBLIC` | (empty) | Override TURN server URL sent to clients |
| `TURN_TLS_ENABLED` | `false` | Enable TURNS (TLS) for TURN server |

### Ports

**Standard deployment (`docker-compose.yml`):**

| Port | Protocol | Service |
|------|----------|---------|
| 8080 | TCP | Web interface (HTTP) |
| 8443 | TCP | Web interface (HTTPS) |
| 3478 | TCP/UDP | TURN/STUN server |
| 5349 | TCP/UDP | TURN/STUN over TLS |
| 49152-49200 | UDP | TURN relay ports |

**Let's Encrypt deployment (`docker-compose.letsencrypt.yml`):**

| Port | Protocol | Service |
|------|----------|---------|
| 80 | TCP | HTTP (redirects to HTTPS) |
| 443 | TCP | HTTPS |
| 3478 | TCP/UDP | TURN/STUN server |
| 5349 | TCP/UDP | TURN/STUN over TLS |
| 49152-49200 | UDP | TURN relay ports |

## Enabling HTTPS

HTTPS is required for camera/microphone access in browsers.

### Option 1: Let's Encrypt (Recommended for Production)

Use the automated Let's Encrypt setup script for free, trusted certificates:

**On Windows (PowerShell):**

```powershell
.\setup-letsencrypt.ps1
```

**On Linux/Mac:**

```bash
chmod +x setup-letsencrypt.sh
./setup-letsencrypt.sh
```

Then run with:

```bash
docker-compose -f docker-compose.letsencrypt.yml up -d
```

### Option 2: Self-Signed Certificate (for Testing)

The setup wizard can generate a self-signed certificate automatically.

Or manually:

```bash
mkdir -p nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/key.pem \
  -out nginx/certs/cert.pem \
  -subj "/CN=localhost"
```

> ⚠️ Browsers will show a security warning for self-signed certificates. Click "Advanced" → "Proceed" to continue.

### Option 3: Using Existing Certificates

Copy your certificates to the nginx/certs folder:

```bash
cp /path/to/your/fullchain.pem nginx/certs/cert.pem
cp /path/to/your/privkey.pem nginx/certs/key.pem
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
- The room may have been deleted by an admin
- Check if the room exists in the admin panel

### Rooms disappearing after restart

- Rooms are persisted in SQLite database
- Ensure the `signaling-data` Docker volume is not being deleted
- Check Docker volume: `docker volume inspect videokall_signaling-data`

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
├── docker-compose.yml           # Standard deployment (ports 8080/8443)
├── docker-compose.letsencrypt.yml  # Let's Encrypt deployment (ports 80/443)
├── env.example                  # Configuration template
├── setup.ps1                    # Windows setup wizard
├── setup.sh                     # Linux/Mac setup wizard
├── setup-letsencrypt.ps1        # Windows Let's Encrypt setup
├── setup-letsencrypt.sh         # Linux/Mac Let's Encrypt setup
├── frontend/
│   ├── modules/                 # Modular services
│   │   ├── AdminService.js      # Admin API interaction
│   │   ├── SignalingService.js  # WebSocket management
│   │   ├── WebRTCService.js     # Camera/Peer connection logic
│   │   └── UIService.js         # DOM & Interface management
│   ├── index.html               # Main UI
│   ├── style.css                # Styling
│   └── app.js                   # Main controller
├── signaling/
│   ├── server.js                # WebSocket signaling server
│   ├── db.js                    # SQLite database module
│   ├── package.json             # Node.js dependencies
│   └── Dockerfile               # Container build
├── turnserver/
│   ├── turnserver.conf          # Coturn configuration
│   ├── entrypoint.sh            # Startup script
│   └── Dockerfile               # Container build
└── nginx/
    ├── nginx.conf               # Standard web server config
    ├── nginx-letsencrypt.conf   # Let's Encrypt config
    └── certs/                   # SSL certificates
```

## Security Notes

This application is designed for private family use:

- The special code should be kept secret and only shared with trusted family members
- Room addresses are randomly generated (36^12 ≈ 4.7 × 10^18 combinations)
- Rooms persist in SQLite database until manually deleted
- Video/audio is peer-to-peer encrypted with WebRTC DTLS-SRTP
- Consider using a VPN or private network for additional security

## Useful Commands

```bash
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart services
docker-compose restart

# Check status
docker-compose ps

# For Let's Encrypt deployment
docker-compose -f docker-compose.letsencrypt.yml logs -f
docker-compose -f docker-compose.letsencrypt.yml down
docker-compose -f docker-compose.letsencrypt.yml restart
```

## License

MIT License - Feel free to use and modify for your needs.
