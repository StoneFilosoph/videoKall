export class UIService {
    constructor() {
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
            pipTopBtn: document.getElementById('pip-top-btn'),
            leaveCallBtn: document.getElementById('leave-call-btn'),
            endedTitle: document.getElementById('ended-title'),
            endedReason: document.getElementById('ended-reason'),
            rejoinBtn: document.getElementById('rejoin-btn'),
            backHomeBtn: document.getElementById('back-home-btn'),
            errorMessage: document.getElementById('error-message'),
            langToggle: document.getElementById('lang-toggle'),
            langDropdown: document.getElementById('lang-dropdown'),
            langSwitcher: document.querySelector('.language-switcher'),
            currentLang: document.getElementById('current-lang')
        };
    }

    showScreen(screenName) {
        // Hide all screens
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
            // Accessibility
            screen.setAttribute('aria-hidden', 'true');
        });

        // Show target screen
        const targetScreen = this.screens[screenName];
        if (targetScreen) {
            targetScreen.classList.add('active');
            targetScreen.setAttribute('aria-hidden', 'false');
        }

        // Hide error message when switching screens
        if (this.elements.errorMessage) {
            this.elements.errorMessage.textContent = '';
            this.elements.errorMessage.classList.remove('visible');
        }
    }

    showError(message) {
        if (this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            this.elements.errorMessage.classList.add('visible');

            // Auto-hide after 5 seconds
            setTimeout(() => {
                this.elements.errorMessage.classList.remove('visible');
            }, 5000);
        } else {
            alert(message);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    renderRooms(rooms) {
        if (!rooms || rooms.length === 0) {
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

    updateConnectionStatus(status) {
        if (!this.elements.connectionStatus) return;

        const texts = {
            'connecting': window.i18n.t('call.connecting'),
            'connected': window.i18n.t('call.connected'),
            'waiting': window.i18n.t('call.waitingForOthers')
        };

        this.elements.connectionStatus.textContent = texts[status] || status;

        // Remove class after connected to fade out
        if (status === 'connected') {
            setTimeout(() => {
                this.elements.connectionStatus.classList.add('fade-out');
            }, 3000);
        } else {
            this.elements.connectionStatus.classList.remove('fade-out');
        }
    }

    updateLangDisplay() {
        const currentLang = window.i18n.getLocale();
        this.elements.currentLang.textContent = currentLang.toUpperCase();

        // Update active class in dropdown
        document.querySelectorAll('.lang-option').forEach(btn => {
            if (btn.getAttribute('data-lang') === currentLang) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    addRemoteVideo(participantId, stream) {
        let videoContainer = document.getElementById(`container-${participantId}`);

        if (!videoContainer) {
            videoContainer = document.createElement('div');
            videoContainer.id = `container-${participantId}`;
            videoContainer.className = 'video-wrapper';

            const video = document.createElement('video');
            video.id = `video-${participantId}`;
            video.autoplay = true;
            video.playsInline = true;
            videoContainer.appendChild(video);

            this.elements.videosGrid.appendChild(videoContainer);
            this.updateVideoLayout();
        }

        const video = videoContainer.querySelector('video');
        if (video) {
            video.srcObject = stream;
        }
    }

    removeRemoteVideo(participantId) {
        const videoContainer = document.getElementById(`container-${participantId}`);
        if (videoContainer) {
            videoContainer.remove();
            this.updateVideoLayout();
        }
    }

    updateVideoLayout() {
        // Adjust grid based on number of participants
        const count = this.elements.videosGrid.children.length;
        this.elements.videosGrid.setAttribute('data-count', count);

        if (count === 1) {
            this.elements.videosGrid.classList.add('single-remote');
        } else {
            this.elements.videosGrid.classList.remove('single-remote');
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

            // Responsive margins for edge padding
            const isMobile = window.innerWidth <= 600;
            const edgePadding = isMobile ? 12 : 24;

            // Top margin: small buffer to avoid edge
            const topMargin = isMobile ? 12 : 16;

            // Bottom margin: just enough to clear the call controls
            // Controls are ~112px on desktop (64px buttons + 24px*2 padding)
            // Controls are ~104px on mobile (56px buttons + 24px*2 padding)
            const bottomMargin = isMobile ? 100 : 108;

            const maxLeft = window.innerWidth - video.offsetWidth - edgePadding;
            const maxBottom = window.innerHeight - video.offsetHeight - topMargin;

            video.style.left = Math.max(edgePadding, Math.min(maxLeft, newLeft)) + 'px';
            video.style.right = 'auto';
            video.style.bottom = Math.max(bottomMargin, Math.min(maxBottom, newBottom)) + 'px';
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
