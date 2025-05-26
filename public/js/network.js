class NetworkManager {
    constructor() {
        this.socket = null;
        this.roomName = 'harmonic-worlds';
        this.playerId = null;
        this.connected = false;
        this.eventHandlers = new Map();
    }

    connect() {
        return new Promise((resolve, reject) => {
            // Verbindung zum Render.com Server
            this.socket = io('https://harmonic-worlds.onrender.com', {
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: 5
            });

            this.socket.on('connect', () => {
                this.connected = true;
                this.joinRoom();
                resolve();
            });

            this.socket.on('disconnect', () => {
                this.connected = false;
                this.triggerEvent('disconnect');
            });

            this.socket.on('*client-joined*', (clientId) => {
                this.triggerEvent('playerJoined', { id: clientId });
            });

            this.socket.on('*client-left*', (clientId) => {
                this.triggerEvent('playerLeft', { id: clientId });
            });

            this.socket.on('playerMoved', (data) => {
                this.triggerEvent('playerMoved', data);
            });

            this.socket.on('playerEnteredZone', (data) => {
                this.triggerEvent('playerEnteredZone', data);
            });

            this.socket.on('playerExitedZone', (data) => {
                this.triggerEvent('playerExitedZone', data);
            });

            this.socket.on('chatMessage', (data) => {
                this.triggerEvent('chatMessage', data);
            });

            this.socket.on('*message*', (data) => {
                this.triggerEvent('roomMessage', data);
            });
        });
    }

    joinRoom() {
        if (this.socket && this.connected) {
            this.socket.emit('*enter-room*', this.roomName);
        }
    }

    leaveRoom() {
        if (this.socket && this.connected) {
            this.socket.emit('*exit-room*', this.roomName);
        }
    }

    move(position) {
        if (this.socket && this.connected) {
            this.socket.emit('move', { position });
        }
    }

    sendChatMessage(message) {
        if (this.socket && this.connected) {
            this.socket.emit('chat', message);
        }
    }

    enterZone(zoneIndex) {
        if (this.socket && this.connected) {
            this.socket.emit('zoneEnter', { zoneIndex });
        }
    }

    exitZone(zoneIndex) {
        if (this.socket && this.connected) {
            this.socket.emit('zoneExit', { zoneIndex });
        }
    }

    broadcastMessage(message) {
        if (this.socket && this.connected) {
            this.socket.emit('*broadcast-message*', {
                roomName: this.roomName,
                message: message
            });
        }
    }

    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(handler);
    }

    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).delete(handler);
        }
    }

    triggerEvent(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => handler(data));
        }
    }

    disconnect() {
        if (this.socket) {
            this.leaveRoom();
            this.socket.disconnect();
        }
    }
}

// Globale Instanz erstellen
window.networkManager = new NetworkManager(); 
} 