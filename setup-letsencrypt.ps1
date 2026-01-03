# Let's Encrypt Setup Script for VideoKall
# This script helps you obtain a free SSL certificate from Let's Encrypt

$ErrorActionPreference = "Stop"

function Write-Color {
	param([string]$Text, [string]$Color = "White")
	Write-Host $Text -ForegroundColor $Color
}

function Write-Header {
	param([string]$Text)
	Write-Host ""
	Write-Host "======================================================================" -ForegroundColor Cyan
	Write-Host "  $Text" -ForegroundColor Cyan
	Write-Host "======================================================================" -ForegroundColor Cyan
	Write-Host ""
}

function Write-Step {
	param([int]$Num, [string]$Text)
	Write-Host "[$Num] " -ForegroundColor Yellow -NoNewline
	Write-Host $Text -ForegroundColor White
}

function Write-Success {
	param([string]$Text)
	Write-Host "[OK] " -ForegroundColor Green -NoNewline
	Write-Host $Text -ForegroundColor Green
}

function Write-Info {
	param([string]$Text)
	Write-Host " -> " -ForegroundColor Blue -NoNewline
	Write-Host $Text -ForegroundColor Gray
}

Clear-Host
Write-Host ""
Write-Host "+==================================================================+" -ForegroundColor Green
Write-Host "|          Let's Encrypt SSL Certificate Setup                     |" -ForegroundColor Green
Write-Host "|                   FREE Trusted HTTPS                             |" -ForegroundColor Green
Write-Host "+==================================================================+" -ForegroundColor Green
Write-Host ""

Write-Header "Prerequisites"
Write-Host "Before continuing, make sure you have:" -ForegroundColor White
Write-Host ""
Write-Host "  [1] A domain name pointing to your server" -ForegroundColor Yellow
Write-Info "    Example: videokall.yourdomain.com"
Write-Info "    Free options: duckdns.org, noip.com, freenom.com"
Write-Host ""
Write-Host "  [2] Port 80 open and accessible from the internet" -ForegroundColor Yellow
Write-Info "    Let's Encrypt uses port 80 to verify domain ownership"
Write-Host ""
Write-Host "  [3] Docker and docker-compose installed" -ForegroundColor Yellow
Write-Host ""

$continue = Read-Host "Do you have these ready? (y/n)"
if ($continue -ne "y" -and $continue -ne "Y") {
	Write-Host ""
	Write-Host "Please set up a domain name first. Here are free options:" -ForegroundColor Yellow
	Write-Host ""
	Write-Host "  DuckDNS:  https://www.duckdns.org/" -ForegroundColor Cyan
	Write-Host "  No-IP:    https://www.noip.com/" -ForegroundColor Cyan
	Write-Host "  Freenom:  https://www.freenom.com/" -ForegroundColor Cyan
	Write-Host ""
	exit
}

Write-Header "Step 1: Enter Your Domain"

$domain = Read-Host "Enter your domain name (e.g., videokall.example.com)"
if ([string]::IsNullOrWhiteSpace($domain)) {
	Write-Host "Domain name is required!" -ForegroundColor Red
	exit
}

Write-Success "Domain: $domain"
Write-Host ""

Write-Header "Step 2: Enter Your Email"
Write-Host "Let's Encrypt requires an email for important notifications" -ForegroundColor Gray
Write-Host "(certificate expiry warnings, etc.)" -ForegroundColor Gray
Write-Host ""

$email = Read-Host "Enter your email address"
if ([string]::IsNullOrWhiteSpace($email)) {
	Write-Host "Email is required!" -ForegroundColor Red
	exit
}

Write-Success "Email: $email"

Write-Header "Step 3: Update Configuration"

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrEmpty($scriptDir)) {
	$scriptDir = Get-Location
}

# Update nginx config with the domain
Write-Step 1 "Updating nginx configuration..."

