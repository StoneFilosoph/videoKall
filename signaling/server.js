const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const SPECIAL_CODE = process.env.SPECIAL_CODE || 'FAMILY2024';
const TURN_USERNAME = process.env.TURN_USERNAME || 'videokall';
const TURN_PASSWORD = process.env.TURN_PASSWORD || 'videokall123';
const EXTERNAL_IP = process.env.EXTERNAL_IP || '';
const TURN_TLS_ENABLED = process.env.TURN_TLS_ENABLED === 'true';

// Initialize database
db.init();

// Determine TURN server URL for clients
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

// In-memory store for active participants (not persisted)
// Map<roomId, { participants: Map<participantId, WebSocket>, hostId: string|null }>
const activeRooms = new Map();

// Get or create in-memory room state for an existing DB room
function getActiveRoom(roomId) {
	if (!activeRooms.has(roomId)) {
		activeRooms.set(roomId, {
			participants: new Map(),
			hostId: null
		});
	}
	return activeRooms.get(roomId);
}

// Generate a random room ID (12 chars, formatted as xxxx-xxxx-xxxx)
function generateRoomId() {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let id = '';
	for (let i = 0; i < 12; i++) {
		id += chars[crypto.randomInt(chars.length)];
	}
	return `${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}`;
}

// Generate unique participant ID
function generateParticipantId() {
	return crypto.randomBytes(8).toString('hex');
}

// Create HTTP server
const server = http.createServer((req, res) => {
	// Enable CORS
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Code');
	
	if (req.method === 'OPTIONS') {
		res.writeHead(200);
		res.end();
		return;
	}
	
	const url = new URL(req.url, `http://${req.headers.host}`);
	
	// Health check
	if (req.method === 'GET' && url.pathname === '/health') {
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ status: 'ok', rooms: db.getAllRooms().length }));
		return;
	}
	
	// Admin API - requires special code
	if (url.pathname.startsWith('/api/admin/')) {
		const adminCode = req.headers['x-admin-code'];
		if (adminCode !== SPECIAL_CODE) {
			res.writeHead(401, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ error: 'Invalid admin code' }));
			return;
		}
		
		// GET /api/admin/rooms - List all rooms
		if (req.method === 'GET' && url.pathname === '/api/admin/rooms') {
			const dbRooms = db.getAllRooms();
			const roomList = dbRooms.map(room => {
				const active = activeRooms.get(room.id);
				return {
					id: room.id,
					name: room.name,
					createdAt: room.created_at,
					participantCount: active ? active.participants.size : 0,
					hasHost: active ? active.hostId !== null : false
				};
			});
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ rooms: roomList }));
			return;
		}
		
		// POST /api/admin/rooms - Create a new room
		if (req.method === 'POST' && url.pathname === '/api/admin/rooms') {
			let body = '';
			req.on('data', chunk => body += chunk);
			req.on('end', () => {
				let data = {};
				try {
					if (body) data = JSON.parse(body);
				} catch (e) {
					res.writeHead(400, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ error: 'Invalid JSON' }));
					return;
				}
				
				const name = data.name || 'Unnamed Room';
				
				// Generate unique room ID
				let roomId;
				do {
					roomId = generateRoomId();
				} while (db.roomExists(roomId));
				
				// Create room in database (persistent)
				const room = db.createRoom(roomId, name);
				
				console.log(`Room created: ${roomId} (${name})`);
				
				res.writeHead(201, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({
					id: room.id,
					name: room.name,
					createdAt: room.createdAt
				}));
			});
			return;
		}
		
		// DELETE /api/admin/rooms/:roomId - Delete a room
		const deleteMatch = url.pathname.match(/^\/api\/admin\/rooms\/([a-z0-9-]+)$/);
		if (req.method === 'DELETE' && deleteMatch) {
			const roomId = deleteMatch[1];
			
			// Check if room exists in database
			if (!db.roomExists(roomId)) {
				res.writeHead(404, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ error: 'Room not found' }));
				return;
			}
			
			// Disconnect all active participants
			const active = activeRooms.get(roomId);
			if (active) {
				for (const [, ws] of active.participants) {
					if (ws.readyState === WebSocket.OPEN) {
						ws.send(JSON.stringify({ type: 'room-deleted' }));
						ws.close();
					}
				}
				activeRooms.delete(roomId);
			}
			
			// Delete from database
			db.deleteRoom(roomId);
			console.log(`Room deleted: ${roomId}`);
			
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ success: true }));
			return;
		}
		
		res.writeHead(404, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ error: 'Not found' }));
		return;
	}
	
	// Check if room exists (for direct join validation)
	if (req.method === 'GET' && url.pathname.startsWith('/api/room/')) {
		const roomId = url.pathname.replace('/api/room/', '');
		const room = db.getRoom(roomId);
		
		if (room) {
			const active = activeRooms.get(roomId);
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({
				exists: true,
				name: room.name,
				participantCount: active ? active.participants.size : 0
			}));
		} else {
			res.writeHead(404, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ exists: false }));
		}
		return;
	}
	
	res.writeHead(404);
	res.end();
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Get ICE server configuration
function getIceServers() {
	const servers = [
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:stun1.l.google.com:19302' }
	];
	
	if (TURN_SERVER_PUBLIC) {
		const turnUrls = [TURN_SERVER_PUBLIC];
		
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

// Broadcast to all participants in a room except sender
function broadcastToRoom(roomId, message, excludeId = null) {
	const room = activeRooms.get(roomId);
	if (!room) return;
	
	const msgStr = JSON.stringify(message);
	for (const [participantId, ws] of room.participants) {
		if (participantId !== excludeId && ws.readyState === WebSocket.OPEN) {
			ws.send(msgStr);
		}
	}
}

// Send to specific participant
function sendToParticipant(roomId, targetId, message) {
	const room = activeRooms.get(roomId);
	if (!room) return;
	
	const ws = room.participants.get(targetId);
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(message));
	}
}

