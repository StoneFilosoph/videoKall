// VideoKall - WebRTC Video Calling Application

class VideoKall {
	constructor() {
		this.ws = null;
		this.pc = null;
		this.localStream = null;
		this.remoteStream = null;
		this.roomId = null;
		this.role = null; // 'host' or 'guest'
		this.iceServers = [];
		this.isAudioEnabled = true;
		this.isVideoEnabled = true;
		this.facingMode = 'user'; // 'user' = front, 'environment' = back
		this.codecPreference = 'av1'; // 'av1' or 'standard'
		
		// Queue for ICE candidates that arrive before remote description is set
		this.pendingIceCandidates = [];
		this.isRemoteDescriptionSet = false;
		
		// Queue for offer that arrives before media is ready (host side)
		this.pendingOffer = null;
		this.isMediaReady = false;
		
		this.init();
	}
	
	init() {
		// DOM Elements
		this.screens = {
			entry: document.getElementById('entry-screen'),
			waiting: document.getElementById('waiting-screen'),
			call: document.getElementById('call-screen'),
			ended: document.getElementById('ended-screen')
		};
		
		this.elements = {
			specialCode: document.getElementById('special-code'),
			roomAddress: document.getElementById('room-address'),
			codecOptions: document.querySelectorAll('input[name="codec"]'),
			createRoomBtn: document.getElementById('create-room-btn'),
			joinRoomBtn: document.getElementById('join-room-btn'),
			displayRoomCode: document.getElementById('display-room-code'),
			copyCodeBtn: document.getElementById('copy-code-btn'),
			copyHint: document.getElementById('copy-hint'),
			copyLinkBtn: document.getElementById('copy-link-btn'),
			linkHint: document.getElementById('link-hint'),
			cancelWaitingBtn: document.getElementById('cancel-waiting-btn'),
			localVideo: document.getElementById('local-video'),
			remoteVideo: document.getElementById('remote-video'),
			connectionStatus: document.getElementById('connection-status'),
			toggleAudioBtn: document.getElementById('toggle-audio-btn'),
			toggleVideoBtn: document.getElementById('toggle-video-btn'),
			switchCameraBtn: document.getElementById('switch-camera-btn'),
			hangUpBtn: document.getElementById('hang-up-btn'),
			backHomeBtn: document.getElementById('back-home-btn'),
			endedReason: document.getElementById('ended-reason'),
			errorMessage: document.getElementById('error-message')
		};
		
		this.bindEvents();
		this.formatRoomAddressInput();
		this.checkJoinLink();
	}
	
