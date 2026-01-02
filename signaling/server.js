const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const SPECIAL_CODE = process.env.SPECIAL_CODE || 'FAMILY2024';
const TURN_USERNAME = process.env.TURN_USERNAME || 'videokall';
const TURN_PASSWORD = process.env.TURN_PASSWORD || 'videokall123';
const EXTERNAL_IP = process.env.EXTERNAL_IP || '';
const TURN_TLS_ENABLED = process.env.TURN_TLS_ENABLED === 'true';

// Determine TURN server URL for clients
// Priority: TURN_SERVER_PUBLIC > construct from EXTERNAL_IP > localhost fallback
function getTurnServerPublic() {
	if (process.env.TURN_SERVER_PUBLIC) {
		return process.env.TURN_SERVER_PUBLIC;
	}
	if (EXTERNAL_IP) {
		return `turn:${EXTERNAL_IP}:3478`;
	}
	console.warn('WARNING: No EXTERNAL_IP or TURN_SERVER_PUBLIC set. TURN relay will not work for remote clients!');
	return null;
}

const TURN_SERVER_PUBLIC = getTurnServerPublic();
if (TURN_SERVER_PUBLIC) {
	console.log(`TURN server for clients: ${TURN_SERVER_PUBLIC}`);
}

// Store active rooms: Map<roomId, { host: WebSocket, guest: WebSocket, createdAt: Date }>
const rooms = new Map();

// Generate a random room ID (12 chars, formatted as xxxx-xxxx-xxxx)
function generateRoomId() {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let id = '';
	for (let i = 0; i < 12; i++) {
		id += chars[crypto.randomInt(chars.length)];
	}
	return `${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}`;
}

// Clean up expired rooms (older than 24 hours)
function cleanupRooms() {
	const now = Date.now();
	const maxAge = 24 * 60 * 60 * 1000; // 24 hours
	
	for (const [roomId, room] of rooms.entries()) {
		if (now - room.createdAt > maxAge) {
			if (room.host) room.host.close();
			if (room.guest) room.guest.close();
			rooms.delete(roomId);
			console.log(`Room ${roomId} expired and removed`);
		}
	}
}

// Run cleanup every hour
setInterval(cleanupRooms, 60 * 60 * 1000);

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
	if (req.url === '/health') {
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ status: 'ok', rooms: rooms.size }));
	} else {
		res.writeHead(404);
		res.end();
	}
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Get ICE server configuration
function getIceServers() {
	const servers = [
		// Public STUN servers (highest priority)
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:stun1.l.google.com:19302' }
	];
	
	// Only add self-hosted TURN server if we have a public URL
	if (TURN_SERVER_PUBLIC) {
		const turnUrls = [TURN_SERVER_PUBLIC];
		
		// Only add TURNS (TLS) URL if explicitly enabled
		if (TURN_TLS_ENABLED) {
			const turnsUrl = TURN_SERVER_PUBLIC.replace('turn:', 'turns:').replace(':3478', ':5349');
			turnUrls.push(turnsUrl);
		}
		
		servers.push({
			urls: turnUrls,
			username: TURN_USERNAME,
			credential: TURN_PASSWORD
		});
	}
	
	return servers;
}

wss.on('connection', (ws) => {
	console.log('New WebSocket connection');
	
	ws.isAlive = true;
	ws.roomId = null;
	ws.role = null; // 'host' or 'guest'
	
	ws.on('pong', () => {
		ws.isAlive = true;
	});
	
	ws.on('message', (data) => {
		let message;
		try {
			message = JSON.parse(data);
		} catch (e) {
			console.error('Invalid JSON received');
			return;
		}
		
		console.log('Received:', message.type);
		
		switch (message.type) {
			case 'create-room':
				handleCreateRoom(ws, message);
				break;
			case 'join-room':
				handleJoinRoom(ws, message);
				break;
			case 'offer':
			case 'answer':
			case 'ice-candidate':
				handleSignaling(ws, message);
				break;
			case 'hang-up':
				handleHangUp(ws);
				break;
			default:
				console.log('Unknown message type:', message.type);
		}
	});
	
	ws.on('close', () => {
		handleDisconnect(ws);
	});
	
	ws.on('error', (error) => {
		console.error('WebSocket error:', error);
	});
});

