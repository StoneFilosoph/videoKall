// VideoKall - WebRTC Video Calling Application

class VideoKall {
	constructor() {
		this.ws = null;
		this.localStream = null;
		this.roomId = null;
		this.roomName = null;
		this.participantId = null;
		this.isHost = false;
		this.iceServers = [];
		this.isAudioEnabled = true;
		this.isVideoEnabled = true;
		this.facingMode = 'user';
		this.adminCode = null;
		
		// Camera devices
		this.availableCameras = [];
		this.currentCameraId = null;
		this.frontCameraId = null;
		this.backCameraId = null;
		
		// Peer connections for each participant (mesh topology)
		// Map<participantId, { pc: RTCPeerConnection, stream: MediaStream }>
		this.peers = new Map();
		
		// Queue for ICE candidates that arrive before remote description is set
		this.pendingIceCandidates = new Map(); // participantId -> [candidates]
		
		this.init();
	}
	
	init() {
		this.screens = {
			entry: document.getElementById('entry-screen'),
			admin: document.getElementById('admin-screen'),
			joining: document.getElementById('joining-screen'),
			call: document.getElementById('call-screen'),
			ended: document.getElementById('ended-screen')
		};
		
		this.elements = {
			adminCode: document.getElementById('admin-code'),
			adminLoginBtn: document.getElementById('admin-login-btn'),
			adminLogoutBtn: document.getElementById('admin-logout-btn'),
			newRoomName: document.getElementById('new-room-name'),
			createRoomBtn: document.getElementById('create-room-btn'),
			roomsList: document.getElementById('rooms-list'),
			noRooms: document.getElementById('no-rooms'),
			joiningRoomName: document.getElementById('joining-room-name'),
			cancelJoinBtn: document.getElementById('cancel-join-btn'),
			videosGrid: document.getElementById('videos-grid'),
			localVideo: document.getElementById('local-video'),
			connectionStatus: document.getElementById('connection-status'),
			cameraDebugInfo: document.getElementById('camera-debug-info'),
			toggleAudioBtn: document.getElementById('toggle-audio-btn'),
			toggleVideoBtn: document.getElementById('toggle-video-btn'),
			switchCameraBtn: document.getElementById('switch-camera-btn'),
			leaveCallBtn: document.getElementById('leave-call-btn'),
			endedTitle: document.getElementById('ended-title'),
			endedReason: document.getElementById('ended-reason'),
			rejoinBtn: document.getElementById('rejoin-btn'),
			backHomeBtn: document.getElementById('back-home-btn'),
			errorMessage: document.getElementById('error-message'),
			langToggle: document.getElementById('lang-toggle'),
			langDropdown: document.getElementById('lang-dropdown'),
			currentLang: document.getElementById('current-lang')
		};
		
		// Initialize i18n
		window.i18n.init();
		this.updateLangDisplay();
		
		this.bindEvents();
		this.checkJoinLink();
	}
	
