const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Heroku setzt den PORT automatisch
const PORT = process.env.PORT || 3000;

// Statische Dateien aus dem public Verzeichnis
app.use(express.static('public'));

// Spieler-Verwaltung
const players = new Map();

io.on('connection', (socket) => {
    console.log('Neuer Spieler verbunden:', socket.id);
    
    // Spieler hinzufügen
    players.set(socket.id, {
        id: socket.id,
        position: { x: 0, z: 0 },
        color: Math.floor(Math.random() * 0xFFFFFF)
    });
    
    // Bestehende Spieler an neuen Spieler senden
    socket.emit('playerJoined', {
        type: 'playerJoined',
        players: Array.from(players.values())
    });
    
    // Neuen Spieler an alle anderen senden
    socket.broadcast.emit('playerJoined', {
        type: 'playerJoined',
        playerId: socket.id,
        players: [players.get(socket.id)]
    });
    
    // Bewegung
    socket.on('move', (data) => {
        const player = players.get(socket.id);
        if (player) {
            player.position = data.position;
            socket.broadcast.emit('playerMoved', {
                type: 'playerMoved',
                playerId: socket.id,
                position: data.position
            });
        }
    });
    
    // Chat
    socket.on('chatMessage', (data) => {
        io.emit('chatMessage', {
            type: 'chatMessage',
            playerId: socket.id,
            message: data.message
        });
    });
    
    // Ping
    socket.on('ping', (data) => {
        socket.emit('pong', {
            type: 'pong',
            timestamp: data.timestamp
        });
    });
    
    // Zonen
    socket.on('zoneEnter', (data) => {
        socket.broadcast.emit('zoneEntered', {
            type: 'zoneEntered',
            playerId: socket.id,
            zoneIndex: data.zoneIndex
        });
    });
    
    socket.on('zoneExit', (data) => {
        socket.broadcast.emit('zoneExited', {
            type: 'zoneExited',
            playerId: socket.id,
            zoneIndex: data.zoneIndex
        });
    });
    
    // Trennung
    socket.on('disconnect', () => {
        console.log('Spieler getrennt:', socket.id);
        players.delete(socket.id);
        io.emit('playerLeft', {
            type: 'playerLeft',
            playerId: socket.id
        });
    });
});

// Heroku-spezifische Fehlerbehandlung
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Etwas ist schiefgelaufen!');
});

http.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
}); 