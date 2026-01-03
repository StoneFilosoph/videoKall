// Simple SQLite database for room persistence
const Database = require('better-sqlite3');
const path = require('path');

// Database file path - stored in /data for Docker volume mount
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'rooms.db');

let db = null;

function init() {
	// Ensure data directory exists
	const fs = require('fs');
	const dir = path.dirname(DB_PATH);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	
	db = new Database(DB_PATH);
	
	// Enable WAL mode for better performance
	db.pragma('journal_mode = WAL');
	
	// Create rooms table if it doesn't exist
	db.exec(`
		CREATE TABLE IF NOT EXISTS rooms (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			created_at INTEGER NOT NULL
		)
	`);
	
	console.log(`Database initialized at ${DB_PATH}`);
	
	return db;
}

// Get all rooms from database
function getAllRooms() {
	const stmt = db.prepare('SELECT id, name, created_at FROM rooms ORDER BY created_at DESC');
	return stmt.all();
}

// Get a single room by ID
function getRoom(roomId) {
	const stmt = db.prepare('SELECT id, name, created_at FROM rooms WHERE id = ?');
	return stmt.get(roomId);
}

// Create a new room
function createRoom(roomId, name) {
	const createdAt = Date.now();
	const stmt = db.prepare('INSERT INTO rooms (id, name, created_at) VALUES (?, ?, ?)');
	stmt.run(roomId, name, createdAt);
	return { id: roomId, name, createdAt };
}

// Delete a room
function deleteRoom(roomId) {
	const stmt = db.prepare('DELETE FROM rooms WHERE id = ?');
	const result = stmt.run(roomId);
	return result.changes > 0;
}

// Check if room exists
function roomExists(roomId) {
	const stmt = db.prepare('SELECT 1 FROM rooms WHERE id = ?');
	return stmt.get(roomId) !== undefined;
}

module.exports = {
	init,
	getAllRooms,
	getRoom,
	createRoom,
	deleteRoom,
	roomExists
};