	bindEvents() {
		// Entry screen
		this.elements.createRoomBtn.addEventListener('click', () => this.createRoom());
		this.elements.joinRoomBtn.addEventListener('click', () => this.joinRoom());
		
		// Allow Enter key to submit
		this.elements.specialCode.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') this.createRoom();
		});
		this.elements.roomAddress.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') this.joinRoom();
		});
		
		// Waiting screen
		this.elements.copyCodeBtn.addEventListener('click', () => this.copyRoomCode());
		this.elements.copyLinkBtn.addEventListener('click', () => this.copyJoinLink());
		this.elements.cancelWaitingBtn.addEventListener('click', () => this.cancelWaiting());
		
		// Call controls
		this.elements.toggleAudioBtn.addEventListener('click', () => this.toggleAudio());
		this.elements.toggleVideoBtn.addEventListener('click', () => this.toggleVideo());
		this.elements.switchCameraBtn.addEventListener('click', () => this.switchCamera());
		this.elements.hangUpBtn.addEventListener('click', () => this.hangUp());
		
		// Show switch camera button only on mobile devices
		if (this.isMobileDevice()) {
			this.elements.switchCameraBtn.classList.remove('hidden');
		}
		
		// Ended screen
		this.elements.backHomeBtn.addEventListener('click', () => this.backToHome());
		
		// Make local video draggable
		this.makeVideoDraggable();
	}
	
	formatRoomAddressInput() {
		const input = this.elements.roomAddress;
		input.addEventListener('input', (e) => {
			let value = e.target.value.replace(/[^a-z0-9]/gi, '').toLowerCase();
			if (value.length > 4) {
				value = value.slice(0, 4) + '-' + value.slice(4);
			}
			if (value.length > 9) {
				value = value.slice(0, 9) + '-' + value.slice(9);
			}
			value = value.slice(0, 14);
			e.target.value = value;
		});
	}
	
	checkJoinLink() {
		// Check if there's a ?join= parameter in the URL
		const urlParams = new URLSearchParams(window.location.search);
		const joinRoomId = urlParams.get('join');
		
		if (joinRoomId) {
			// Validate format: xxxx-xxxx-xxxx
			const roomIdRegex = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;
			if (roomIdRegex.test(joinRoomId.toLowerCase())) {
				// Auto-fill the room address and trigger join
				this.elements.roomAddress.value = joinRoomId.toLowerCase();
				
				// Clean up the URL (remove the ?join= parameter)
				const cleanUrl = window.location.origin + window.location.pathname;
				window.history.replaceState({}, document.title, cleanUrl);
				
				// Auto-join after a brief delay to let the UI render
				setTimeout(() => this.joinRoom(), 100);
			}
		}
	}
	
	getJoinLink() {
		const baseUrl = window.location.origin + window.location.pathname;
		return `${baseUrl}?join=${this.roomId}`;
	}
	
	copyJoinLink() {
		const joinLink = this.getJoinLink();
		
		const copyText = (text) => {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				return navigator.clipboard.writeText(text);
			}
			
			return new Promise((resolve, reject) => {
				const textArea = document.createElement('textarea');
				textArea.value = text;
				textArea.style.position = 'fixed';
				textArea.style.left = '-9999px';
				document.body.appendChild(textArea);
				textArea.select();
				try {
					document.execCommand('copy');
					resolve();
				} catch (err) {
					reject(err);
				} finally {
					document.body.removeChild(textArea);
				}
			});
		};
		
		copyText(joinLink)
			.then(() => {
				this.elements.linkHint.textContent = 'Link copied!';
				this.elements.linkHint.classList.add('copied');
				setTimeout(() => {
					this.elements.linkHint.textContent = 'Anyone with this link can join directly';
					this.elements.linkHint.classList.remove('copied');
				}, 2000);
			})
			.catch((err) => {
				console.error('Failed to copy:', err);
				this.elements.linkHint.textContent = 'Copy failed';
				setTimeout(() => {
					this.elements.linkHint.textContent = 'Anyone with this link can join directly';
				}, 2000);
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
	
	connectWebSocket() {
		return new Promise((resolve, reject) => {
			// Close existing WebSocket if any
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
				// Notify user if disconnect happens during a call
				if (this.screens.call.classList.contains('active')) {
					this.onPeerDisconnected();
				}
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
			case 'room-created':
				this.onRoomCreated(message);
				break;
			case 'room-joined':
				this.onRoomJoined(message);
				break;
			case 'guest-joined':
				this.onGuestJoined();
				break;
			case 'offer':
				this.onOffer(message.data);
				break;
			case 'answer':
				this.onAnswer(message.data);
				break;
			case 'ice-candidate':
				this.onIceCandidate(message.data);
				break;
			case 'peer-disconnected':
				this.onPeerDisconnected();
				break;
			case 'error':
				this.showError(message.message);
				break;
		}
	}
	
	getSelectedCodec() {
		for (const option of this.elements.codecOptions) {
			if (option.checked) {
				return option.value;
			}
		}
		return 'av1'; // default
	}
	
	async createRoom() {
		const code = this.elements.specialCode.value.trim();
		if (!code) {
			this.showError('Please enter the special code');
			return;
		}
		
		// Get selected codec preference
		this.codecPreference = this.getSelectedCodec();
		
		try {
			await this.connectWebSocket();
			this.ws.send(JSON.stringify({
				type: 'create-room',
				code: code,
				codec: this.codecPreference
			}));
		} catch (error) {
			this.showError(error.message);
		}
	}
	
	async joinRoom() {
		const roomId = this.elements.roomAddress.value.trim().toLowerCase();
		
		// Validate format: xxxx-xxxx-xxxx (12 alphanumeric chars with 2 dashes)
		const roomIdRegex = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;
		if (!roomId || !roomIdRegex.test(roomId)) {
			this.showError('Please enter a valid calling address (format: xxxx-xxxx-xxxx)');
			return;
		}
		
		try {
			await this.connectWebSocket();
			this.ws.send(JSON.stringify({
				type: 'join-room',
				roomId: roomId
			}));
		} catch (error) {
			this.showError(error.message);
		}
	}
	
	onRoomCreated(message) {
		this.roomId = message.roomId;
		this.role = 'host';
		this.iceServers = message.iceServers;
		// Codec preference already set when creating room
		
		this.elements.displayRoomCode.textContent = this.roomId;
		this.showScreen('waiting');
	}
	
	async onRoomJoined(message) {
		this.roomId = message.roomId;
		this.role = 'guest';
		this.iceServers = message.iceServers;
		// Use codec preference set by host
		this.codecPreference = message.codec || 'standard';
		console.log('Using codec preference from host:', this.codecPreference);
		
		// Guest initiates the call
		try {
			await this.startCall();
		} catch (error) {
			console.error('Failed to start call:', error);
			this.cleanup();
			this.showScreen('entry');
		}
	}
	
	async onGuestJoined() {
		// Host receives notification that guest joined
		// Wait for the offer from guest
		try {
			await this.setupMedia();
			this.isMediaReady = true;
			this.showScreen('call');
			
			// Process any offer that arrived while we were setting up media
			if (this.pendingOffer) {
				await this.processOffer(this.pendingOffer);
				this.pendingOffer = null;
			}
		} catch (error) {
			console.error('Failed to setup media:', error);
			this.cleanup();
			this.showScreen('entry');
		}
	}
	
	async startCall() {
		await this.setupMedia();
		this.isMediaReady = true;
		this.showScreen('call');
		
		// Create peer connection
		this.createPeerConnection();
		
		try {
			// Create and send offer
			const offer = await this.pc.createOffer();
			await this.pc.setLocalDescription(offer);
			
			this.ws.send(JSON.stringify({
				type: 'offer',
				data: offer
			}));
		} catch (error) {
			console.error('Failed to create offer:', error);
			this.showError('Failed to start video call. Please try again.');
			throw error;
		}
	}
	
	async setupMedia() {
		try {
			this.localStream = await navigator.mediaDevices.getUserMedia({
				video: {
					width: { ideal: 1280 },
					height: { ideal: 720 },
					facingMode: this.facingMode
				},
				audio: {
					echoCancellation: true,
					noiseSuppression: true
				}
			});
			
			this.elements.localVideo.srcObject = this.localStream;
		} catch (error) {
			console.error('Failed to get media devices:', error);
			this.showError('Could not access camera/microphone. Please grant permissions.');
			throw error;
		}
	}
	
	createPeerConnection() {
		// Reset ICE candidate state
		this.pendingIceCandidates = [];
		this.isRemoteDescriptionSet = false;
		
		const config = {
			iceServers: this.iceServers,
			iceCandidatePoolSize: 10
		};
		
		this.pc = new RTCPeerConnection(config);
		
		// Add local tracks
		this.localStream.getTracks().forEach(track => {
			this.pc.addTrack(track, this.localStream);
		});
		
		// Apply codec preference
		this.applyCodecPreference();
		
		// Handle remote tracks
		this.pc.ontrack = (event) => {
			console.log('Remote track received');
			if (event.streams && event.streams[0]) {
				this.elements.remoteVideo.srcObject = event.streams[0];
				this.remoteStream = event.streams[0];
			}
		};
		
		// Handle ICE candidates
		this.pc.onicecandidate = (event) => {
			if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.ws.send(JSON.stringify({
					type: 'ice-candidate',
					data: event.candidate
				}));
			}
		};
		
		// Monitor connection state
		this.pc.onconnectionstatechange = () => {
			console.log('Connection state:', this.pc.connectionState);
			this.updateConnectionStatus(this.pc.connectionState);
			
			// Handle connection failures
			if (this.pc.connectionState === 'failed') {
				this.showError('Connection failed. Please check your network and try again.');
			}
		};
		
		this.pc.oniceconnectionstatechange = () => {
			console.log('ICE connection state:', this.pc.iceConnectionState);
			
			// Handle ICE failures
			if (this.pc.iceConnectionState === 'failed') {
				console.error('ICE connection failed');
				// Try to restart ICE
				this.pc.restartIce();
			}
		};
	}
	
	applyCodecPreference() {
		if (!this.pc) return;
		
		const transceivers = this.pc.getTransceivers();
		
		for (const transceiver of transceivers) {
			if (transceiver.sender.track?.kind === 'video') {
				try {
					// Get available codecs
					const capabilities = RTCRtpReceiver.getCapabilities?.('video');
					if (!capabilities || !capabilities.codecs) {
						console.log('Codec capabilities not available, using browser defaults');
						return;
					}
					
					const codecs = capabilities.codecs;
					let sortedCodecs;
					
					if (this.codecPreference === 'av1') {
						// Prefer AV1 > VP9 > VP8 > H.264
						sortedCodecs = this.sortCodecsByPreference(codecs, ['AV1', 'VP9', 'VP8', 'H264']);
						console.log('Applied AV1-preferred codec order');
					} else {
						// Standard: VP8 > H.264 > VP9 > AV1 (maximum compatibility)
						sortedCodecs = this.sortCodecsByPreference(codecs, ['VP8', 'H264', 'VP9', 'AV1']);
						console.log('Applied standard codec order');
					}
					
					transceiver.setCodecPreferences(sortedCodecs);
				} catch (error) {
					console.warn('Could not set codec preferences:', error);
				}
			}
		}
	}
	
	sortCodecsByPreference(codecs, preferredOrder) {
		return [...codecs].sort((a, b) => {
			const aMime = a.mimeType.toLowerCase();
			const bMime = b.mimeType.toLowerCase();
			
			let aIndex = preferredOrder.length;
			let bIndex = preferredOrder.length;
			
			for (let i = 0; i < preferredOrder.length; i++) {
				if (aMime.includes(preferredOrder[i].toLowerCase())) {
					aIndex = i;
					break;
				}
			}
			
			for (let i = 0; i < preferredOrder.length; i++) {
				if (bMime.includes(preferredOrder[i].toLowerCase())) {
					bIndex = i;
					break;
				}
			}
			
			return aIndex - bIndex;
		});
	}
	
	updateConnectionStatus(state) {
		const status = this.elements.connectionStatus;
		
		switch (state) {
			case 'connecting':
				status.textContent = 'Connecting...';
				status.classList.remove('connected', 'hidden');
				break;
			case 'connected':
				status.textContent = 'Connected';
				status.classList.add('connected');
				setTimeout(() => {
					status.classList.add('hidden');
				}, 2000);
				break;
			case 'disconnected':
			case 'failed':
				status.textContent = 'Connection lost';
				status.classList.remove('connected', 'hidden');
				break;
		}
	}
	
	async onOffer(offer) {
		// Host receives offer from guest
		// If media isn't ready yet, queue the offer for later processing
		if (!this.isMediaReady) {
			console.log('Queuing offer (media not ready yet)');
			this.pendingOffer = offer;
			return;
		}
		
		await this.processOffer(offer);
	}
	
	async processOffer(offer) {
		try {
			this.createPeerConnection();
			
			await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
			this.isRemoteDescriptionSet = true;
			
			// Process any queued ICE candidates
			await this.processPendingIceCandidates();
			
			const answer = await this.pc.createAnswer();
			await this.pc.setLocalDescription(answer);
			
			this.ws.send(JSON.stringify({
				type: 'answer',
				data: answer
			}));
		} catch (error) {
			console.error('Error handling offer:', error);
			this.showError('Failed to establish connection. Please try again.');
		}
	}
	
	async onAnswer(answer) {
		// Guest receives answer from host
		try {
			await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
			this.isRemoteDescriptionSet = true;
			
			// Process any queued ICE candidates
			await this.processPendingIceCandidates();
		} catch (error) {
			console.error('Error handling answer:', error);
			this.showError('Failed to establish connection. Please try again.');
		}
	}
	
	async processPendingIceCandidates() {
		// Add all queued ICE candidates now that remote description is set
		for (const candidate of this.pendingIceCandidates) {
			try {
				await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
				console.log('Added pending ICE candidate');
			} catch (error) {
				console.error('Error adding pending ICE candidate:', error);
			}
		}
		this.pendingIceCandidates = [];
	}
	
	async onIceCandidate(candidate) {
		if (!candidate) return;
		
		// If remote description isn't set yet, queue the candidate
		if (!this.pc || !this.isRemoteDescriptionSet) {
			console.log('Queuing ICE candidate (remote description not set)');
			this.pendingIceCandidates.push(candidate);
			return;
		}
		
		try {
			await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
		} catch (error) {
			console.error('Error adding ICE candidate:', error);
		}
	}
	
	onPeerDisconnected() {
		this.cleanup();
		this.elements.endedReason.textContent = 'The other person has left the call.';
		this.showScreen('ended');
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
		// Toggle facing mode
		this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
		
		try {
			// Stop current video track
			if (this.localStream) {
				this.localStream.getVideoTracks().forEach(track => track.stop());
			}
			
			// Get new video stream with switched camera
			const newStream = await navigator.mediaDevices.getUserMedia({
				video: {
					width: { ideal: 1280 },
					height: { ideal: 720 },
					facingMode: this.facingMode
				},
				audio: false // Don't request audio again
			});
			
			const newVideoTrack = newStream.getVideoTracks()[0];
			
			// Replace video track in local stream
			const oldVideoTrack = this.localStream.getVideoTracks()[0];
			if (oldVideoTrack) {
				this.localStream.removeTrack(oldVideoTrack);
			}
			this.localStream.addTrack(newVideoTrack);
			
			// Update local video element
			this.elements.localVideo.srcObject = this.localStream;
			
			// Replace track in peer connection if active
			if (this.pc) {
				const sender = this.pc.getSenders().find(s => s.track?.kind === 'video');
				if (sender) {
					await sender.replaceTrack(newVideoTrack);
				}
			}
			
			// Apply current video enabled state to new track
			newVideoTrack.enabled = this.isVideoEnabled;
			
		} catch (error) {
			console.error('Failed to switch camera:', error);
			// Revert facing mode on failure
			this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
			this.showError('Could not switch camera. Your device may not have multiple cameras.');
		}
	}
	
	hangUp() {
		// Only send hang-up if we have an active connection
		try {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.ws.send(JSON.stringify({ type: 'hang-up' }));
			}
		} catch (error) {
			console.error('Error sending hang-up:', error);
		}
		
		this.cleanup();
		this.elements.endedReason.textContent = 'You ended the call.';
		this.showScreen('ended');
	}
	
	cancelWaiting() {
		this.cleanup();
		this.showScreen('entry');
	}
	
	copyRoomCode() {
		const copyText = (text) => {
			// Try modern clipboard API first
			if (navigator.clipboard && navigator.clipboard.writeText) {
				return navigator.clipboard.writeText(text);
			}
			
			// Fallback for older browsers
			return new Promise((resolve, reject) => {
				const textArea = document.createElement('textarea');
				textArea.value = text;
				textArea.style.position = 'fixed';
				textArea.style.left = '-9999px';
				document.body.appendChild(textArea);
				textArea.select();
				try {
					document.execCommand('copy');
					resolve();
				} catch (err) {
					reject(err);
				} finally {
					document.body.removeChild(textArea);
				}
			});
		};
		
		copyText(this.roomId)
			.then(() => {
				this.elements.copyHint.textContent = 'Copied!';
				this.elements.copyHint.classList.add('copied');
				setTimeout(() => {
					this.elements.copyHint.textContent = 'Click to copy';
					this.elements.copyHint.classList.remove('copied');
				}, 2000);
			})
			.catch((err) => {
				console.error('Failed to copy:', err);
				this.elements.copyHint.textContent = 'Copy failed';
				setTimeout(() => {
					this.elements.copyHint.textContent = 'Click to copy';
				}, 2000);
			});
	}
	
	cleanup() {
		// Stop local media
		if (this.localStream) {
			this.localStream.getTracks().forEach(track => track.stop());
			this.localStream = null;
		}
		
		// Close peer connection
		if (this.pc) {
			this.pc.close();
			this.pc = null;
		}
		
		// Close WebSocket
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		
		// Clear video elements
		this.elements.localVideo.srcObject = null;
		this.elements.remoteVideo.srcObject = null;
		
		// Reset state
		this.roomId = null;
		this.role = null;
		this.isAudioEnabled = true;
		this.isVideoEnabled = true;
		this.facingMode = 'user';
		this.codecPreference = 'av1';
		this.pendingIceCandidates = [];
		this.isRemoteDescriptionSet = false;
		this.pendingOffer = null;
		this.isMediaReady = false;
		
		// Reset UI
		this.elements.toggleAudioBtn.classList.remove('muted');
		this.elements.toggleAudioBtn.querySelector('.icon-mic-on').classList.remove('hidden');
		this.elements.toggleAudioBtn.querySelector('.icon-mic-off').classList.add('hidden');
		this.elements.toggleVideoBtn.classList.remove('muted');
		this.elements.toggleVideoBtn.querySelector('.icon-video-on').classList.remove('hidden');
		this.elements.toggleVideoBtn.querySelector('.icon-video-off').classList.add('hidden');
		this.elements.connectionStatus.classList.remove('connected', 'hidden');
		this.elements.connectionStatus.textContent = 'Connecting...';
	}
	
	backToHome() {
		this.elements.specialCode.value = '';
		this.elements.roomAddress.value = '';
		this.showScreen('entry');
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
			
			// Constrain to viewport
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
		
		// Mouse events
		video.addEventListener('mousedown', (e) => {
			onDragStart(e.clientX, e.clientY);
		});
		
		document.addEventListener('mousemove', (e) => {
			onDragMove(e.clientX, e.clientY);
		});
		
		document.addEventListener('mouseup', onDragEnd);
		
		// Touch events for mobile
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

