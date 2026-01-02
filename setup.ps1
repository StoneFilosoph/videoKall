# VideoKall Setup Script
# This script walks you through the complete setup process

$ErrorActionPreference = "Stop"

# Colors for output
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

function Write-Warning {
	param([string]$Text)
	Write-Host "[!] " -ForegroundColor Yellow -NoNewline
	Write-Host $Text -ForegroundColor Yellow
}

# Generate random password
function New-RandomPassword {
	param([int]$Length = 16)
	$chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	$password = -join ((1..$Length) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
	return $password
}

# Generate random code
function New-RandomCode {
	param([int]$Length = 12)
	$chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	$code = -join ((1..$Length) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
	return $code
}

# Get local IP addresses
function Get-LocalIPs {
	$ips = @()
	Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
		$_.IPAddress -ne "127.0.0.1" -and 
		$_.PrefixOrigin -ne "WellKnown" 
	} | ForEach-Object {
		$ips += $_.IPAddress
	}
	return $ips
}

# ============================================================
# MAIN SCRIPT
# ============================================================

Clear-Host
Write-Host ""
Write-Host "+==================================================================+" -ForegroundColor Magenta
Write-Host "|                                                                  |" -ForegroundColor Magenta
Write-Host "|              VideoKall Setup Wizard                              |" -ForegroundColor Magenta
Write-Host "|                                                                  |" -ForegroundColor Magenta
Write-Host "|     Simple family video calling - self-hosted and private        |" -ForegroundColor Magenta
Write-Host "|                                                                  |" -ForegroundColor Magenta
Write-Host "+==================================================================+" -ForegroundColor Magenta
Write-Host ""

# ============================================================
# Step 1: Choose deployment mode
# ============================================================
Write-Header "Step 1: Choose Deployment Mode"

Write-Host "Where are you setting up VideoKall?" -ForegroundColor White
Write-Host ""
Write-Host "  [1] " -ForegroundColor Yellow -NoNewline
Write-Host "Local Server (home network)" -ForegroundColor White
Write-Info "    For testing at home with local IPs"
Write-Host ""
Write-Host "  [2] " -ForegroundColor Yellow -NoNewline
Write-Host "VPS / Remote Server (internet)" -ForegroundColor White
Write-Info "    For access over the internet with public IP"
Write-Host ""

do {
	$mode = Read-Host "Enter choice (1 or 2)"
} while ($mode -ne "1" -and $mode -ne "2")

$isLocal = $mode -eq "1"

# ============================================================
# Step 2: Configure IP Address
# ============================================================
Write-Header "Step 2: Configure Server IP Address"

if ($isLocal) {
	Write-Host "Detecting your local IP addresses..." -ForegroundColor Gray
	$localIPs = Get-LocalIPs
	
	if ($localIPs.Count -gt 0) {
		Write-Host ""
		Write-Host "Found these IP addresses on your machine:" -ForegroundColor White
		for ($i = 0; $i -lt $localIPs.Count; $i++) {
			Write-Host "  [$($i + 1)] " -ForegroundColor Yellow -NoNewline
			Write-Host $localIPs[$i] -ForegroundColor Green
		}
		Write-Host "  [M] " -ForegroundColor Yellow -NoNewline
		Write-Host "Enter manually" -ForegroundColor White
		Write-Host ""
		
		do {
			$ipChoice = Read-Host "Choose IP address"
			if ($ipChoice -eq "M" -or $ipChoice -eq "m") {
				$serverIP = Read-Host "Enter server IP address"
				break
			}
			$idx = [int]$ipChoice - 1
			if ($idx -ge 0 -and $idx -lt $localIPs.Count) {
				$serverIP = $localIPs[$idx]
				break
			}
			Write-Warning "Invalid choice, try again"
		} while ($true)
	} else {
		$serverIP = Read-Host "Enter your server local IP address (example: 192.168.1.100)"
	}
	
	Write-Success "Using IP: $serverIP"
} else {
	Write-Host "For VPS deployment, you need your server public IP address." -ForegroundColor White
	Write-Host ""
	Write-Info "You can find this in your VPS provider dashboard"
	Write-Info "Or run: curl ifconfig.me"
	Write-Host ""
	
	$serverIP = Read-Host "Enter your server public IP address"
	Write-Success "Using IP: $serverIP"
}

# ============================================================
# Step 3: Security Configuration
# ============================================================
Write-Header "Step 3: Security Configuration"

# Special Code
Write-Host "The Special Code is used to create new call rooms." -ForegroundColor White
Write-Host "Only people who know this code can start calls." -ForegroundColor Gray
Write-Host ""

$suggestedCode = New-RandomCode -Length 8
Write-Host "Suggested code: " -NoNewline
Write-Host $suggestedCode -ForegroundColor Green
Write-Host ""

$codeInput = Read-Host "Enter special code (press Enter to use suggested)"
if ([string]::IsNullOrWhiteSpace($codeInput)) {
	$specialCode = $suggestedCode
} else {
	$specialCode = $codeInput
}
Write-Success "Special Code: $specialCode"
Write-Host ""

# TURN Credentials
Write-Host "TURN server credentials (used for video relay):" -ForegroundColor White
Write-Host ""

$suggestedUser = "videokall_" + (New-RandomCode -Length 4).ToLower()
$suggestedPass = New-RandomPassword -Length 16

Write-Host "Suggested username: " -NoNewline
Write-Host $suggestedUser -ForegroundColor Green
$userInput = Read-Host "Enter TURN username (press Enter to use suggested)"
if ([string]::IsNullOrWhiteSpace($userInput)) {
	$turnUser = $suggestedUser
} else {
	$turnUser = $userInput
}

Write-Host ""
Write-Host "Suggested password: " -NoNewline
Write-Host $suggestedPass -ForegroundColor Green
$passInput = Read-Host "Enter TURN password (press Enter to use suggested)"
if ([string]::IsNullOrWhiteSpace($passInput)) {
	$turnPass = $suggestedPass
} else {
	$turnPass = $passInput
}

Write-Success "TURN Username: $turnUser"
Write-Success "TURN Password: $turnPass"

# ============================================================
# Step 4: HTTPS Configuration
# ============================================================
Write-Header "Step 4: HTTPS Configuration"

Write-Host "HTTPS is required for camera/microphone access in browsers." -ForegroundColor White
Write-Host ""

if ($isLocal) {
	Write-Host "For local testing, we will create a self-signed certificate." -ForegroundColor Gray
	Write-Host "Your browser will show a security warning - this is normal for self-signed certs." -ForegroundColor Gray
	$enableHTTPS = $true
	$useSelfsigned = $true
} else {
	Write-Host "For VPS deployment, you have two options:" -ForegroundColor White
	Write-Host ""
	Write-Host "  [1] " -ForegroundColor Yellow -NoNewline
	Write-Host "Self-signed certificate (quick - shows browser warning)" -ForegroundColor White
	Write-Host "  [2] " -ForegroundColor Yellow -NoNewline
	Write-Host "I will set up Lets Encrypt later (no warning - needs domain)" -ForegroundColor White
	Write-Host "  [3] " -ForegroundColor Yellow -NoNewline
	Write-Host "Skip HTTPS for now (HTTP only - camera will not work remotely)" -ForegroundColor White
	Write-Host ""
	
	do {
		$httpsChoice = Read-Host "Enter choice (1, 2, or 3)"
	} while ($httpsChoice -ne "1" -and $httpsChoice -ne "2" -and $httpsChoice -ne "3")
	
	switch ($httpsChoice) {
		"1" { $enableHTTPS = $true; $useSelfsigned = $true }
		"2" { $enableHTTPS = $true; $useSelfsigned = $false }
		"3" { $enableHTTPS = $false; $useSelfsigned = $false }
	}
}

# ============================================================
# Step 5: Create Configuration Files
# ============================================================
Write-Header "Step 5: Creating Configuration Files"

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrEmpty($scriptDir)) {
	$scriptDir = Get-Location
}