	bindEvents() {
		// Entry screen
		this.elements.adminLoginBtn.addEventListener('click', () => this.adminLogin());
		this.elements.adminCode.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') this.adminLogin();
		});
		
		// Admin screen
		this.elements.adminLogoutBtn.addEventListener('click', () => this.adminLogout());
		this.elements.createRoomBtn.addEventListener('click', () => this.createRoom());
		this.elements.newRoomName.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') this.createRoom();
		});
		
		// Joining screen
		this.elements.cancelJoinBtn.addEventListener('click', () => this.cancelJoin());
		
		// Call controls
		this.elements.toggleAudioBtn.addEventListener('click', () => this.toggleAudio());
		this.elements.toggleVideoBtn.addEventListener('click', () => this.toggleVideo());
		this.elements.switchCameraBtn.addEventListener('click', () => this.switchCamera());
		this.elements.leaveCallBtn.addEventListener('click', () => this.leaveCall());
		
		// Show switch camera button only on mobile
		if (this.isMobileDevice()) {
			this.elements.switchCameraBtn.classList.remove('hidden');
		}
		
		// Ended screen
		this.elements.rejoinBtn.addEventListener('click', () => this.rejoinCall());
		this.elements.backHomeBtn.addEventListener('click', () => this.backToHome());
		
		// Language switcher
		this.elements.langToggle.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.elements.langDropdown.classList.toggle('hidden');
		});
		
		// Prevent dropdown from closing when clicking inside it
		this.elements.langDropdown.addEventListener('click', (e) => {
			e.stopPropagation();
		});
		
		document.querySelectorAll('.lang-option').forEach(btn => {
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				const lang = e.currentTarget.getAttribute('data-lang');
				window.i18n.setLocale(lang);
				this.updateLangDisplay();
				this.elements.langDropdown.classList.add('hidden');
				// Re-render rooms if on admin screen
				if (this.screens.admin.classList.contains('active')) {
					this.loadRooms();
				}
			});
		});
		
		// Close language dropdown when clicking outside
		document.addEventListener('click', (e) => {
			const switcher = document.querySelector('.language-switcher');
			if (switcher && !switcher.contains(e.target)) {
				this.elements.langDropdown.classList.add('hidden');
			}
		});
		
		// Make local video draggable
		this.makeVideoDraggable();
	}
	
	updateLangDisplay() {
		const locale = window.i18n.getLocale();
		this.elements.currentLang.textContent = locale.toUpperCase();
		
		// Update active state in dropdown
		document.querySelectorAll('.lang-option').forEach(btn => {
			const isActive = btn.getAttribute('data-lang') === locale;
			btn.classList.toggle('active', isActive);
		});
	}
	
	showScreen(screenName) {
		Object.values(this.screens).forEach(screen => {
			screen.classList.remove('active');
		});
		this.screens[screenName].classList.add('active');
	}
	
	showError(message) {
		this.elements.errorMessage.textContent = message;
		this.elements.errorMessage.classList.add('visible');
		setTimeout(() => {
			this.elements.errorMessage.classList.remove('visible');
		}, 5000);
	}
	
	// Check if joining via direct link
	checkJoinLink() {
		const urlParams = new URLSearchParams(window.location.search);
		const joinRoomId = urlParams.get('join');
		
		if (joinRoomId) {
			const roomIdRegex = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;
			if (roomIdRegex.test(joinRoomId.toLowerCase())) {
				// Clean URL
				const cleanUrl = window.location.origin + window.location.pathname;
				window.history.replaceState({}, document.title, cleanUrl);
				
				// Direct join
				this.directJoin(joinRoomId.toLowerCase());
			}
		}
	}
	
	async directJoin(roomId) {
		this.roomId = roomId;
		this.showScreen('joining');
		this.elements.joiningRoomName.textContent = window.i18n.t('call.connecting');
		
		try {
			// Check if room exists
			const response = await fetch(`/api/room/${roomId}`);
			const data = await response.json();
			
			if (!data.exists) {
				this.showScreen('entry');
				this.showError(window.i18n.t('error.roomNotFound'));
				return;
			}
			
			this.roomName = data.name;
			this.elements.joiningRoomName.textContent = data.name;
			
			// Start media and join
			await this.startCall();
		} catch (error) {
			console.error('Failed to join:', error);
			this.showScreen('entry');
			this.showError(window.i18n.t('error.joinFailed'));
		}
	}
	
	// Admin functions
	async adminLogin() {
		const code = this.elements.adminCode.value.trim();
		if (!code) {
			this.showError(window.i18n.t('error.enterCode'));
			return;
		}
		
		try {
			// Verify code by making an API call
			const response = await fetch('/api/admin/rooms', {
				headers: { 'X-Admin-Code': code }
			});
			
			if (response.status === 401) {
				this.showError(window.i18n.t('error.invalidCode'));
				return;
			}
			
			this.adminCode = code;
			this.showScreen('admin');
			this.loadRooms();
		} catch (error) {
			this.showError(window.i18n.t('error.connectionFailed'));
		}
	}
	
	adminLogout() {
		this.adminCode = null;
		this.elements.adminCode.value = '';
		this.showScreen('entry');
	}
	
	async loadRooms() {
		try {
			const response = await fetch('/api/admin/rooms', {
				headers: { 'X-Admin-Code': this.adminCode }
			});
			
			if (!response.ok) throw new Error('Failed to load rooms');
			
			const data = await response.json();
			this.renderRooms(data.rooms);
		} catch (error) {
			console.error('Failed to load rooms:', error);
			this.elements.roomsList.innerHTML = `<div class="error-rooms">${window.i18n.t('admin.failedLoadRooms')}</div>`;
		}
	}
	
	renderRooms(rooms) {
		if (rooms.length === 0) {
			this.elements.roomsList.innerHTML = '';
			this.elements.noRooms.classList.remove('hidden');
			return;
		}
		
		this.elements.noRooms.classList.add('hidden');
		
		const inCallText = window.i18n.t('admin.inCall');
		const joinText = window.i18n.t('admin.joinButton');
		const copyLinkTitle = window.i18n.t('admin.copyLink');
		const deleteTitle = window.i18n.t('admin.deleteRoom');
		
		const html = rooms.map(room => `
			<div class="room-card" data-room-id="${room.id}">
				<div class="room-info">
					<h3>${this.escapeHtml(room.name)}</h3>
					<div class="room-meta">
						<span class="room-id">${room.id}</span>
						<span class="room-participants">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
								<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
								<circle cx="9" cy="7" r="4"/>
								<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
								<path d="M16 3.13a4 4 0 0 1 0 7.75"/>
							</svg>
							${room.participantCount} ${inCallText}
						</span>
					</div>
				</div>
				<div class="room-actions">
					<button class="btn icon" onclick="videoKall.copyRoomLink('${room.id}')" title="${copyLinkTitle}">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
							<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
						</svg>
					</button>
					<button class="btn secondary small" onclick="videoKall.joinRoomAsAdmin('${room.id}')">${joinText}</button>
					<button class="btn danger-outline small" onclick="videoKall.deleteRoom('${room.id}')" title="${deleteTitle}">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
							<polyline points="3 6 5 6 21 6"/>
							<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
						</svg>
					</button>
				</div>
			</div>
		`).join('');
		
		this.elements.roomsList.innerHTML = html;
	}
	
	escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}
	
	async createRoom() {
		const name = this.elements.newRoomName.value.trim() || window.i18n.t('admin.defaultRoomName');
		
		try {
			const response = await fetch('/api/admin/rooms', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Admin-Code': this.adminCode
				},
				body: JSON.stringify({ name })
			});
			
			if (!response.ok) throw new Error('Failed to create room');
			
			this.elements.newRoomName.value = '';
			this.loadRooms();
		} catch (error) {
			console.error('Failed to create room:', error);
			this.showError(window.i18n.t('admin.failedCreateRoom'));
		}
	}
	
	async deleteRoom(roomId) {
		if (!confirm(window.i18n.t('admin.deleteConfirm'))) {
			return;
		}
		
		try {
			const response = await fetch(`/api/admin/rooms/${roomId}`, {
				method: 'DELETE',
				headers: { 'X-Admin-Code': this.adminCode }
			});
			
			if (!response.ok) throw new Error('Failed to delete room');
			
			this.loadRooms();
		} catch (error) {
			console.error('Failed to delete room:', error);
			this.showError(window.i18n.t('admin.failedDeleteRoom'));
		}
	}
	
	copyRoomLink(roomId) {
		const link = `${window.location.origin}${window.location.pathname}?join=${roomId}`;
		
		navigator.clipboard.writeText(link).then(() => {
			// Find the button and show feedback
			const card = document.querySelector(`[data-room-id="${roomId}"]`);
			if (card) {
				const btn = card.querySelector('.btn.icon');
				btn.classList.add('copied');
				setTimeout(() => btn.classList.remove('copied'), 2000);
			}
		}).catch(err => {
			console.error('Failed to copy:', err);
			// Fallback
			const textArea = document.createElement('textarea');
			textArea.value = link;
			textArea.style.position = 'fixed';
			textArea.style.left = '-9999px';
			document.body.appendChild(textArea);
			textArea.select();
			try {
				document.execCommand('copy');
			} catch (e) {}
			document.body.removeChild(textArea);
		});
	}
	
	joinRoomAsAdmin(roomId) {
		this.directJoin(roomId);
	}
	
	cancelJoin() {
		this.cleanup();
		if (this.adminCode) {
			this.showScreen('admin');
		} else {
			this.showScreen('entry');
		}
	}
	
	// WebSocket connection
	connectWebSocket() {
		return new Promise((resolve, reject) => {
			if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
				this.ws.close();
				this.ws = null;
			}
			
			const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
			const wsUrl = `${protocol}//${window.location.host}/ws`;
			
			this.ws = new WebSocket(wsUrl);
			
			this.ws.onopen = () => {
				console.log('WebSocket connected');
				resolve();
			};
			
			this.ws.onerror = (error) => {
				console.error('WebSocket error:', error);
				reject(new Error('Failed to connect to server'));
			};
			
			this.ws.onclose = () => {
				console.log('WebSocket disconnected');
			};
			
			this.ws.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data);
					this.handleMessage(message);
				} catch (e) {
					console.error('Failed to parse WebSocket message:', e);
				}
			};
		});
	}
	
	handleMessage(message) {
		console.log('Received:', message.type);
		
		switch (message.type) {
			case 'room-joined':
				this.onRoomJoined(message);
				break;
			case 'participant-joined':
				this.onParticipantJoined(message.participantId);
				break;
			case 'participant-left':
				this.onParticipantLeft(message.participantId);
				break;
			case 'offer':
				this.onOffer(message.data, message.fromId);
				break;
			case 'answer':
				this.onAnswer(message.data, message.fromId);
				break;
			case 'ice-candidate':
				this.onIceCandidate(message.data, message.fromId);
				break;
			case 'you-are-host':
				this.onBecameHost();
				break;
			case 'new-host':
				this.onNewHost(message.hostId);
				break;
			case 'room-deleted':
				this.onRoomDeleted();
				break;
			case 'error':
				this.showError(message.message);
				break;
		}
	}
	
	async startCall() {
		try {
			// Ensure debug element exists
			if (!this.elements.cameraDebugInfo) {
				this.elements.cameraDebugInfo = document.getElementById('camera-debug-info');
			}
			// Create debug element if it doesn't exist in DOM
			if (!this.elements.cameraDebugInfo) {
				const debugDiv = document.createElement('div');
				debugDiv.id = 'camera-debug-info';
				debugDiv.className = 'camera-debug-info';
				document.body.appendChild(debugDiv);
				this.elements.cameraDebugInfo = debugDiv;
			}
			
			// Show initial debug message
			this.elements.cameraDebugInfo.textContent = 'CAMERA DEBUG\nInitializing cameras...';
			
			await this.setupMedia();
			this.showScreen('call');
			
			await this.connectWebSocket();
			
			// Join the room
			this.ws.send(JSON.stringify({
				type: 'join-room',
				roomId: this.roomId
			}));
		} catch (error) {
			console.error('Failed to start call:', error);
			this.cleanup();
			this.showScreen('entry');
			this.showError(window.i18n.t('error.mediaFailed'));
		}
	}
	
	async enumerateCameras() {
		try {
			// Update debug display
			if (this.elements.cameraDebugInfo) {
				this.elements.cameraDebugInfo.textContent = 'CAMERA DEBUG\nRequesting camera permission...';
			}
			
			// First request permission if needed
			const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
			tempStream.getTracks().forEach(track => track.stop());
			
			if (this.elements.cameraDebugInfo) {
				this.elements.cameraDebugInfo.textContent = 'CAMERA DEBUG\nEnumerating devices...';
			}
			
			const devices = await navigator.mediaDevices.enumerateDevices();
			const videoDevices = devices.filter(device => device.kind === 'videoinput');
			
			// Extract camera number from label (e.g., "camera 0, facing back" -> 0)
			const getCameraNumber = (label) => {
				const match = label.match(/camera\s*(\d+)/i);
				return match ? parseInt(match[1], 10) : 999; // 999 = unknown, will be sorted last
			};
			
			// Store cameras with their original index and parsed camera number
			this.availableCameras = videoDevices.map((device, index) => ({
				...device,
				deviceId: device.deviceId,
				label: device.label,
				originalIndex: index,
				cameraNumber: getCameraNumber(device.label)
			}));
			
			// Helper to check if camera is front-facing
			const isFrontCamera = (label) => {
				const labelLower = label.toLowerCase();
				return labelLower.includes('front') || labelLower.includes('user') || labelLower.includes('selfie');
			};
			
			// Helper to check if camera is back-facing
			const isBackCamera = (label) => {
				const labelLower = label.toLowerCase();
				return labelLower.includes('back') || labelLower.includes('environment') || labelLower.includes('rear');
			};
			
			// Filter out ultrawide, telephoto, macro cameras (we want 1x primary camera)
			const isPrimaryCamera = (label) => {
				const labelLower = label.toLowerCase();
				// Exclude ultrawide, telephoto, macro, depth cameras
				return !labelLower.includes('ultrawide') && 
				       !labelLower.includes('wide') &&
				       !labelLower.includes('telephoto') && 
				       !labelLower.includes('macro') && 
				       !labelLower.includes('depth') &&
				       !labelLower.includes('tof') &&
				       !labelLower.includes('2x') &&
				       !labelLower.includes('3x') &&
				       !labelLower.includes('5x') &&
				       !labelLower.includes('10x') &&
				       !labelLower.includes('0.5x') &&
				       !labelLower.includes('0.6x');
			};
			
			// Find front cameras, sorted by camera number in label (camera 0 preferred over camera 1)
			const frontCameras = this.availableCameras
				.filter(cam => isFrontCamera(cam.label))
				.sort((a, b) => a.cameraNumber - b.cameraNumber);
			
			// Find back cameras, sorted by camera number in label (camera 0 preferred over camera 3)
			const backCameras = this.availableCameras
				.filter(cam => isBackCamera(cam.label))
				.sort((a, b) => a.cameraNumber - b.cameraNumber);
			
			// Select front camera: prefer primary (1x) with lowest camera number
			const primaryFrontCameras = frontCameras.filter(cam => isPrimaryCamera(cam.label));
			if (primaryFrontCameras.length > 0) {
				// Pick the one with lowest camera number
				this.frontCameraId = primaryFrontCameras[0].deviceId;
			} else if (frontCameras.length > 0) {
				// Fallback: pick first front camera (lowest camera number)
				this.frontCameraId = frontCameras[0].deviceId;
			} else {
				this.frontCameraId = null;
			}
			
			// Select back camera: prefer primary (1x) with lowest camera number
			const primaryBackCameras = backCameras.filter(cam => isPrimaryCamera(cam.label));
			if (primaryBackCameras.length > 0) {
				// Pick the one with lowest camera number
				this.backCameraId = primaryBackCameras[0].deviceId;
			} else if (backCameras.length > 0) {
				// Fallback: pick first back camera (lowest camera number)
				this.backCameraId = backCameras[0].deviceId;
			} else {
				this.backCameraId = null;
			}
			
			// If we can't identify by label, try to determine by facingMode constraint
			if (!this.frontCameraId && !this.backCameraId && videoDevices.length > 0) {
				try {
					const frontTest = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
					const frontTrack = frontTest.getVideoTracks()[0];
					if (frontTrack) {
						const settings = frontTrack.getSettings();
						if (settings.deviceId) {
							this.frontCameraId = settings.deviceId;
						}
						frontTrack.stop();
					}
				} catch (e) {
					console.log('Could not test front camera');
				}
				
				try {
					const backTest = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
					const backTrack = backTest.getVideoTracks()[0];
					if (backTrack) {
						const settings = backTrack.getSettings();
						if (settings.deviceId) {
							this.backCameraId = settings.deviceId;
						}
						backTrack.stop();
					}
				} catch (e) {
					console.log('Could not test back camera');
				}
			}
			
			// Set default camera based on facingMode
			if (this.facingMode === 'user' && this.frontCameraId) {
				this.currentCameraId = this.frontCameraId;
			} else if (this.facingMode === 'environment' && this.backCameraId) {
				this.currentCameraId = this.backCameraId;
			} else {
				// Fallback to first available camera
				this.currentCameraId = videoDevices.length > 0 ? videoDevices[0].deviceId : null;
			}
			
			console.log('Available cameras:', videoDevices.map(d => ({ id: d.deviceId, label: d.label })));
			console.log('Selected front camera (1x):', this.frontCameraId);
			console.log('Selected back camera (1x):', this.backCameraId);
			console.log('Current camera:', this.currentCameraId);
			
			// Update debug display
			this.updateCameraDebugInfo();
			
		} catch (error) {
			console.error('Failed to enumerate cameras:', error);
			// Fallback: cameras will be enumerated on first getUserMedia call
			this.updateCameraDebugInfo('Error: ' + error.message);
		}
	}
	
	updateCameraDebugInfo(errorMessage = null) {
		const debugEl = this.elements.cameraDebugInfo;
		if (!debugEl) return;
		
		if (errorMessage) {
			debugEl.textContent = `CAMERA DEBUG\nError: ${errorMessage}`;
			return;
		}
		
		let debugText = 'CAMERA DEBUG\n';
		debugText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
		debugText += `Total cameras: ${this.availableCameras.length}\n\n`;
		
		if (this.availableCameras.length > 0) {
			debugText += `All cameras:\n`;
			debugText += `(idx=enum order, cam#=label number)\n`;
			this.availableCameras.forEach((cam) => {
				const idx = cam.originalIndex !== undefined ? cam.originalIndex : '?';
				const camNum = cam.cameraNumber !== undefined ? cam.cameraNumber : '?';
				const isFront = cam.deviceId === this.frontCameraId;
				const isBack = cam.deviceId === this.backCameraId;
				const isCurrent = cam.deviceId === this.currentCameraId;
				let markers = '';
				if (isFront) markers += ' ★FRONT';
				if (isBack) markers += ' ★BACK';
				if (isCurrent) markers += ' ◄NOW';
				
				debugText += `idx${idx} cam#${camNum}: ${cam.label || 'Unlabeled'}${markers}\n`;
			});
			debugText += '\n';
		} else {
			debugText += `No cameras detected\n\n`;
		}
		
		// Find selected cameras info
		const frontCam = this.availableCameras.find(c => c.deviceId === this.frontCameraId);
		const backCam = this.availableCameras.find(c => c.deviceId === this.backCameraId);
		const currentCam = this.availableCameras.find(c => c.deviceId === this.currentCameraId);
		
		debugText += `SELECTED (by cam#):\n`;
		debugText += `Front: ${frontCam ? `cam#${frontCam.cameraNumber} ${frontCam.label}` : 'NONE'}\n`;
		debugText += `Back: ${backCam ? `cam#${backCam.cameraNumber} ${backCam.label}` : 'NONE'}\n`;
		debugText += `Active: ${currentCam ? `cam#${currentCam.cameraNumber} ${currentCam.label}` : 'NONE'}\n`;
		debugText += `Mode: ${this.facingMode}\n`;
		
		debugEl.textContent = debugText;
	}
	
	async setupMedia() {
		try {
			// Enumerate cameras first if not already done
			if (this.availableCameras.length === 0) {
				await this.enumerateCameras();
			}
			
			// Build video constraints - prefer deviceId if available, fallback to facingMode
			const videoConstraints = {
				width: { ideal: 1280 },
				height: { ideal: 720 }
			};
			
			if (this.currentCameraId) {
				videoConstraints.deviceId = { exact: this.currentCameraId };
			} else {
				// Fallback to facingMode if deviceId not available
				videoConstraints.facingMode = this.facingMode;
			}
			
			this.localStream = await navigator.mediaDevices.getUserMedia({
				video: videoConstraints,
				audio: {
					echoCancellation: true,
					noiseSuppression: true
				}
			});
			
			// Update currentCameraId from actual stream
			const videoTrack = this.localStream.getVideoTracks()[0];
			if (videoTrack) {
				const settings = videoTrack.getSettings();
				if (settings.deviceId) {
					this.currentCameraId = settings.deviceId;
				}
			}
			
			// Update debug display with actual camera used
			this.updateCameraDebugInfo();
			
			this.elements.localVideo.srcObject = this.localStream;
		} catch (error) {
			console.error('Failed to get media devices:', error);
			throw error;
		}
	}
	
	onRoomJoined(message) {
		this.participantId = message.participantId;
		this.isHost = message.isHost;
		this.iceServers = message.iceServers;
		this.roomName = message.roomName;
		
		console.log(`Joined room as ${this.isHost ? 'host' : 'participant'}, ID: ${this.participantId}`);
		
		this.updateConnectionStatus('connected');
		
		// Connect to existing participants
		for (const peerId of message.existingParticipants) {
			this.createPeerConnection(peerId, true);
		}
	}
	
	onParticipantJoined(participantId) {
		console.log(`Participant joined: ${participantId}`);
		// Wait for them to send us an offer
	}
	
	onParticipantLeft(participantId) {
		console.log(`Participant left: ${participantId}`);
		this.removePeer(participantId);
	}
	
	onBecameHost() {
		this.isHost = true;
		console.log('You are now the host');
		this.updateConnectionStatus(window.i18n.t('call.youAreHost'));
		setTimeout(() => this.updateConnectionStatus('connected'), 3000);
	}
	
	onNewHost(hostId) {
		console.log(`New host: ${hostId}`);
	}
	
	onRoomDeleted() {
		this.cleanup();
		this.elements.endedTitle.textContent = window.i18n.t('ended.roomDeleted');
		this.elements.endedReason.textContent = window.i18n.t('ended.roomDeletedByAdmin');
		this.elements.rejoinBtn.classList.add('hidden');
		this.showScreen('ended');
	}
	
	// Set AV1 as the preferred video codec
	setPreferredCodec(pc) {
		// Check if setCodecPreferences is supported
		const transceivers = pc.getTransceivers();
		
		for (const transceiver of transceivers) {
			if (transceiver.sender?.track?.kind === 'video') {
				const capabilities = RTCRtpSender.getCapabilities?.('video');
				if (!capabilities) {
					console.log('RTCRtpSender.getCapabilities not supported');
					return;
				}
				
				const codecs = capabilities.codecs;
				
				// Find AV1 codecs and move them to the front
				const av1Codecs = codecs.filter(c => 
					c.mimeType.toLowerCase() === 'video/av1'
				);
				const otherCodecs = codecs.filter(c => 
					c.mimeType.toLowerCase() !== 'video/av1'
				);
				
				if (av1Codecs.length > 0) {
					const preferredOrder = [...av1Codecs, ...otherCodecs];
					try {
						transceiver.setCodecPreferences(preferredOrder);
						console.log('AV1 codec preference set successfully');
					} catch (e) {
						console.warn('Failed to set AV1 codec preference:', e);
					}
				} else {
					console.log('AV1 codec not available in browser');
				}
			}
		}
	}
	
	createPeerConnection(peerId, initiator = false) {
		if (this.peers.has(peerId)) {
			console.log(`Peer connection already exists for ${peerId}`);
			return this.peers.get(peerId).pc;
		}
		
		console.log(`Creating peer connection for ${peerId}, initiator: ${initiator}`);
		
		const config = {
			iceServers: this.iceServers,
			iceCandidatePoolSize: 10
		};
		
		const pc = new RTCPeerConnection(config);
		
		// Add local tracks
		this.localStream.getTracks().forEach(track => {
			pc.addTrack(track, this.localStream);
		});
		
		// Set AV1 as preferred codec
		this.setPreferredCodec(pc);
		
		// Create video element for this peer
		const videoEl = document.createElement('video');
		videoEl.id = `video-${peerId}`;
		videoEl.autoplay = true;
		videoEl.playsinline = true;
		videoEl.classList.add('remote-video');
		this.elements.videosGrid.appendChild(videoEl);
		
		this.peers.set(peerId, {
			pc,
			videoEl,
			stream: null,
			isRemoteDescriptionSet: false
		});
		
		// Initialize pending ICE candidates queue
		this.pendingIceCandidates.set(peerId, []);
		
		// Handle remote tracks
		pc.ontrack = (event) => {
			console.log(`Remote track received from ${peerId}`);
			if (event.streams && event.streams[0]) {
				videoEl.srcObject = event.streams[0];
				const peer = this.peers.get(peerId);
				if (peer) peer.stream = event.streams[0];
			}
		};
		
		// Handle ICE candidates
		pc.onicecandidate = (event) => {
			if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.ws.send(JSON.stringify({
					type: 'ice-candidate',
					targetId: peerId,
					data: event.candidate
				}));
			}
		};
		
		// Monitor connection state
		pc.onconnectionstatechange = () => {
			console.log(`Connection state with ${peerId}:`, pc.connectionState);
			if (pc.connectionState === 'failed') {
				this.removePeer(peerId);
			}
		};
		
		// If we're the initiator, create and send offer
		if (initiator) {
			this.createAndSendOffer(peerId, pc);
		}
		
		return pc;
	}
	
	async createAndSendOffer(peerId, pc) {
		try {
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);
			
			this.ws.send(JSON.stringify({
				type: 'offer',
				targetId: peerId,
				data: offer
			}));
		} catch (error) {
			console.error(`Failed to create offer for ${peerId}:`, error);
		}
	}
	
	async onOffer(offer, fromId) {
		console.log(`Received offer from ${fromId}`);
		
		const pc = this.createPeerConnection(fromId, false);
		const peer = this.peers.get(fromId);
		
		try {
			await pc.setRemoteDescription(new RTCSessionDescription(offer));
			peer.isRemoteDescriptionSet = true;
			
			// Process pending ICE candidates
			await this.processPendingIceCandidates(fromId);
			
			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);
			
			this.ws.send(JSON.stringify({
				type: 'answer',
				targetId: fromId,
				data: answer
			}));
		} catch (error) {
			console.error(`Error handling offer from ${fromId}:`, error);
		}
	}
	
	async onAnswer(answer, fromId) {
		console.log(`Received answer from ${fromId}`);
		
		const peer = this.peers.get(fromId);
		if (!peer) return;
		
		try {
			await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
			peer.isRemoteDescriptionSet = true;
			
			// Process pending ICE candidates
			await this.processPendingIceCandidates(fromId);
		} catch (error) {
			console.error(`Error handling answer from ${fromId}:`, error);
		}
	}
	
	async onIceCandidate(candidate, fromId) {
		if (!candidate) return;
		
		const peer = this.peers.get(fromId);
		
		// If remote description isn't set yet, queue the candidate
		if (!peer || !peer.isRemoteDescriptionSet) {
			console.log(`Queuing ICE candidate from ${fromId}`);
			let queue = this.pendingIceCandidates.get(fromId);
			if (!queue) {
				queue = [];
				this.pendingIceCandidates.set(fromId, queue);
			}
			queue.push(candidate);
			return;
		}
		
		try {
			await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
		} catch (error) {
			console.error(`Error adding ICE candidate from ${fromId}:`, error);
		}
	}
	
	async processPendingIceCandidates(peerId) {
		const candidates = this.pendingIceCandidates.get(peerId);
		const peer = this.peers.get(peerId);
		
		if (!candidates || !peer) return;
		
		for (const candidate of candidates) {
			try {
				await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
				console.log(`Added pending ICE candidate for ${peerId}`);
			} catch (error) {
				console.error(`Error adding pending ICE candidate for ${peerId}:`, error);
			}
		}
		
		this.pendingIceCandidates.set(peerId, []);
	}
	
	removePeer(peerId) {
		const peer = this.peers.get(peerId);
		if (!peer) return;
		
		if (peer.pc) {
			peer.pc.close();
		}
		
		if (peer.videoEl && peer.videoEl.parentNode) {
			peer.videoEl.parentNode.removeChild(peer.videoEl);
		}
		
		this.peers.delete(peerId);
		this.pendingIceCandidates.delete(peerId);
	}
	
	updateConnectionStatus(state) {
		const status = this.elements.connectionStatus;
		
		if (state === 'connected') {
			status.textContent = window.i18n.t('call.connected');
			status.classList.add('connected');
			setTimeout(() => {
				status.classList.add('hidden');
			}, 2000);
		} else if (state === 'connecting') {
			status.textContent = window.i18n.t('call.connecting');
			status.classList.remove('connected', 'hidden');
		} else {
			status.textContent = state;
			status.classList.remove('hidden');
			status.classList.add('connected');
		}
	}
	
	toggleAudio() {
		this.isAudioEnabled = !this.isAudioEnabled;
		
		if (this.localStream) {
			this.localStream.getAudioTracks().forEach(track => {
				track.enabled = this.isAudioEnabled;
			});
		}
		
		const btn = this.elements.toggleAudioBtn;
		btn.classList.toggle('muted', !this.isAudioEnabled);
		btn.querySelector('.icon-mic-on').classList.toggle('hidden', !this.isAudioEnabled);
		btn.querySelector('.icon-mic-off').classList.toggle('hidden', this.isAudioEnabled);
	}
	
	toggleVideo() {
		this.isVideoEnabled = !this.isVideoEnabled;
		
		if (this.localStream) {
			this.localStream.getVideoTracks().forEach(track => {
				track.enabled = this.isVideoEnabled;
			});
		}
		
		const btn = this.elements.toggleVideoBtn;
		btn.classList.toggle('muted', !this.isVideoEnabled);
		btn.querySelector('.icon-video-on').classList.toggle('hidden', !this.isVideoEnabled);
		btn.querySelector('.icon-video-off').classList.toggle('hidden', this.isVideoEnabled);
	}
	
	isMobileDevice() {
		return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
			(navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
	}
	
	async switchCamera() {
		// Toggle between front and back camera
		let targetCameraId = null;
		
		if (this.currentCameraId === this.frontCameraId) {
			// Currently using front camera, switch to back
			this.facingMode = 'environment';
			targetCameraId = this.backCameraId;
		} else if (this.currentCameraId === this.backCameraId) {
			// Currently using back camera, switch to front
			this.facingMode = 'user';
			targetCameraId = this.frontCameraId;
		} else {
			// Unknown camera, try to toggle based on facingMode
			this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
			targetCameraId = this.facingMode === 'user' ? this.frontCameraId : this.backCameraId;
		}
		
		// If no deviceId available, fallback to facingMode
		if (!targetCameraId) {
			// Refresh camera enumeration if needed
			if (this.availableCameras.length === 0) {
				await this.enumerateCameras();
				targetCameraId = this.facingMode === 'user' ? this.frontCameraId : this.backCameraId;
			}
		}
		
		try {
			if (!this.localStream) {
				console.error('Cannot switch camera: no active stream');
				return;
			}
			
			// Stop old video track
			const oldVideoTrack = this.localStream.getVideoTracks()[0];
			if (oldVideoTrack) {
				oldVideoTrack.stop();
			}
			
			// Build video constraints
			const videoConstraints = {
				width: { ideal: 1280 },
				height: { ideal: 720 }
			};
			
			if (targetCameraId) {
				videoConstraints.deviceId = { exact: targetCameraId };
			} else {
				// Fallback to facingMode
				videoConstraints.facingMode = this.facingMode;
			}
			
			const newStream = await navigator.mediaDevices.getUserMedia({
				video: videoConstraints,
				audio: false
			});
			
			const newVideoTrack = newStream.getVideoTracks()[0];
			
			// Update currentCameraId from actual track
			const settings = newVideoTrack.getSettings();
			if (settings.deviceId) {
				this.currentCameraId = settings.deviceId;
			}
			
			// Replace the old track in the existing stream
			if (oldVideoTrack) {
				this.localStream.removeTrack(oldVideoTrack);
			}
			this.localStream.addTrack(newVideoTrack);
			
			this.elements.localVideo.srcObject = this.localStream;
			
			// Replace track in all peer connections
			for (const [, peer] of this.peers) {
				const sender = peer.pc.getSenders().find(s => s.track?.kind === 'video');
				if (sender) {
					await sender.replaceTrack(newVideoTrack);
				}
			}
			
			newVideoTrack.enabled = this.isVideoEnabled;
			
			// Update debug display
			this.updateCameraDebugInfo();
			
			console.log('Switched to camera:', this.currentCameraId, 'facingMode:', this.facingMode);
		} catch (error) {
			console.error('Failed to switch camera:', error);
			// Revert facingMode
			this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
			// Update debug display with error
			this.updateCameraDebugInfo('Switch failed: ' + error.message);
		}
	}
	
	leaveCall() {
		// Send leave message
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ type: 'leave-room' }));
		}
		
		this.cleanup();
		this.elements.endedTitle.textContent = window.i18n.t('ended.leftCall');
		this.elements.endedReason.textContent = window.i18n.t('ended.youLeft');
		this.elements.rejoinBtn.classList.remove('hidden');
		this.showScreen('ended');
	}
	
	rejoinCall() {
		if (this.roomId) {
			this.directJoin(this.roomId);
		}
	}
	
	backToHome() {
		this.roomId = null;
		this.roomName = null;
		
		if (this.adminCode) {
			this.showScreen('admin');
			this.loadRooms();
		} else {
			this.showScreen('entry');
		}
	}
	
	cleanup() {
		// Stop local media
		if (this.localStream) {
			this.localStream.getTracks().forEach(track => track.stop());
			this.localStream = null;
		}
		
		// Close all peer connections
		for (const [peerId] of this.peers) {
			this.removePeer(peerId);
		}
		this.peers.clear();
		this.pendingIceCandidates.clear();
		
		// Close WebSocket
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		
		// Clear videos grid
		this.elements.videosGrid.innerHTML = '';
		this.elements.localVideo.srcObject = null;
		
		// Reset state
		this.participantId = null;
		this.isHost = false;
		this.isAudioEnabled = true;
		this.isVideoEnabled = true;
		this.facingMode = 'user';
		this.currentCameraId = null;
		// Note: We keep availableCameras, frontCameraId, and backCameraId
		// as they don't need to be reset between calls
		
		// Reset UI
		this.elements.toggleAudioBtn.classList.remove('muted');
		this.elements.toggleAudioBtn.querySelector('.icon-mic-on').classList.remove('hidden');
		this.elements.toggleAudioBtn.querySelector('.icon-mic-off').classList.add('hidden');
		this.elements.toggleVideoBtn.classList.remove('muted');
		this.elements.toggleVideoBtn.querySelector('.icon-video-on').classList.remove('hidden');
		this.elements.toggleVideoBtn.querySelector('.icon-video-off').classList.add('hidden');
		this.elements.connectionStatus.classList.remove('connected', 'hidden');
		this.elements.connectionStatus.textContent = window.i18n.t('call.connecting');
		
		// Clear camera debug info
		if (this.elements.cameraDebugInfo) {
			this.elements.cameraDebugInfo.textContent = '';
		}
	}
	
	makeVideoDraggable() {
		const video = this.elements.localVideo;
		let isDragging = false;
		let startX, startY, startLeft, startBottom;
		
		const onDragStart = (clientX, clientY) => {
			isDragging = true;
			startX = clientX;
			startY = clientY;
			startLeft = video.offsetLeft;
			startBottom = window.innerHeight - video.offsetTop - video.offsetHeight;
			video.style.cursor = 'grabbing';
		};
		
		const onDragMove = (clientX, clientY) => {
			if (!isDragging) return;
			
			const deltaX = clientX - startX;
			const deltaY = clientY - startY;
			
			const newLeft = startLeft + deltaX;
			const newBottom = startBottom - deltaY;
			
			const maxLeft = window.innerWidth - video.offsetWidth - 24;
			const maxBottom = window.innerHeight - video.offsetHeight - 120;
			
			video.style.left = Math.max(24, Math.min(maxLeft, newLeft)) + 'px';
			video.style.right = 'auto';
			video.style.bottom = Math.max(120, Math.min(maxBottom, newBottom)) + 'px';
		};
		
		const onDragEnd = () => {
			isDragging = false;
			video.style.cursor = 'move';
		};
		
		video.addEventListener('mousedown', (e) => {
			onDragStart(e.clientX, e.clientY);
		});
		
		document.addEventListener('mousemove', (e) => {
			onDragMove(e.clientX, e.clientY);
		});
		
		document.addEventListener('mouseup', onDragEnd);
		
		video.addEventListener('touchstart', (e) => {
			if (e.touches.length === 1) {
				e.preventDefault();
				const touch = e.touches[0];
				onDragStart(touch.clientX, touch.clientY);
			}
		}, { passive: false });
		
		document.addEventListener('touchmove', (e) => {
			if (isDragging && e.touches.length === 1) {
				const touch = e.touches[0];
				onDragMove(touch.clientX, touch.clientY);
			}
		}, { passive: true });
		
		document.addEventListener('touchend', onDragEnd);
		document.addEventListener('touchcancel', onDragEnd);
	}
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
	window.videoKall = new VideoKall();
});