// Elect new host when current host leaves
function electNewHost(room) {
	// Pick first available participant as new host
	for (const [participantId, ws] of room.participants) {
		if (ws.readyState === WebSocket.OPEN) {
			room.hostId = participantId;
			ws.send(JSON.stringify({ type: 'you-are-host' }));
			
			// Notify all others about new host
			broadcastToRoom(ws.roomId, {
				type: 'new-host',
				hostId: participantId
			}, participantId);
			
			console.log(`New host elected: ${participantId} in room ${ws.roomId}`);
			return true;
		}
	}
	room.hostId = null;
	return false;
}

wss.on('connection', (ws) => {
	console.log('New WebSocket connection');
	
	ws.isAlive = true;
	ws.roomId = null;
	ws.participantId = null;
	
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
			case 'join-room':
				handleJoinRoom(ws, message);
				break;
			case 'offer':
			case 'answer':
			case 'ice-candidate':
				handleSignaling(ws, message);
				break;
			case 'leave-room':
				handleLeaveRoom(ws);
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

function handleJoinRoom(ws, message) {
	const roomId = message.roomId?.toLowerCase().trim();
	
	if (!roomId) {
		ws.send(JSON.stringify({
			type: 'error',
			message: 'Room ID is required'
		}));
		return;
	}
	
	// Check if room exists in database
	const dbRoom = db.getRoom(roomId);
	
	if (!dbRoom) {
		ws.send(JSON.stringify({
			type: 'error',
			message: 'Room not found. It may have been deleted.'
		}));
		return;
	}
	
	// Get or create active room state
	const room = getActiveRoom(roomId);
	
	// Generate participant ID
	const participantId = generateParticipantId();
	ws.participantId = participantId;
	ws.roomId = roomId;
	
	// Add to room
	room.participants.set(participantId, ws);
	
	// First person to join becomes host
	const isHost = room.hostId === null;
	if (isHost) {
		room.hostId = participantId;
	}
	
	// Get list of existing participants (for mesh connections)
	const existingParticipants = [];
	for (const [pId, pWs] of room.participants) {
		if (pId !== participantId && pWs.readyState === WebSocket.OPEN) {
			existingParticipants.push(pId);
		}
	}
	
	// Notify the new participant
	ws.send(JSON.stringify({
		type: 'room-joined',
		roomId: roomId,
		roomName: dbRoom.name,
		participantId: participantId,
		isHost: isHost,
		existingParticipants: existingParticipants,
		iceServers: getIceServers()
	}));
	
	// Notify existing participants about the new joiner
	broadcastToRoom(roomId, {
		type: 'participant-joined',
		participantId: participantId
	}, participantId);
	
	console.log(`Participant ${participantId} joined room ${roomId} (host: ${isHost}, total: ${room.participants.size})`);
}

function handleSignaling(ws, message) {
	const room = activeRooms.get(ws.roomId);
	if (!room) return;
	
	const targetId = message.targetId;
	
	if (targetId) {
		// Send to specific participant
		sendToParticipant(ws.roomId, targetId, {
			type: message.type,
			data: message.data,
			fromId: ws.participantId
		});
	} else {
		// Broadcast to all (fallback)
		broadcastToRoom(ws.roomId, {
			type: message.type,
			data: message.data,
			fromId: ws.participantId
		}, ws.participantId);
	}
}

function handleLeaveRoom(ws) {
	if (!ws.roomId) return;
	
	const room = activeRooms.get(ws.roomId);
	if (!room) return;
	
	const wasHost = room.hostId === ws.participantId;
	
	// Remove from room
	room.participants.delete(ws.participantId);
	
	// Notify others
	broadcastToRoom(ws.roomId, {
		type: 'participant-left',
		participantId: ws.participantId
	});
	
	console.log(`Participant ${ws.participantId} left room ${ws.roomId}`);
	
	// If host left, elect new host
	if (wasHost && room.participants.size > 0) {
		electNewHost(room);
	}
	
	// Clean up empty active rooms (but keep in database for persistence)
	if (room.participants.size === 0) {
		activeRooms.delete(ws.roomId);
	}
	
	ws.roomId = null;
	ws.participantId = null;
}

function handleDisconnect(ws) {
	if (!ws.roomId) return;
	
	const room = activeRooms.get(ws.roomId);
	if (!room) return;
	
	const wasHost = room.hostId === ws.participantId;
	const roomId = ws.roomId;
	
	// Remove from room
	room.participants.delete(ws.participantId);
	
	// Notify others
	broadcastToRoom(roomId, {
		type: 'participant-left',
		participantId: ws.participantId
	});
	
	console.log(`Participant ${ws.participantId} disconnected from room ${roomId} (remaining: ${room.participants.size})`);
	
	// If host disconnected, elect new host
	if (wasHost && room.participants.size > 0) {
		electNewHost(room);
	}
	
	// Clean up empty active rooms (but keep in database for persistence)
	if (room.participants.size === 0) {
		activeRooms.delete(roomId);
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
	console.log(`Admin code configured: ${SPECIAL_CODE ? 'Yes' : 'No (using default)'}`);
});
