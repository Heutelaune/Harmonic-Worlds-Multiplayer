# Harmonic Worlds Multiplayer

Ein interaktives Multiplayer-Musikspiel, bei dem Spieler durch verschiedene Zonen navigieren und gemeinsam harmonische Klänge erzeugen können.

## Installation

1. Stelle sicher, dass Node.js (v14 oder höher) installiert ist
2. Klone das Repository
3. Installiere die Abhängigkeiten:
```bash
npm install
```

## Entwicklung

Starte den Entwicklungsserver mit:
```bash
npm run dev
```

Der Server wird auf Port 3000 gestartet. Öffne http://localhost:3000 im Browser.

## Produktion

Starte den Produktionsserver mit:
```bash
npm start
```

## Features

- Echtzeit-Multiplayer mit Socket.io
- Interaktive Musikzonen
- Chat-System
- Spieler-Bewegung und Kollision
- Harmonische Klangerzeugung basierend auf Spieler-Positionen
- Latenzmessung und Netzwerk-Statistiken

## Technologien

- Node.js
- Express
- Socket.io
- Three.js
- Web Audio API 