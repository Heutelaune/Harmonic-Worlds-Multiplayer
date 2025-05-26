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

// Web-Rooms Funktionalität
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('Neuer Client verbunden:', socket.id);

    // Web-Rooms Events
    socket.on('*enter-room*', (roomName) => {
        if (!rooms.has(roomName)) {
            rooms.set(roomName, new Set());
        }
        rooms.get(roomName).add(socket.id);
        socket.join(roomName);
        io.to(roomName).emit('*client-joined*', socket.id);
    });

    socket.on('*exit-room*', (roomName) => {
        if (rooms.has(roomName)) {
            rooms.get(roomName).delete(socket.id);
            if (rooms.get(roomName).size === 0) {
                rooms.delete(roomName);
            }
        }
        socket.leave(roomName);
        io.to(roomName).emit('*client-left*', socket.id);
    });

    socket.on('*broadcast-message*', (data) => {
        const { roomName, message } = data;
        io.to(roomName).emit('*message*', {
            sender: socket.id,
            message: message
        });
    });

    // Spiel-spezifische Events
    socket.on('move', (data) => {
        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            position: data.position
        });
    });

    socket.on('zoneEnter', (data) => {
        socket.broadcast.emit('playerEnteredZone', {
            id: socket.id,
            zoneIndex: data.zoneIndex
        });
    });

    socket.on('zoneExit', (data) => {
        socket.broadcast.emit('playerExitedZone', {
            id: socket.id,
            zoneIndex: data.zoneIndex
        });
    });

    socket.on('chat', (message) => {
        io.emit('chatMessage', {
            id: socket.id,
            message: message
        });
    });

    socket.on('disconnect', () => {
        console.log('Client getrennt:', socket.id);
        rooms.forEach((clients, roomName) => {
            if (clients.has(socket.id)) {
                clients.delete(socket.id);
                io.to(roomName).emit('*client-left*', socket.id);
                if (clients.size === 0) {
                    rooms.delete(roomName);
                }
            }
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