function handleCreateRoom(ws, message) {
	// Verify special code
	if (message.code !== SPECIAL_CODE) {
		ws.send(JSON.stringify({
			type: 'error',
			message: 'Invalid special code'
		}));
		return;
	}
	
	// Generate unique room ID
	let roomId;
	do {
		roomId = generateRoomId();
	} while (rooms.has(roomId));
	
	// Create room
	rooms.set(roomId, {
		host: ws,
		guest: null,
		createdAt: Date.now()
	});
	
	ws.roomId = roomId;
	ws.role = 'host';
	
	ws.send(JSON.stringify({
		type: 'room-created',
		roomId: roomId,
		iceServers: getIceServers()
	}));
	
	console.log(`Room ${roomId} created`);
}

function handleJoinRoom(ws, message) {
	const roomId = message.roomId?.toLowerCase().trim();
	
	if (!roomId) {
		ws.send(JSON.stringify({
			type: 'error',
			message: 'Room ID is required'
		}));
		return;
	}
	
	const room = rooms.get(roomId);
	
	if (!room) {
		ws.send(JSON.stringify({
			type: 'error',
			message: 'Room not found. Please check the calling address.'
		}));
		return;
	}
	
	if (room.guest) {
		ws.send(JSON.stringify({
			type: 'error',
			message: 'Room is full. This is a 1:1 call.'
		}));
		return;
	}
	
	// Join as guest
	room.guest = ws;
	ws.roomId = roomId;
	ws.role = 'guest';
	
	// Notify guest they joined
	ws.send(JSON.stringify({
		type: 'room-joined',
		roomId: roomId,
		iceServers: getIceServers()
	}));
	
	// Notify host that guest has joined
	if (room.host && room.host.readyState === WebSocket.OPEN) {
		room.host.send(JSON.stringify({
			type: 'guest-joined'
		}));
	}
	
	console.log(`Guest joined room ${roomId}`);
}

function handleSignaling(ws, message) {
	const room = rooms.get(ws.roomId);
	if (!room) return;
	
	// Forward to the other peer
	const target = ws.role === 'host' ? room.guest : room.host;
	
	if (target && target.readyState === WebSocket.OPEN) {
		target.send(JSON.stringify({
			type: message.type,
			data: message.data
		}));
	}
}

function handleHangUp(ws) {
	const room = rooms.get(ws.roomId);
	if (!room) return;
	
	// Notify the other peer
	const target = ws.role === 'host' ? room.guest : room.host;
	
	if (target && target.readyState === WebSocket.OPEN) {
		target.send(JSON.stringify({
			type: 'peer-disconnected'
		}));
	}
	
	// Clean up room
	rooms.delete(ws.roomId);
	console.log(`Room ${ws.roomId} closed due to hang-up`);
}

function handleDisconnect(ws) {
	if (!ws.roomId) return;
	
	const room = rooms.get(ws.roomId);
	if (!room) return;
	
	// Notify the other peer
	const target = ws.role === 'host' ? room.guest : room.host;
	
	if (target && target.readyState === WebSocket.OPEN) {
		target.send(JSON.stringify({
			type: 'peer-disconnected'
		}));
	}
	
	// If host disconnects, remove the room
	// If guest disconnects, keep the room for potential reconnection
	if (ws.role === 'host') {
		rooms.delete(ws.roomId);
		console.log(`Room ${ws.roomId} closed (host disconnected)`);
	} else {
		room.guest = null;
		console.log(`Guest left room ${ws.roomId}`);
	}
}

// Ping clients to detect disconnections
const pingInterval = setInterval(() => {
	wss.clients.forEach((ws) => {
		if (!ws.isAlive) {
			return ws.terminate();
		}
		ws.isAlive = false;
		ws.ping();
	});
}, 30000);

wss.on('close', () => {
	clearInterval(pingInterval);
});

server.listen(PORT, () => {
	console.log(`Signaling server running on port ${PORT}`);
	console.log(`Special code configured: ${SPECIAL_CODE ? 'Yes' : 'No (using default)'}`);
});

