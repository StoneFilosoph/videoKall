export class SignalingService {
    constructor(callbacks) {
        this.callbacks = callbacks || {};
        this.ws = null;
    }

    /**
     * Connect to the WebSocket server.
     * @returns {Promise<void>}
     */
    connect() {
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
                if (this.callbacks.onOpen) this.callbacks.onOpen();
                resolve();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                if (this.callbacks.onError) this.callbacks.onError(error);
                reject(new Error('Failed to connect to server'));
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                if (this.callbacks.onClose) this.callbacks.onClose();
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (this.callbacks.onMessage) {
                        this.callbacks.onMessage(message);
                    }
                } catch (e) {
                    console.error('Failed to parse WebSocket message:', e);
                }
            };
        });
    }

    /**
     * Send a message to the signaling server.
     * @param {Object} message 
     */
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('Cannot send message, WebSocket is not open');
        }
    }

    /**
     * Close the WebSocket connection.
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