$nginxConf = @"
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
            return 301 https://`$host`$request_uri;
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
            try_files `$uri `$uri/ /index.html;
        }

        location /ws {
            proxy_pass http://signaling;
            proxy_http_version 1.1;
            proxy_set_header Upgrade `$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_read_timeout 86400;
        }

        location /health {
            proxy_pass http://signaling/health;
        }
    }
}
"@

$nginxPath = Join-Path $scriptDir "nginx\nginx-letsencrypt.conf"
$nginxConf | Out-File -FilePath $nginxPath -Encoding UTF8
Write-Success "nginx-letsencrypt.conf updated"

# Create initial nginx config (without SSL for first run)
Write-Step 2 "Creating initial config for certificate request..."

$nginxInitial = @"
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80;
        server_name $domain;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            root /usr/share/nginx/html;
            index index.html;
        }
    }
}
"@

$nginxInitialPath = Join-Path $scriptDir "nginx\nginx-initial.conf"
$nginxInitial | Out-File -FilePath $nginxInitialPath -Encoding UTF8
Write-Success "Initial nginx config created"

Write-Header "Step 4: Obtain Certificate"

Write-Host "Now we will:" -ForegroundColor White
Write-Host "  1. Start nginx with HTTP only" -ForegroundColor Gray
Write-Host "  2. Request certificate from Let's Encrypt" -ForegroundColor Gray
Write-Host "  3. Switch to HTTPS configuration" -ForegroundColor Gray
Write-Host ""

$proceed = Read-Host "Ready to proceed? (y/n)"
if ($proceed -ne "y" -and $proceed -ne "Y") {
	Write-Host "Aborted." -ForegroundColor Yellow
	exit
}

Write-Host ""

# Create certbot webroot directory
Write-Step 0 "Creating certbot directories..."
$certbotWebroot = Join-Path $scriptDir "certbot-webroot"
$acmeChallenge = Join-Path $certbotWebroot ".well-known\acme-challenge"
$letsencryptDir = Join-Path $scriptDir "letsencrypt"

New-Item -ItemType Directory -Path $acmeChallenge -Force | Out-Null
New-Item -ItemType Directory -Path $letsencryptDir -Force | Out-Null
Write-Success "Directories created"

Write-Step 1 "Starting nginx with HTTP configuration..."

# Create docker-compose for initial setup
$composeInitial = @"
version: '3'
services:
  web:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./frontend:/usr/share/nginx/html:ro
      - ./nginx/nginx-initial.conf:/etc/nginx/nginx.conf:ro
      - ./certbot-webroot:/var/www/certbot
    networks:
      - videokall

networks:
  videokall:
    driver: bridge
"@

$composeInitialPath = Join-Path $scriptDir "docker-compose.initial.yml"
$composeInitial | Out-File -FilePath $composeInitialPath -Encoding UTF8

# Stop existing containers
Write-Host "Stopping existing containers..." -ForegroundColor Gray
docker-compose down 2>$null

# Start initial nginx
docker-compose -f docker-compose.initial.yml up -d

Start-Sleep -Seconds 3
Write-Success "Nginx started"

Write-Step 2 "Requesting certificate from Let's Encrypt..."
Write-Host ""
Write-Host "This may take a minute..." -ForegroundColor Gray
Write-Host ""

# Request certificate
$certbotCmd = "docker run --rm -v `"${scriptDir}\letsencrypt:/etc/letsencrypt`" -v `"${scriptDir}\certbot-webroot:/var/www/certbot`" certbot/certbot certonly --webroot --webroot-path=/var/www/certbot --email $email --agree-tos --no-eff-email -d $domain"

try {
	Invoke-Expression $certbotCmd
	if ($LASTEXITCODE -ne 0) { throw "Certbot failed" }
	Write-Success "Certificate obtained!"
} catch {
	Write-Host "Certificate request failed. Please check:" -ForegroundColor Red
	Write-Host "  - Domain $domain points to this server's IP" -ForegroundColor Yellow
	Write-Host "  - Port 80 is open and accessible" -ForegroundColor Yellow
	Write-Host "  - No firewall blocking the connection" -ForegroundColor Yellow
	
	# Cleanup
	docker-compose -f docker-compose.initial.yml down
	Remove-Item $composeInitialPath -ErrorAction SilentlyContinue
	exit
}

Write-Step 3 "Switching to HTTPS configuration..."

# Stop initial nginx
docker-compose -f docker-compose.initial.yml down

# Start full stack with HTTPS
docker-compose -f docker-compose.letsencrypt.yml up -d

# Cleanup
Remove-Item $composeInitialPath -ErrorAction SilentlyContinue
Remove-Item $nginxInitialPath -ErrorAction SilentlyContinue

Write-Header "Setup Complete!"

Write-Host ""
Write-Host "+-------------------------------------------------------------+" -ForegroundColor Green
Write-Host "|  SSL Certificate Successfully Installed!                    |" -ForegroundColor Green
Write-Host "+-------------------------------------------------------------+" -ForegroundColor Green
Write-Host ""
Write-Host "Your site is now available at:" -ForegroundColor White
Write-Host ""
Write-Host "   https://$domain" -ForegroundColor Cyan
Write-Host ""
Write-Host "The certificate will auto-renew every 60-90 days." -ForegroundColor Gray
Write-Host ""

Write-Header "Important Notes"
Write-Host ""
Write-Host "  - Certificates are stored in: ./letsencrypt/" -ForegroundColor Gray
Write-Host "  - To restart: docker-compose -f docker-compose.letsencrypt.yml restart" -ForegroundColor Gray
Write-Host "  - To stop: docker-compose -f docker-compose.letsencrypt.yml down" -ForegroundColor Gray
Write-Host "  - To view logs: docker-compose -f docker-compose.letsencrypt.yml logs -f" -ForegroundColor Gray
Write-Host ""
