#!/bin/bash
# Let's Encrypt Setup Script for VideoKall
# This script helps you obtain a free SSL certificate from Let's Encrypt

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

write_header() {
	echo ""
	echo -e "${CYAN}======================================================================${NC}"
	echo -e "${CYAN}  $1${NC}"
	echo -e "${CYAN}======================================================================${NC}"
	echo ""
}

write_step() {
	echo -e "${YELLOW}[$1]${NC} $2"
}

write_success() {
	echo -e "${GREEN}[OK]${NC} ${GREEN}$1${NC}"
}

write_info() {
	echo -e "${BLUE} ->${NC} ${GRAY}$1${NC}"
}

write_warning() {
	echo -e "${YELLOW}[!]${NC} ${YELLOW}$1${NC}"
}

write_error() {
	echo -e "${RED}[ERROR]${NC} ${RED}$1${NC}"
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

clear
echo ""
echo -e "${GREEN}+==================================================================+${NC}"
echo -e "${GREEN}|          Let's Encrypt SSL Certificate Setup                     |${NC}"
echo -e "${GREEN}|                   FREE Trusted HTTPS                             |${NC}"
echo -e "${GREEN}+==================================================================+${NC}"
echo ""

write_header "Prerequisites"
echo "Before continuing, make sure you have:"
echo ""
echo -e "  ${YELLOW}[1]${NC} A domain name pointing to your server"
write_info "    Example: videokall.yourdomain.com"
write_info "    Free options: duckdns.org, noip.com, freenom.com"
echo ""
echo -e "  ${YELLOW}[2]${NC} Port 80 open and accessible from the internet"
write_info "    Let's Encrypt uses port 80 to verify domain ownership"
echo ""
echo -e "  ${YELLOW}[3]${NC} Docker and docker-compose installed"
echo ""

read -p "Do you have these ready? (y/n): " continue_setup
if [[ "$continue_setup" != "y" && "$continue_setup" != "Y" ]]; then
	echo ""
	echo -e "${YELLOW}Please set up a domain name first. Here are free options:${NC}"
	echo ""
	echo -e "  ${CYAN}DuckDNS:  https://www.duckdns.org/${NC}"
	echo -e "  ${CYAN}No-IP:    https://www.noip.com/${NC}"
	echo -e "  ${CYAN}Freenom:  https://www.freenom.com/${NC}"
	echo ""
	exit 0
fi

write_header "Step 1: Enter Your Domain"

read -p "Enter your domain name (e.g., videokall.example.com): " domain
if [[ -z "$domain" ]]; then
	write_error "Domain name is required!"
	exit 1
fi

write_success "Domain: $domain"
echo ""

write_header "Step 2: Enter Your Email"
echo -e "${GRAY}Let's Encrypt requires an email for important notifications${NC}"
echo -e "${GRAY}(certificate expiry warnings, etc.)${NC}"
echo ""

read -p "Enter your email address: " email
if [[ -z "$email" ]]; then
	write_error "Email is required!"
	exit 1
fi

write_success "Email: $email"

write_header "Step 3: Update Configuration"

# Update nginx config with the domain
write_step 1 "Updating nginx configuration..."

cat > "$SCRIPT_DIR/nginx/nginx-letsencrypt.conf" << EOF
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    sendfile on;
    keepalive_timeout 65;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json;

    upstream signaling {
        server signaling:3000;
    }

    # HTTP - for Let's Encrypt verification
    server {
        listen 80;
        server_name $domain;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://\$host\$request_uri;
        }
    }

    # HTTPS with Let's Encrypt
    server {
        listen 443 ssl http2;
        server_name $domain;

        ssl_certificate /etc/letsencrypt/live/$domain/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/$domain/privkey.pem;
        
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_prefer_server_ciphers on;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 1d;

        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files \$uri \$uri/ /index.html;
        }

        location /ws {
            proxy_pass http://signaling;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_read_timeout 86400;
        }

        location /health {
            proxy_pass http://signaling/health;
        }
    }
}
EOF

write_success "nginx-letsencrypt.conf updated"

write_header "Step 4: Obtain Certificate"

echo "Now we will:"
echo -e "  ${GRAY}1. Start nginx with HTTP only${NC}"
echo -e "  ${GRAY}2. Request certificate from Let's Encrypt${NC}"
echo -e "  ${GRAY}3. Switch to HTTPS configuration${NC}"
echo ""

read -p "Ready to proceed? (y/n): " proceed
if [[ "$proceed" != "y" && "$proceed" != "Y" ]]; then
	echo -e "${YELLOW}Aborted.${NC}"
	exit 0
fi

echo ""

# Create certbot webroot directory
write_step 0 "Creating certbot directories..."
mkdir -p "$SCRIPT_DIR/certbot-webroot/.well-known/acme-challenge"
mkdir -p "$SCRIPT_DIR/letsencrypt"
write_success "Directories created"

write_step 1 "Starting nginx with HTTP configuration..."

# Stop existing containers
echo -e "${GRAY}Stopping existing containers...${NC}"
docker-compose down 2>/dev/null || true

write_step 2 "Requesting certificate from Let's Encrypt..."
echo ""
echo -e "${GRAY}This may take a minute...${NC}"
echo ""

# Request certificate
if docker run --rm \
	-v "$SCRIPT_DIR/letsencrypt:/etc/letsencrypt" \
	-v "$SCRIPT_DIR/certbot-webroot:/var/www/certbot" \
	certbot/certbot certonly --webroot \
	--webroot-path=/var/www/certbot \
	--email "$email" \
	--agree-tos \
	--no-eff-email \
	-d "$domain"; then
	write_success "Certificate obtained!"
else
	write_error "Certificate request failed. Please check:"
	echo -e "  ${YELLOW}- Domain $domain points to this server's IP${NC}"
	echo -e "  ${YELLOW}- Port 80 is open and accessible${NC}"
	echo -e "  ${YELLOW}- No firewall blocking the connection${NC}"
	exit 1
fi

write_step 3 "Switching to HTTPS configuration..."

# Start full stack with HTTPS
docker-compose -f docker-compose.letsencrypt.yml up -d

write_header "Setup Complete!"

echo ""
echo -e "${GREEN}+-------------------------------------------------------------+${NC}"
echo -e "${GREEN}|  SSL Certificate Successfully Installed!                    |${NC}"
echo -e "${GREEN}+-------------------------------------------------------------+${NC}"
echo ""
echo "Your site is now available at:"
echo ""
echo -e "   ${CYAN}https://$domain${NC}"
echo ""
echo -e "${GRAY}The certificate will auto-renew every 60-90 days.${NC}"
echo ""

write_header "Important Notes"
echo ""
echo -e "  ${GRAY}- Certificates are stored in: ./letsencrypt/${NC}"
echo -e "  ${GRAY}- To restart: docker-compose -f docker-compose.letsencrypt.yml restart${NC}"
echo -e "  ${GRAY}- To stop: docker-compose -f docker-compose.letsencrypt.yml down${NC}"
echo -e "  ${GRAY}- To view logs: docker-compose -f docker-compose.letsencrypt.yml logs -f${NC}"
echo ""
