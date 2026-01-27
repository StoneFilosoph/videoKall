import { AdminService } from './modules/AdminService.js';
import { SignalingService } from './modules/SignalingService.js';
import { WebRTCService } from './modules/WebRTCService.js';
import { UIService } from './modules/UIService.js';

// VideoKall - WebRTC Video Calling Application
class VideoKall {
	constructor() {
		this.adminCode = null;
		this.roomId = null;

		// Initialize services
		this.ui = new UIService();
		this.adminService = new AdminService();

		this.signalingService = new SignalingService({
			onMessage: (msg) => this.handleMessage(msg),
			onOpen: () => console.log('WebSocket connected'),
			onError: (err) => {
				console.error('WebSocket error:', err);
				this.ui.showError(window.i18n.t('error.connectionFailed'));
			},
			onClose: () => console.log('WebSocket disconnected')
		});

		this.webrtcService = new WebRTCService(this.signalingService, {
			onLocalStream: (stream) => {
				this.ui.elements.localVideo.srcObject = stream;
			},
			onRemoteStream: (id, stream) => {
				this.ui.addRemoteVideo(id, stream);
			},
			onRemoteStreamRemove: (id) => {
				this.ui.removeRemoteVideo(id);
			},
			onDebugInfo: (info) => {
				if (this.ui.elements.cameraDebugInfo) {
					this.ui.elements.cameraDebugInfo.textContent = info;
				}
			}
		});

		// Session
		this.wakeLock = null;
		this.isPipActive = false;

		this.init();
	}

	init() {
		// Initialize i18n
		if (window.i18n) {
			window.i18n.init();
			this.ui.updateLangDisplay();
		}

		this.bindEvents();
		this.checkJoinLink();
		this.ui.makeVideoDraggable();
	}