# Create .env file
Write-Step 1 "Creating .env file..."

$envContent = @"
# VideoKall Configuration
# Generated by setup script on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# ============================================================
# SERVER IP ADDRESS
# ============================================================
EXTERNAL_IP=$serverIP

# ============================================================
# SECURITY SETTINGS
# ============================================================

# Special code for creating rooms (keep this secret!)
SPECIAL_CODE=$specialCode

# TURN server credentials
TURN_USERNAME=$turnUser
TURN_PASSWORD=$turnPass
TURN_REALM=videokall.local

# ============================================================
# OPTIONAL SETTINGS
# ============================================================

# Override TURN server URL (leave empty to use default)
TURN_SERVER_PUBLIC=

# Enable TURNS (TLS) on TURN server
TURN_TLS_ENABLED=false
"@

$envPath = Join-Path $scriptDir ".env"
$envContent | Out-File -FilePath $envPath -Encoding UTF8
Write-Success ".env file created"

# Generate self-signed certificate if needed
if ($useSelfsigned) {
	Write-Step 2 "Generating self-signed SSL certificate..."
	
	# Create certs directory
	$certsPath = Join-Path $scriptDir "nginx\certs"
	if (-not (Test-Path $certsPath)) {
		New-Item -ItemType Directory -Path $certsPath -Force | Out-Null
	}
	
	# Check if OpenSSL is available
	$opensslPath = $null
	$gitPath = "C:\Program Files\Git\usr\bin\openssl.exe"
	
	if (Get-Command "openssl" -ErrorAction SilentlyContinue) {
		$opensslPath = "openssl"
	} elseif (Test-Path $gitPath) {
		$opensslPath = $gitPath
	}
	
	if ($opensslPath) {
		# Create OpenSSL config for SAN
		$opensslConf = @"
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = $serverIP

[v3_req]
subjectAltName = @alt_names

[alt_names]
IP.1 = $serverIP
IP.2 = 127.0.0.1
DNS.1 = localhost
"@
		$confPath = Join-Path $certsPath "openssl.cnf"
		$opensslConf | Out-File -FilePath $confPath -Encoding ASCII
		
		$keyPath = Join-Path $certsPath "key.pem"
		$certPath = Join-Path $certsPath "cert.pem"
		
		try {
			$opensslArgs = @(
				"req", "-x509", "-nodes", "-days", "365", "-newkey", "rsa:2048",
				"-keyout", $keyPath,
				"-out", $certPath,
				"-config", $confPath
			)
			
			$processInfo = New-Object System.Diagnostics.ProcessStartInfo
			$processInfo.FileName = $opensslPath
			$processInfo.Arguments = $opensslArgs -join " "
			$processInfo.RedirectStandardOutput = $true
			$processInfo.RedirectStandardError = $true
			$processInfo.UseShellExecute = $false
			$processInfo.CreateNoWindow = $true
			
			$process = New-Object System.Diagnostics.Process
			$process.StartInfo = $processInfo
			$process.Start() | Out-Null
			$process.WaitForExit()
			
			if (Test-Path $certPath) {
				Write-Success "SSL certificate generated"
			} else {
				Write-Warning "Certificate generation may have failed. Check nginx/certs folder."
			}
		} catch {
			Write-Warning "Failed to generate certificate: $_"
		}
		
		# Clean up config
		Remove-Item $confPath -ErrorAction SilentlyContinue
	} else {
		Write-Warning "OpenSSL not found."
		Write-Info "Install Git for Windows to get OpenSSL, or generate cert manually."
		Write-Info "You can also generate it inside Docker - instructions will be shown."
	}
}

