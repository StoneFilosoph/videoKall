#!/bin/bash

# VideoKall Setup Script for Linux
# This script walks you through the complete setup process

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Print functions
print_header() {
	echo ""
	echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
	echo -e "${CYAN}  $1${NC}"
	echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
	echo ""
}

print_step() {
	echo -e "${YELLOW}[$1]${NC} $2"
}

print_success() {
	echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
	echo -e "${BLUE}→${NC} ${GRAY}$1${NC}"
}

print_warning() {
	echo -e "${YELLOW}⚠ $1${NC}"
}

# Generate random string
generate_random() {
	local length=$1
	cat /dev/urandom | tr -dc 'A-Za-z0-9' | head -c $length
}

generate_password() {
	cat /dev/urandom | tr -dc 'A-Za-z0-9!@#$%' | head -c 16
}

# Get public IP
get_public_ip() {
	curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo ""
}

# Get local IPs
get_local_ips() {
	hostname -I 2>/dev/null | tr ' ' '\n' | grep -v '^$' || ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1'
}

# ============================================================
# MAIN SCRIPT
# ============================================================

clear
echo ""
echo -e "${MAGENTA}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║                                                               ║${NC}"
echo -e "${MAGENTA}║              🎥  VideoKall Setup Wizard  🎥                  ║${NC}"
echo -e "${MAGENTA}║                                                               ║${NC}"
echo -e "${MAGENTA}║     Simple family video calling - self-hosted & private      ║${NC}"
echo -e "${MAGENTA}║                                                               ║${NC}"
echo -e "${MAGENTA}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ============================================================
# Step 1: Choose deployment mode
# ============================================================
print_header "Step 1: Choose Deployment Mode"

echo "Where are you setting up VideoKall?"
echo ""
echo -e "  ${YELLOW}[1]${NC} Local Server (home network)"
print_info "    For testing at home with local IPs"
echo ""
echo -e "  ${YELLOW}[2]${NC} VPS / Remote Server (internet)"
print_info "    For access over the internet with public IP"
echo ""

while true; do
	read -p "Enter choice (1 or 2): " mode
	if [[ "$mode" == "1" || "$mode" == "2" ]]; then
		break
	fi
	echo "Please enter 1 or 2"
done

IS_LOCAL=$([[ "$mode" == "1" ]] && echo "true" || echo "false")

# ============================================================
# Step 2: Configure IP Address
# ============================================================
print_header "Step 2: Configure Server IP Address"