	bindEvents() {
		const els = this.ui.elements;

		// Entry screen
		els.adminLoginBtn.addEventListener('click', () => this.adminLogin());
		els.adminCode.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') this.adminLogin();
		});

		// Admin screen
		els.adminLogoutBtn.addEventListener('click', () => this.adminLogout());
		els.createRoomBtn.addEventListener('click', () => this.createRoom());
		els.newRoomName.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') this.createRoom();
		});

		// Joining screen
		els.cancelJoinBtn.addEventListener('click', () => this.cancelJoin());

		// Call controls
		els.toggleAudioBtn.addEventListener('click', () => this.toggleAudio());
		els.toggleVideoBtn.addEventListener('click', () => this.toggleVideo());
		els.switchCameraBtn.addEventListener('click', () => this.switchCamera());
		els.pipTopBtn.addEventListener('click', () => this.togglePictureInPicture());
		els.leaveCallBtn.addEventListener('click', () => this.leaveCall());

		// Show switch camera button only on mobile
		const isMobile = window.innerWidth <= 600; // access directly or via logic
		if (isMobile) {
			els.switchCameraBtn.classList.remove('hidden');
		}

		// Handle visibility change for auto-PiP
		document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

		// Handle PiP events
		document.addEventListener('enterpictureinpicture', () => {
			this.isPipActive = true;
			els.pipTopBtn.classList.add('active');
		});

		document.addEventListener('leavepictureinpicture', () => {
			this.isPipActive = false;
			els.pipTopBtn.classList.remove('active');
		});

		// Ended screen
		els.rejoinBtn.addEventListener('click', () => this.rejoinCall());
		els.backHomeBtn.addEventListener('click', () => this.backToHome());

		// Language switcher
		els.langToggle.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			els.langDropdown.classList.toggle('hidden');
		});

		els.langDropdown.addEventListener('click', (e) => {
			e.stopPropagation();
		});

		document.querySelectorAll('.lang-option').forEach(btn => {
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				const lang = e.currentTarget.getAttribute('data-lang');
				window.i18n.setLocale(lang);
				this.ui.updateLangDisplay();
				els.langDropdown.classList.add('hidden');
				if (this.ui.screens.admin.classList.contains('active')) {
					this.loadRooms();
				}
			});
		});

		document.addEventListener('click', (e) => {
			const switcher = document.querySelector('.language-switcher');
			if (switcher && !switcher.contains(e.target)) {
				els.langDropdown.classList.add('hidden');
			}
		});
	}

	// --- Admin Functions ---

	async adminLogin() {
		const code = this.ui.elements.adminCode.value.trim();
		if (!code) {
			this.ui.showError(window.i18n.t('error.enterCode'));
			return;
		}

		try {
			const isValid = await this.adminService.verifyCode(code);
			if (!isValid) {
				this.ui.showError(window.i18n.t('error.invalidCode'));
				return;
			}

			this.adminCode = code;
			this.ui.showScreen('admin');
			this.loadRooms();
		} catch (error) {
			this.ui.showError(window.i18n.t('error.connectionFailed'));
		}
	}

	async adminLogout() {
		this.adminCode = null;
		this.ui.elements.adminCode.value = '';
		this.ui.showScreen('entry');
	}

	async loadRooms() {
		try {
			const rooms = await this.adminService.getRooms(this.adminCode);
			this.ui.renderRooms(rooms);
		} catch (error) {
			console.error(error);
			this.ui.elements.roomsList.innerHTML = `<div class="error-rooms">${window.i18n.t('admin.failedLoadRooms')}</div>`;
		}
	}

	async createRoom() {
		const name = this.ui.elements.newRoomName.value.trim() || window.i18n.t('admin.defaultRoomName');
		try {
			await this.adminService.createRoom(this.adminCode, name);
			this.ui.elements.newRoomName.value = '';
			this.loadRooms();
		} catch (error) {
			console.error(error);
			this.ui.showError(window.i18n.t('admin.failedCreateRoom'));
		}
	}

	async deleteRoom(roomId) {
		if (!confirm(window.i18n.t('admin.deleteConfirm'))) return;
		try {
			await this.adminService.deleteRoom(this.adminCode, roomId);
			this.loadRooms();
		} catch (error) {
			console.error(error);
			this.ui.showError(window.i18n.t('admin.failedDeleteRoom'));
		}
	}

	copyRoomLink(roomId) {
		const url = `${window.location.origin}/?join=${roomId}`;
		navigator.clipboard.writeText(url).then(() => {
			alert('Link copied to clipboard!');
		}).catch(err => {
			console.error('Failed to copy link:', err);
		});
	}

	joinRoomAsAdmin(roomId) {
		this.directJoin(roomId, true);
	}

	// --- Join / Call Flow ---

	checkJoinLink() {
		const urlParams = new URLSearchParams(window.location.search);
		const joinRoomId = urlParams.get('join');

		if (joinRoomId) {
			const roomIdRegex = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;
			if (roomIdRegex.test(joinRoomId.toLowerCase())) {
				const cleanUrl = window.location.origin + window.location.pathname;
				window.history.replaceState({}, document.title, cleanUrl);
				this.directJoin(joinRoomId.toLowerCase());
			}
		}
	}

	directJoin(roomId, asAdmin = false) {
		this.roomId = roomId;
		this.ui.elements.joiningRoomName.textContent = window.i18n.t('joining.connecting') + (asAdmin ? ' (Admin)' : '');
		this.ui.showScreen('joining');

		setTimeout(() => {
			this.startCall();
		}, 1500);
	}

	cancelJoin() {
		this.roomId = null;
		if (this.adminCode) {
			this.ui.showScreen('admin');
		} else {
			this.ui.showScreen('entry');
		}
	}

	async startCall() {
		try {
			// Ensure debug info element
			if (!this.ui.elements.cameraDebugInfo) {
				// ... recreate if missing? UIService handles getting it. 
				// If it's missing in DOM, UIService constructor might have missed it unless it's dynamic. 
				// In original, it was dynamic if missing.
				const debugDiv = document.createElement('div');
				debugDiv.id = 'camera-debug-info';
				debugDiv.className = 'camera-debug-info';
				document.body.appendChild(debugDiv);
				this.ui.elements.cameraDebugInfo = debugDiv;
			}

			await this.webrtcService.setupMedia();
			this.ui.showScreen('call');

			this.ui.elements.langSwitcher.classList.add('hidden');
			if (document.pictureInPictureEnabled) { // simplified check
				this.ui.elements.pipTopBtn.classList.remove('hidden');
			}

			await this.requestWakeLock();
			await this.signalingService.connect();

			this.signalingService.send({
				type: 'join-room',
				roomId: this.roomId
			});

		} catch (error) {
			console.error('Failed to start call:', error);
			this.cleanup();
			this.ui.showScreen('entry');
			this.ui.showError(window.i18n.t('error.mediaFailed'));
		}
	}

	// --- WebSocket / Signaling Handling ---

	handleMessage(message) {
		console.log('Received:', message.type);

		switch (message.type) {
			case 'room-joined':
				this.onRoomJoined(message);
				break;
			case 'participant-joined':
				// just log or notify?
				console.log('Participant joined:', message.participantId);
				break;
			case 'participant-left':
				this.webrtcService.removePeer(message.participantId);
				break;
			case 'offer':
				this.webrtcService.handleOffer(message.data, message.fromId);
				break;
			case 'answer':
				this.webrtcService.handleAnswer(message.data, message.fromId);
				break;
			case 'ice-candidate':
				this.webrtcService.handleIceCandidate(message.data, message.fromId);
				break;
			case 'you-are-host':
				// this.isHost = true; // Handle host logic display if needed
				this.ui.showError(window.i18n.t('call.youAreHost')); // as toast/notification
				break;
			case 'new-host':
				// message.hostId
				break;
			case 'room-deleted':
				this.cleanup();
				this.ui.showScreen('ended');
				this.ui.elements.endedReason.textContent = window.i18n.t('ended.roomDeletedByAdmin');
				break;
			case 'error':
				this.ui.showError(message.message);
				break;
		}
	}

	onRoomJoined(message) {
		this.participantId = message.participantId;
		// this.isHost = message.isHost;
		this.webrtcService.setIceServers(message.iceServers);
		// this.roomName = message.roomName;

		console.log(`Joined room as ${message.isHost ? 'host' : 'participant'}, ID: ${this.participantId}`);
		this.ui.updateConnectionStatus('connected');

		for (const peerId of message.existingParticipants) {
			this.webrtcService.createPeerConnection(peerId, true);
		}
	}

	// --- Media Controls ---

	toggleAudio() {
		const enabled = this.webrtcService.toggleAudio();
		const iconOn = this.ui.elements.toggleAudioBtn.querySelector('.icon-mic-on');
		const iconOff = this.ui.elements.toggleAudioBtn.querySelector('.icon-mic-off');

		if (enabled) {
			this.ui.elements.toggleAudioBtn.classList.remove('off');
			iconOn.classList.remove('hidden');
			iconOff.classList.add('hidden');
		} else {
			this.ui.elements.toggleAudioBtn.classList.add('off');
			iconOn.classList.add('hidden');
			iconOff.classList.remove('hidden');
		}
	}

	toggleVideo() {
		const enabled = this.webrtcService.toggleVideo();
		const iconOn = this.ui.elements.toggleVideoBtn.querySelector('.icon-video-on');
		const iconOff = this.ui.elements.toggleVideoBtn.querySelector('.icon-video-off');

		if (enabled) {
			this.ui.elements.toggleVideoBtn.classList.remove('off');
			iconOn.classList.remove('hidden');
			iconOff.classList.add('hidden');
		} else {
			this.ui.elements.toggleVideoBtn.classList.add('off');
			iconOn.classList.add('hidden');
			iconOff.classList.remove('hidden');
		}
	}

	async switchCamera() {
		await this.webrtcService.switchCamera();
	}

	async togglePictureInPicture() {
		try {
			if (document.pictureInPictureElement) {
				await document.exitPictureInPicture();
			} else if (document.pictureInPictureEnabled && this.ui.elements.localVideo) {
				await this.ui.elements.localVideo.requestPictureInPicture();
			}
		} catch (error) {
			console.error('PiP failed:', error);
		}
	}

	handleVisibilityChange() {
		if (document.hidden && !document.pictureInPictureElement &&
			this.ui.screens.call.classList.contains('active')) {
			// Auto enter PiP logic if desired
			this.togglePictureInPicture().catch(() => { });
		}
	}

	// --- Cleanup & Exit ---

	leaveCall() {
		this.cleanup();
		this.ui.showScreen('ended');
		this.ui.elements.endedReason.textContent = window.i18n.t('ended.youLeft');
	}

	rejoinCall() {
		if (this.roomId) {
			this.startCall();
		} else {
			this.backToHome();
		}
	}

	backToHome() {
		this.roomId = null;
		this.ui.showScreen('entry');
	}

	cleanup() {
		this.signalingService.disconnect();
		this.webrtcService.cleanup();
		this.ui.elements.langSwitcher.classList.remove('hidden');
		this.ui.elements.pipTopBtn.classList.add('hidden');
		if (document.pictureInPictureElement) {
			document.exitPictureInPicture().catch(() => { });
		}
		this.releaseWakeLock();
	}

	async requestWakeLock() {
		if ('wakeLock' in navigator) {
			try {
				this.wakeLock = await navigator.wakeLock.request('screen');
				this.wakeLock.addEventListener('release', () => {
					if (this.webrtcService.localStream && !document.hidden) {
						this.requestWakeLock();
					}
				});
			} catch (err) {
				console.log('Wake lock failed:', err);
			}
		}
	}

	async releaseWakeLock() {
		if (this.wakeLock) {
			try {
				await this.wakeLock.release();
				this.wakeLock = null;
			} catch (err) {
				console.log('Wake lock release failed:', err);
			}
		}
	}
}

// Make globally available for onclick handlers in HTML
window.videoKall = new VideoKall();