# Update nginx.conf for HTTPS if needed
if ($enableHTTPS) {
	Write-Step 3 "Enabling HTTPS in nginx configuration..."
	
	$nginxConf = @'
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

    # HTTP - redirect to HTTPS
    server {
        listen 80;
        server_name _;
        
        # For local testing, serve on HTTP too
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
'@
	
	$nginxPath = Join-Path $scriptDir "nginx\nginx.conf"
	$nginxConf | Out-File -FilePath $nginxPath -Encoding UTF8
	Write-Success "nginx.conf updated for HTTPS"
} else {
	Write-Step 3 "Keeping HTTP-only configuration"
}

# ============================================================
# Step 6: Summary and Next Steps
# ============================================================
Write-Header "Setup Complete!"

Write-Host "Your configuration has been saved. Here is a summary:" -ForegroundColor White
Write-Host ""

Write-Host "+-------------------------------------------------------------+" -ForegroundColor DarkGray
Write-Host "| Configuration Summary                                       |" -ForegroundColor White
Write-Host "+-------------------------------------------------------------+" -ForegroundColor DarkGray
Write-Host "| Server IP:      " -ForegroundColor Gray -NoNewline
Write-Host ("{0,-42}" -f $serverIP) -ForegroundColor Green -NoNewline
Write-Host "|" -ForegroundColor DarkGray
Write-Host "| Special Code:   " -ForegroundColor Gray -NoNewline
Write-Host ("{0,-42}" -f $specialCode) -ForegroundColor Green -NoNewline
Write-Host "|" -ForegroundColor DarkGray
Write-Host "| TURN Username:  " -ForegroundColor Gray -NoNewline
Write-Host ("{0,-42}" -f $turnUser) -ForegroundColor Green -NoNewline
Write-Host "|" -ForegroundColor DarkGray
Write-Host "| TURN Password:  " -ForegroundColor Gray -NoNewline
Write-Host ("{0,-42}" -f $turnPass) -ForegroundColor Green -NoNewline
Write-Host "|" -ForegroundColor DarkGray
Write-Host "| HTTPS:          " -ForegroundColor Gray -NoNewline
$httpsStatus = if ($enableHTTPS) { "Enabled (self-signed)" } else { "Disabled" }
Write-Host ("{0,-42}" -f $httpsStatus) -ForegroundColor Green -NoNewline
Write-Host "|" -ForegroundColor DarkGray
Write-Host "+-------------------------------------------------------------+" -ForegroundColor DarkGray

Write-Host ""
Write-Header "Next Steps"

Write-Step 1 "Start VideoKall with Docker:"
Write-Host ""
Write-Host "   docker-compose up -d" -ForegroundColor Cyan
Write-Host ""

Write-Step 2 "Access the application:"
Write-Host ""
if ($enableHTTPS) {
	Write-Host "   HTTPS: " -ForegroundColor Gray -NoNewline
	Write-Host "https://$serverIP" -ForegroundColor Green
	Write-Host "   HTTP:  " -ForegroundColor Gray -NoNewline
	Write-Host "http://$serverIP" -ForegroundColor Yellow
	Write-Host ""
	if ($useSelfsigned) {
		Write-Warning "Your browser will show a security warning for self-signed certificate."
		Write-Info "Click Advanced -> Proceed to $serverIP (unsafe) to continue."
	}
} else {
	Write-Host "   http://$serverIP" -ForegroundColor Green
}
Write-Host ""

Write-Step 3 "Create a call:"
Write-Host ""
Write-Host "   - Enter the special code: " -ForegroundColor Gray -NoNewline
Write-Host $specialCode -ForegroundColor Cyan
Write-Host "   - Click Create Room" -ForegroundColor Gray
Write-Host "   - Share the generated code with your family member" -ForegroundColor Gray
Write-Host ""

if (-not $isLocal) {
	Write-Header "Firewall Configuration"
	Write-Host "Make sure these ports are open on your VPS/firewall:" -ForegroundColor Yellow
	Write-Host ""
	Write-Host "   Port 80     TCP      - HTTP web interface" -ForegroundColor Gray
	Write-Host "   Port 443    TCP      - HTTPS web interface" -ForegroundColor Gray
	Write-Host "   Port 3478   TCP+UDP  - TURN/STUN server" -ForegroundColor Gray
	Write-Host "   Port 5349   TCP+UDP  - TURN/STUN over TLS" -ForegroundColor Gray
	Write-Host "   Ports 49152-49200 UDP - TURN relay ports" -ForegroundColor Gray
	Write-Host ""
}

Write-Header "Useful Commands"
Write-Host ""
Write-Host "   View logs:          " -ForegroundColor Gray -NoNewline
Write-Host "docker-compose logs -f" -ForegroundColor Cyan
Write-Host "   Stop services:      " -ForegroundColor Gray -NoNewline
Write-Host "docker-compose down" -ForegroundColor Cyan
Write-Host "   Restart services:   " -ForegroundColor Gray -NoNewline
Write-Host "docker-compose restart" -ForegroundColor Cyan
Write-Host "   Check status:       " -ForegroundColor Gray -NoNewline
Write-Host "docker-compose ps" -ForegroundColor Cyan
Write-Host ""

# Save credentials to a file for reference
$credentialsFile = @"
VideoKall Credentials
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
===============================================================

Server IP:      $serverIP
Special Code:   $specialCode

TURN Username:  $turnUser
TURN Password:  $turnPass

Access URLs:
  HTTP:  http://$serverIP
  HTTPS: https://$serverIP

WARNING: KEEP THIS FILE SECURE - It contains sensitive credentials!
"@

$credPath = Join-Path $scriptDir "CREDENTIALS.txt"
$credentialsFile | Out-File -FilePath $credPath -Encoding UTF8
Write-Success "Credentials saved to CREDENTIALS.txt (keep this file secure!)"
Write-Host ""

Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  Setup complete! Run docker-compose up -d to start.                 " -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
