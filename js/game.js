class HarmonicWorldsMultiplayer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.audioContext = null;
        
        // Multiplayer
        this.socket = null;
        this.playerId = null;
        this.players = new Map();
        this.myPlayer = null;
        
        // Game world
        this.zones = [];
        this.activeZones = new Set();
        this.zoneOccupancy = new Map();
        
        // Controls
        this.keys = {};
        this.isStarted = false;
        this.lastMoveTime = 0;
        
        // Audio
        this.masterGain = null;
        this.oscillators = new Map();
        
        // Network stats
        this.messagesSent = 0;
        this.messagesReceived = 0;
        this.lastPingTime = 0;
        this.ping = 0;
        
        // Game state
        this.position = { x: 0, z: 0 };
        
        this.init();
    }
    
    init() {
        this.setupThreeJS();
        this.setupControls();
        this.createWorld();
        this.setupChat();
        this.animate();
        
        document.getElementById('startButton').addEventListener('click', () => {
            this.startGame();
        });
    }
    
    async startGame() {
        console.log('Starting multiplayer game...');
        
        try {
            await this.setupAudio();
            await this.connectToServer();
            this.createMyPlayer();
            document.getElementById('startButton').classList.add('hidden');
            this.isStarted = true;
            this.startHeartbeat();
            console.log('Multiplayer game started!');
        } catch (error) {
            console.error('Failed to start game:', error);
            this.updateConnectionStatus('disconnected', 'Connection Failed');
        }
    }
    
    async connectToServer() {
        return new Promise((resolve, reject) => {
            this.updateConnectionStatus('connecting', 'Verbinde mit Server...');
            
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('Mit Server verbunden');
                this.updateConnectionStatus('connected', 'Verbunden');
                
                // Generiere eine zufällige ID für den Spieler
                this.playerId = Math.random().toString(36).substr(2, 9);
                document.getElementById('playerId').textContent = this.playerId.substr(0, 4);
                
                resolve();
            });
            
            this.socket.on('disconnect', () => {
                console.log('Vom Server getrennt');
                this.updateConnectionStatus('disconnected', 'Getrennt');
            });
            
            this.socket.on('error', (error) => {
                console.error('Socket Fehler:', error);
                this.updateConnectionStatus('disconnected', 'Fehler bei der Verbindung');
                reject(error);
            });
            
            // Timeout nach 10 Sekunden
            setTimeout(() => {
                if (!this.socket.connected) {
                    this.socket.close();
                    reject(new Error('Verbindungs-Timeout'));
                }
            }, 10000);
        });
    }
    
    setupThreeJS() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a1e);
        this.scene.fog = new THREE.Fog(0x0a0a1e, 20, 100);
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 12, 18);
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: document.getElementById('gameCanvas'),
            antialias: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(20, 20, 10);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
    }
    
    async setupAudio() {
        console.log('Setting up audio...');
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = 0.2;
            
            document.getElementById('audioStatus').textContent = 'Ready';
            console.log('Audio setup complete');
            
        } catch (error) {
            console.error('Audio setup failed:', error);
            throw error;
        }
    }
    
    setupControls() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            this.updateDebugInfo();
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            this.updateDebugInfo();
        });
        
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    setupChat() {
        const chatInput = document.getElementById('chatInput');
        
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && chatInput.value.trim()) {
                this.sendChatMessage(chatInput.value.trim());
                chatInput.value = '';
            }
        });
        
        chatInput.addEventListener('focus', () => {
            this.keys = {};
        });
    }
    
    createWorld() {
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x2a2a4e,
            transparent: true,
            opacity: 0.8
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        this.createZones();
    }
    
    createZones() {
        const zoneData = [
            { name: 'Red Zone', color: 0xff6b6b, pos: [-15, 0, -15], freq: 261.63 },
            { name: 'Green Zone', color: 0x4ecdc4, pos: [15, 0, -15], freq: 329.63 },
            { name: 'Blue Zone', color: 0x45b7d1, pos: [-15, 0, 15], freq: 392.00 },
            { name: 'Yellow Zone', color: 0xf9ca24, pos: [15, 0, 15], freq: 523.25 },
            { name: 'Purple Zone', color: 0x6c5ce7, pos: [0, 0, 0], freq: 440.00 }
        ];
        
        zoneData.forEach((zone, index) => {
            const geometry = new THREE.CylinderGeometry(6, 6, 0.5, 32);
            const material = new THREE.MeshLambertMaterial({ 
                color: zone.color,
                transparent: true,
                opacity: 0.7,
                emissive: zone.color,
                emissiveIntensity: 0.1
            });
            const platform = new THREE.Mesh(geometry, material);
            platform.position.set(zone.pos[0], zone.pos[1], zone.pos[2]);
            platform.castShadow = true;
            this.scene.add(platform);
            
            const light = new THREE.PointLight(zone.color, 0.5, 15);
            light.position.set(zone.pos[0], zone.pos[1] + 8, zone.pos[2]);
            this.scene.add(light);
            
            this.zones.push({
                name: zone.name,
                color: zone.color,
                position: new THREE.Vector3(zone.pos[0], zone.pos[1], zone.pos[2]),
                frequency: zone.freq,
                radius: 6,
                mesh: platform,
                light: light
            });
            
            this.zoneOccupancy.set(index, new Set());
        });
    }
    
    createMyPlayer() {
        const group = new THREE.Group();
        
        const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.5, 1.5, 12);
        const bodyMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xff69b4,
            emissive: 0xff69b4,
            emissiveIntensity: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.75;
        group.add(body);
        
        const headGeometry = new THREE.SphereGeometry(0.35, 12, 8);
        const head = new THREE.Mesh(headGeometry, bodyMaterial);
        head.position.y = 1.8;
        group.add(head);
        
        this.createNameTag(group, 'You', 0xff69b4);
        
        this.myPlayer = group;
        this.myPlayer.position.set(0, 0, 5);
        this.myPlayer.castShadow = true;
        this.scene.add(this.myPlayer);
    }
    
    createOtherPlayer(playerData) {
        const group = new THREE.Group();
        
        const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.5, 1.5, 12);
        const bodyMaterial = new THREE.MeshLambertMaterial({ 
            color: playerData.color,
            emissive: playerData.color,
            emissiveIntensity: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.75;
        group.add(body);
        
        const headGeometry = new THREE.SphereGeometry(0.35, 12, 8);
        const head = new THREE.Mesh(headGeometry, bodyMaterial);
        head.position.y = 1.8;
        group.add(head);
        
        this.createNameTag(group, playerData.name || playerData.id.substr(0, 4), playerData.color);
        
        group.position.set(playerData.position.x, 0, playerData.position.z);
        group.castShadow = true;
        this.scene.add(group);
        
        this.players.set(playerData.id, {
            mesh: group,
            data: playerData,
            targetPosition: { x: playerData.position.x, z: playerData.position.z }
        });
    }
    
    createNameTag(parentGroup, name, color) {
        const tagGeometry = new THREE.SphereGeometry(0.1, 8, 6);
        const tagMaterial = new THREE.MeshBasicMaterial({ 
            color: color,
            transparent: true,
            opacity: 0.8
        });
        const tag = new THREE.Mesh(tagGeometry, tagMaterial);
        tag.position.y = 2.5;
        parentGroup.add(tag);
    }
    
    updatePlayer() {
        if (!this.isStarted || !this.myPlayer) return;
        
        const speed = 0.2;
        let moved = false;
        
        if (this.keys['KeyW'] || this.keys['ArrowUp']) {
            this.position.z -= speed;
            moved = true;
        }
        if (this.keys['KeyS'] || this.keys['ArrowDown']) {
            this.position.z += speed;
            moved = true;
        }
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
            this.position.x -= speed;
            moved = true;
        }
        if (this.keys['KeyD'] || this.keys['ArrowRight']) {
            this.position.x += speed;
            moved = true;
        }
        
        this.position.x = Math.max(-40, Math.min(40, this.position.x));
        this.position.z = Math.max(-40, Math.min(40, this.position.z));
        
        this.myPlayer.position.x = this.position.x;
        this.myPlayer.position.z = this.position.z;
        this.myPlayer.position.y = 0;
        
        if (moved) {
            this.updateDebugInfo();
            
            const now = Date.now();
            if (now - this.lastMoveTime > 100) {
                this.socket.emit('move', { position: this.position });
                this.lastMoveTime = now;
            }
        }
        
        this.players.forEach(player => {
            if (player.targetPosition) {
                const current = player.mesh.position;
                const target = player.targetPosition;
                
                const lerpFactor = 0.1;
                current.x += (target.x - current.x) * lerpFactor;
                current.z += (target.z - current.z) * lerpFactor;
            }
        });
        
        this.updateCamera();
        this.checkZoneInteractions();
    }
    
    updateCamera() {
        if (!this.myPlayer) return;
        
        const cameraOffset = new THREE.Vector3(0, 12, 18);
        const targetPosition = this.myPlayer.position.clone().add(cameraOffset);
        
        this.camera.position.lerp(targetPosition, 0.05);
        this.camera.lookAt(this.myPlayer.position);
    }
    
    checkZoneInteractions() {
        if (!this.myPlayer) return;
        
        const playerPos = this.myPlayer.position;
        const currentActiveZones = new Set();
        
        this.zones.forEach((zone, index) => {
            const distance = playerPos.distanceTo(zone.position);
            
            if (distance < zone.radius) {
                currentActiveZones.add(index);
                
                if (!this.activeZones.has(index)) {
                    this.enterZone(zone, index);
                }
            } else {
                if (this.activeZones.has(index)) {
                    this.exitZone(zone, index);
                }
            }
        });
        
        this.activeZones = currentActiveZones;
        
        if (this.activeZones.size > 0) {
            const zoneIndex = Array.from(this.activeZones)[0];
            const zone = this.zones[zoneIndex];
            const occupantCount = this.zoneOccupancy.get(zoneIndex).size;
            this.showZoneInfo(zone, occupantCount);
            document.getElementById('currentZone').textContent = zone.name;
        } else {
            this.hideZoneInfo();
            document.getElementById('currentZone').textContent = 'None';
        }
    }
    
    enterZone(zone, index) {
        console.log('Entered zone:', zone.name);
        
        this.zoneOccupancy.get(index).add(this.playerId);
        
        if (this.audioContext && this.audioContext.state === 'running') {
            this.createZoneAudio(zone, index);
        }
        
        const occupantCount = this.zoneOccupancy.get(index).size;
        zone.mesh.material.emissiveIntensity = Math.min(0.8, 0.2 + occupantCount * 0.2);
        zone.light.intensity = Math.min(2.0, 0.5 + occupantCount * 0.3);
        
        this.socket.emit('zoneEnter', { zoneIndex: index });
    }
    
    exitZone(zone, index) {
        console.log('Exited zone:', zone.name);
        
        this.zoneOccupancy.get(index).delete(this.playerId);
        
        this.stopZoneAudio(index);
        
        const occupantCount = this.zoneOccupancy.get(index).size;
        zone.mesh.material.emissiveIntensity = Math.max(0.1, occupantCount * 0.2);
        zone.light.intensity = Math.max(0.3, occupantCount * 0.3);
        
        this.socket.emit('zoneExit', { zoneIndex: index });
    }
    
    createZoneAudio(zone, index) {
        if (!this.audioContext || this.oscillators.has(index)) return;
        
        try {
            const occupantCount = this.zoneOccupancy.get(index).size;
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(zone.frequency, this.audioContext.currentTime);
            
            const harmonies = [];
            if (occupantCount > 1) {
                const harmonyFreqs = [
                    zone.frequency * 1.25,
                    zone.frequency * 1.5,
                    zone.frequency * 2
                ];
                
                for (let i = 0; i < Math.min(occupantCount - 1, 3); i++) {
                    const harmonyOsc = this.audioContext.createOscillator();
                    const harmonyGain = this.audioContext.createGain();
                    
                    harmonyOsc.type = 'triangle';
                    harmonyOsc.frequency.setValueAtTime(harmonyFreqs[i], this.audioContext.currentTime);
                    
                    harmonyGain.gain.setValueAtTime(0, this.audioContext.currentTime);
                    harmonyGain.gain.linearRampToValueAtTime(0.2, this.audioContext.currentTime + 0.5);
                    
                    harmonyOsc.connect(harmonyGain);
                    harmonyGain.connect(this.masterGain);
                    harmonyOsc.start();
                    
                    harmonies.push({ oscillator: harmonyOsc, gainNode: harmonyGain });
                }
            }
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.5);
            
            oscillator.connect(gainNode);
            gainNode.connect(this.masterGain);
            oscillator.start();
            
            this.oscillators.set(index, { 
                oscillator, 
                gainNode, 
                harmonies 
            });
            
        } catch (error) {
            console.error('Failed to create audio:', error);
        }
    }
    
    stopZoneAudio(index) {
        if (!this.audioContext) return;
        
        const audioNodes = this.oscillators.get(index);
        
        if (audioNodes) {
            const { oscillator, gainNode, harmonies } = audioNodes;
            
            try {
                gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.3);
                
                if (harmonies) {
                    harmonies.forEach(harmony => {
                        harmony.gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.3);
                    });
                }
                
                setTimeout(() => {
                    try {
                        oscillator.stop();
                        if (harmonies) {
                            harmonies.forEach(harmony => harmony.oscillator.stop());
                        }
                    } catch (e) {
                        // Oscillators might already be stopped
                    }
                    this.oscillators.delete(index);
                }, 400);
                
            } catch (error) {
                console.error('Failed to stop audio:', error);
                this.oscillators.delete(index);
            }
        }
    }
    
    showZoneInfo(zone, occupantCount) {
        const zoneInfo = document.getElementById('zoneInfo');
        const zoneName = document.getElementById('zoneName');
        const zoneDescription = document.getElementById('zoneDescription');
        
        zoneName.textContent = zone.name;
        
        let description = `♪ ${zone.frequency.toFixed(1)} Hz ♪`;
        if (occupantCount > 1) {
            description += ` • ${occupantCount} players creating harmony!`;
        } else {
            description += ` • Solo performance`;
        }
        
        zoneDescription.textContent = description;
        
        if (!zoneInfo.classList.contains('visible')) {
            zoneInfo.classList.add('visible');
        }
    }
    
    hideZoneInfo() {
        const zoneInfo = document.getElementById('zoneInfo');
        zoneInfo.classList.remove('visible');
    }
    
    updateConnectionStatus(status, text) {
        const indicator = document.querySelector('.status-indicator');
        const connectionText = document.getElementById('connectionText');
        
        indicator.className = `status-indicator ${status}`;
        connectionText.textContent = text;
    }
    
    updateDebugInfo() {
        const activeKeys = Object.keys(this.keys).filter(key => this.keys[key]);
        document.getElementById('activeKeys').textContent = activeKeys.length > 0 ? activeKeys.join(', ') : '-';
        document.getElementById('playerPos').textContent = `${this.position.x.toFixed(1)}, ${this.position.z.toFixed(1)}`;
    }
    
    startHeartbeat() {
        setInterval(() => {
            if (this.socket && this.socket.connected) {
                this.lastPingTime = Date.now();
                this.socket.emit('ping', { timestamp: this.lastPingTime });
            }
        }, 3000);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.updatePlayer();
        
        this.zones.forEach((zone, index) => {
            const time = Date.now() * 0.001;
            zone.mesh.position.y = Math.sin(time + index) * 0.1;
            zone.light.position.y = 8 + Math.sin(time + index) * 0.2;
        });
        
        this.renderer.render(this.scene, this.camera);
    }
}

console.log('Initialisiere Harmonic Worlds Multiplayer...');
const game = new HarmonicWorldsMultiplayer(); 