if [[ "$IS_LOCAL" == "true" ]]; then
	echo "Detecting your local IP addresses..."
	mapfile -t LOCAL_IPS < <(get_local_ips)
	
	if [[ ${#LOCAL_IPS[@]} -gt 0 ]]; then
		echo ""
		echo "Found these IP addresses on your machine:"
		for i in "${!LOCAL_IPS[@]}"; do
			echo -e "  ${YELLOW}[$((i+1))]${NC} ${GREEN}${LOCAL_IPS[$i]}${NC}"
		done
		echo -e "  ${YELLOW}[M]${NC} Enter manually"
		echo ""
		
		while true; do
			read -p "Choose IP address: " ip_choice
			if [[ "${ip_choice,,}" == "m" ]]; then
				read -p "Enter server IP address: " SERVER_IP
				break
			fi
			idx=$((ip_choice - 1))
			if [[ $idx -ge 0 && $idx -lt ${#LOCAL_IPS[@]} ]]; then
				SERVER_IP="${LOCAL_IPS[$idx]}"
				break
			fi
			print_warning "Invalid choice, try again"
		done
	else
		read -p "Enter your server's local IP address (e.g., 192.168.1.100): " SERVER_IP
	fi
else
	echo "Detecting your public IP address..."
	DETECTED_IP=$(get_public_ip)
	
	if [[ -n "$DETECTED_IP" ]]; then
		echo -e "Detected public IP: ${GREEN}$DETECTED_IP${NC}"
		read -p "Use this IP? (Y/n): " use_detected
		if [[ "${use_detected,,}" != "n" ]]; then
			SERVER_IP="$DETECTED_IP"
		else
			read -p "Enter your server's public IP address: " SERVER_IP
		fi
	else
		echo "Could not detect public IP."
		read -p "Enter your server's public IP address: " SERVER_IP
	fi
fi

print_success "Using IP: $SERVER_IP"

# ============================================================
# Step 3: Security Configuration
# ============================================================
print_header "Step 3: Security Configuration"

# Special Code
echo "The Special Code is used to create new call rooms."
echo -e "${GRAY}Only people who know this code can start calls.${NC}"
echo ""

SUGGESTED_CODE=$(generate_random 8 | tr '[:lower:]' '[:upper:]')
echo -e "Suggested code: ${GREEN}$SUGGESTED_CODE${NC}"
echo ""

read -p "Enter special code (press Enter to use suggested): " code_input
if [[ -z "$code_input" ]]; then
	SPECIAL_CODE="$SUGGESTED_CODE"
else
	SPECIAL_CODE="$code_input"
fi
print_success "Special Code: $SPECIAL_CODE"
echo ""

# TURN Credentials
echo "TURN server credentials (used for video relay):"
echo ""

SUGGESTED_USER="videokall_$(generate_random 4 | tr '[:upper:]' '[:lower:]')"
SUGGESTED_PASS=$(generate_password)

echo -e "Suggested username: ${GREEN}$SUGGESTED_USER${NC}"
read -p "Enter TURN username (press Enter to use suggested): " user_input
if [[ -z "$user_input" ]]; then
	TURN_USER="$SUGGESTED_USER"
else
	TURN_USER="$user_input"
fi

echo ""
echo -e "Suggested password: ${GREEN}$SUGGESTED_PASS${NC}"
read -p "Enter TURN password (press Enter to use suggested): " pass_input
if [[ -z "$pass_input" ]]; then
	TURN_PASS="$SUGGESTED_PASS"
else
	TURN_PASS="$pass_input"
fi

print_success "TURN Username: $TURN_USER"
print_success "TURN Password: $TURN_PASS"

# ============================================================
# Step 4: HTTPS Configuration
# ============================================================
print_header "Step 4: HTTPS Configuration"

echo "HTTPS is required for camera/microphone access in browsers."
echo ""

if [[ "$IS_LOCAL" == "true" ]]; then
	echo -e "${GRAY}For local testing, we'll create a self-signed certificate.${NC}"
	echo -e "${GRAY}Your browser will show a security warning - this is normal for self-signed certs.${NC}"
	ENABLE_HTTPS="true"
	USE_SELFSIGNED="true"
else
	echo "For VPS deployment, you have two options:"
	echo ""
	echo -e "  ${YELLOW}[1]${NC} Self-signed certificate (quick, shows browser warning)"
	echo -e "  ${YELLOW}[2]${NC} I'll set up Let's Encrypt later (no warning, needs domain)"
	echo -e "  ${YELLOW}[3]${NC} Skip HTTPS for now (HTTP only, camera won't work remotely)"
	echo ""
	
	while true; do
		read -p "Enter choice (1, 2, or 3): " https_choice
		if [[ "$https_choice" == "1" || "$https_choice" == "2" || "$https_choice" == "3" ]]; then
			break
		fi
	done
	
	case $https_choice in
		"1") ENABLE_HTTPS="true"; USE_SELFSIGNED="true" ;;
		"2") ENABLE_HTTPS="true"; USE_SELFSIGNED="false" ;;
		"3") ENABLE_HTTPS="false"; USE_SELFSIGNED="false" ;;
	esac
fi

# ============================================================
# Step 5: Create Configuration Files
# ============================================================
print_header "Step 5: Creating Configuration Files"

# Create .env file
print_step 1 "Creating .env file..."

cat > .env << EOF
# VideoKall Configuration
# Generated by setup script on $(date '+%Y-%m-%d %H:%M:%S')

# ============================================================
# SERVER IP ADDRESS
# ============================================================
EXTERNAL_IP=$SERVER_IP

# ============================================================
# SECURITY SETTINGS
# ============================================================

# Special code for creating rooms (keep this secret!)
SPECIAL_CODE=$SPECIAL_CODE

# TURN server credentials
TURN_USERNAME=$TURN_USER
TURN_PASSWORD=$TURN_PASS
TURN_REALM=videokall.local

# ============================================================
# OPTIONAL SETTINGS
# ============================================================

# Override TURN server URL (leave empty to use default)
TURN_SERVER_PUBLIC=

# Enable TURNS (TLS) on TURN server
TURN_TLS_ENABLED=false
EOF

print_success ".env file created"

# Generate self-signed certificate if needed
if [[ "$USE_SELFSIGNED" == "true" ]]; then
	print_step 2 "Generating self-signed SSL certificate..."
	
	mkdir -p nginx/certs
	
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout nginx/certs/key.pem \
		-out nginx/certs/cert.pem \
		-subj "/CN=$SERVER_IP" \
		-addext "subjectAltName=IP:$SERVER_IP,IP:127.0.0.1,DNS:localhost" \
		2>/dev/null
	
	print_success "SSL certificate generated"
fi

# Update nginx.conf for HTTPS if needed
if [[ "$ENABLE_HTTPS" == "true" ]]; then
	print_step 3 "Enabling HTTPS in nginx configuration..."
	
	cat > nginx/nginx.conf << 'NGINXEOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    sendfile on;
    keepalive_timeout 65;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/javascript application/json;

    # Upstream for signaling server
    upstream signaling {
        server signaling:3000;
    }

    # HTTP - also serve for local testing
    server {
        listen 80;
        server_name _;
        
        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /ws {
            proxy_pass http://signaling;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 86400;
        }

        location /health {
            proxy_pass http://signaling/health;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name _;

        ssl_certificate /etc/nginx/certs/cert.pem;
        ssl_certificate_key /etc/nginx/certs/key.pem;
        
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_prefer_server_ciphers on;

        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /ws {
            proxy_pass http://signaling;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_read_timeout 86400;
        }

        location /health {
            proxy_pass http://signaling/health;
        }
    }
}
NGINXEOF
	
	print_success "nginx.conf updated for HTTPS"
else
	print_step 3 "Keeping HTTP-only configuration"
fi

# ============================================================
# Step 6: Summary & Next Steps
# ============================================================
print_header "Setup Complete!"

echo "Your configuration has been saved. Here's a summary:"
echo ""

echo -e "${GRAY}┌─────────────────────────────────────────────────────────────┐${NC}"
echo -e "${GRAY}│${NC} Configuration Summary                                       ${GRAY}│${NC}"
echo -e "${GRAY}├─────────────────────────────────────────────────────────────┤${NC}"
printf "${GRAY}│${NC} Server IP:      ${GREEN}%-42s${NC}${GRAY}│${NC}\n" "$SERVER_IP"
printf "${GRAY}│${NC} Special Code:   ${GREEN}%-42s${NC}${GRAY}│${NC}\n" "$SPECIAL_CODE"
printf "${GRAY}│${NC} TURN Username:  ${GREEN}%-42s${NC}${GRAY}│${NC}\n" "$TURN_USER"
printf "${GRAY}│${NC} TURN Password:  ${GREEN}%-42s${NC}${GRAY}│${NC}\n" "$TURN_PASS"
HTTPS_STATUS=$([[ "$ENABLE_HTTPS" == "true" ]] && echo "Enabled (self-signed)" || echo "Disabled")
printf "${GRAY}│${NC} HTTPS:          ${GREEN}%-42s${NC}${GRAY}│${NC}\n" "$HTTPS_STATUS"
echo -e "${GRAY}└─────────────────────────────────────────────────────────────┘${NC}"

echo ""
print_header "Next Steps"

print_step 1 "Start VideoKall with Docker:"
echo ""
echo -e "   ${CYAN}docker-compose up -d${NC}"
echo ""

print_step 2 "Access the application:"
echo ""
if [[ "$ENABLE_HTTPS" == "true" ]]; then
	echo -e "   ${GRAY}HTTPS:${NC} ${GREEN}https://$SERVER_IP${NC}"
	echo -e "   ${GRAY}HTTP:${NC}  ${YELLOW}http://$SERVER_IP${NC}"
	echo ""
	if [[ "$USE_SELFSIGNED" == "true" ]]; then
		print_warning "Your browser will show a security warning for self-signed certificate."
		print_info "Click 'Advanced' → 'Proceed to $SERVER_IP (unsafe)' to continue."
	fi
else
	echo -e "   ${GREEN}http://$SERVER_IP${NC}"
fi
echo ""

print_step 3 "Create a call:"
echo ""
echo -e "   ${GRAY}• Enter the special code:${NC} ${CYAN}$SPECIAL_CODE${NC}"
echo -e "   ${GRAY}• Click 'Create Room'${NC}"
echo -e "   ${GRAY}• Share the generated code with your family member${NC}"
echo ""

if [[ "$IS_LOCAL" == "false" ]]; then
	print_header "Firewall Configuration"
	echo -e "${YELLOW}Make sure these ports are open on your VPS/firewall:${NC}"
	echo ""
	echo -e "   ${GRAY}Port 80     TCP      - HTTP web interface${NC}"
	echo -e "   ${GRAY}Port 443    TCP      - HTTPS web interface${NC}"
	echo -e "   ${GRAY}Port 3478   TCP+UDP  - TURN/STUN server${NC}"
	echo -e "   ${GRAY}Port 5349   TCP+UDP  - TURN/STUN over TLS${NC}"
	echo -e "   ${GRAY}Ports 49152-49200 UDP - TURN relay ports${NC}"
	echo ""
fi

print_header "Useful Commands"
echo ""
echo -e "   ${GRAY}View logs:${NC}          ${CYAN}docker-compose logs -f${NC}"
echo -e "   ${GRAY}Stop services:${NC}      ${CYAN}docker-compose down${NC}"
echo -e "   ${GRAY}Restart services:${NC}   ${CYAN}docker-compose restart${NC}"
echo -e "   ${GRAY}Check status:${NC}       ${CYAN}docker-compose ps${NC}"
echo ""

# Save credentials to a file for reference
cat > CREDENTIALS.txt << EOF
VideoKall Credentials
Generated: $(date '+%Y-%m-%d %H:%M:%S')
═══════════════════════════════════════════════════════════════

Server IP:      $SERVER_IP
Special Code:   $SPECIAL_CODE

TURN Username:  $TURN_USER
TURN Password:  $TURN_PASS

Access URLs:
  HTTP:  http://$SERVER_IP
  HTTPS: https://$SERVER_IP

⚠️ KEEP THIS FILE SECURE - It contains sensitive credentials!
EOF

print_success "Credentials saved to CREDENTIALS.txt (keep this file secure!)"
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Setup complete! Run 'docker-compose up -d' to start.        ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

