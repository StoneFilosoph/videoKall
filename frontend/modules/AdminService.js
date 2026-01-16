export class AdminService {
    constructor() {}

    /**
     * Verify the admin code.
     * @param {string} code 
     * @returns {Promise<boolean>} true if valid, false if invalid (401)
     * @throws {Error} on network error
     */
    async verifyCode(code) {
        const response = await fetch('/api/admin/rooms', {
            headers: { 'X-Admin-Code': code }
        });
        
        if (response.status === 401) {
            return false;
        }
        
        if (!response.ok) {
            throw new Error(`Verification failed with status: ${response.status}`);
        }
        
        return true;
    }

    /**
     * Fetch all rooms.
     * @param {string} code 
     * @returns {Promise<Array>} List of rooms
     */
    async getRooms(code) {
        const response = await fetch('/api/admin/rooms', {
            headers: { 'X-Admin-Code': code }
        });

        if (!response.ok) throw new Error('Failed to load rooms');
        
        const data = await response.json();
        return data.rooms;
    }

    /**
     * Create a new room.
     * @param {string} code 
     * @param {string} name 
     * @returns {Promise<void>}
     */
    async createRoom(code, name) {
        const response = await fetch('/api/admin/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Code': code
            },
            body: JSON.stringify({ name })
        });

        if (!response.ok) throw new Error('Failed to create room');
    }

    /**
     * Delete a room.
     * @param {string} code 
     * @param {string} roomId 
     * @returns {Promise<void>}
     */
    async deleteRoom(code, roomId) {
        const response = await fetch(`/api/admin/rooms/${roomId}`, {
            method: 'DELETE',
            headers: { 'X-Admin-Code': code }
        });

        if (!response.ok) throw new Error('Failed to delete room');
    }
}
