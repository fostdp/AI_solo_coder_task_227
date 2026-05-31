class MusicRhythmGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.keyMap = { 'd': 0, 'f': 1, 'j': 2, 'k': 3 };
        this.laneColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'];
        this.perfectThreshold = 80;
        this.goodThreshold = 150;
        this.noteSpeed = 400;
        this.judgmentLineX = 150;
        this.holdThreshold = 200;
        this.maxRetries = 3;
        this.retryDelay = 1000;
        this.localStorageKey = 'rhythm_game_pending_scores';
        this.userId = localStorage.getItem('rhythm_user_id') || this.generateUserId();
        localStorage.setItem('rhythm_user_id', this.userId);
        
        this.userData = null;
        this.skins = { note: {}, background: {} };
        this.currentSkin = { note: 'default', background: 'default' };
        this.ws = null;
        this.isBattleMode = false;
        this.currentRoomId = null;
        this.opponentData = { score: 0, combo: 0, name: '对手' };
        this.battleResult = null;
        
        this.gameState = {
            isPlaying: false,
            isAudioReady: false,
            startTime: 0,
            currentTime: 0,
            notes: [],
            activeNotes: [],
            score: 0,
            combo: 0,
            maxCombo: 0,
            perfect: 0,
            good: 0,
            miss: 0,
            currentSong: null,
            audioContext: null,
            audioBuffer: null,
            audioSource: null
        };
        
        this.holdStates = {
            0: { isHolding: false, startTime: null, currentNote: null },
            1: { isHolding: false, startTime: null, currentNote: null },
            2: { isHolding: false, startTime: null, currentNote: null },
            3: { isHolding: false, startTime: null, currentNote: null }
        };
        
        this.initCanvas();
        this.bindEvents();
        this.initApp();
    }
    
    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    initCanvas() {
        this.canvas.width = 800;
        this.canvas.height = 500;
    }
    
    async initApp() {
        await Promise.all([
            this.loadUser(),
            this.loadSkins(),
            this.loadSongs()
        ]);
        this.processPendingScores();
        this.bindNavEvents();
    }
    
    bindEvents() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
        
        document.getElementById('back-to-menu').addEventListener('click', () => {
            this.stopAudio();
            this.disconnectWebSocket();
            this.showScreen('menu-screen');
        });
    }
    
    bindNavEvents() {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
                
                if (tab.dataset.tab === 'battle') {
                    this.loadRoomList();
                }
            });
        });
        
        document.querySelectorAll('.shop-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.shop-content').forEach(c => c.classList.add('hidden'));
                document.getElementById('shop-' + tab.dataset.shop).classList.remove('hidden');
            });
        });
        
        document.getElementById('import-btn').addEventListener('click', () => this.importMIDI());
        document.getElementById('create-room-btn').addEventListener('click', () => this.createBattleRoom());
        document.getElementById('join-room-btn').addEventListener('click', () => this.joinBattleRoom());
        document.getElementById('ready-btn').addEventListener('click', () => this.markReady());
        document.getElementById('leave-room-btn').addEventListener('click', () => this.leaveBattleRoom());
    }
    
    async loadUser() {
        try {
            const response = await fetch(`/api/users/${this.userId}`);
            this.userData = await response.json();
            this.currentSkin = { ...this.userData.currentSkin };
            document.getElementById('user-score').textContent = `积分: ${this.userData.totalScore}`;
        } catch (error) {
            console.error('加载用户数据失败:', error);
        }
    }
    
    async loadSkins() {
        try {
            const response = await fetch('/api/skins');
            this.skins = await response.json();
            this.renderShop();
        } catch (error) {
            console.error('加载皮肤数据失败:', error);
        }
    }
    
    renderShop() {
        this.renderNoteSkins();
        this.renderBackgroundSkins();
    }
    
    renderNoteSkins() {
        const container = document.getElementById('shop-note');
        container.innerHTML = '';
        
        Object.values(this.skins.note).forEach(skin => {
            const owned = this.userData?.unlockedSkins?.note?.includes(skin.id);
            const selected = this.currentSkin.note === skin.id;
            
            const card = document.createElement('div');
            card.className = `skin-card ${selected ? 'selected' : ''}`;
            
            let colorsHtml = '';
            skin.colors.forEach((color, i) => {
                colorsHtml += `<div class="color-preview" style="background: ${color}; ${skin.glow ? 'box-shadow: 0 0 10px ' + color : ''}"></div>`;
            });
            
            card.innerHTML = `
                <div class="skin-colors">${colorsHtml}</div>
                <div class="skin-info">
                    <div class="skin-name">${skin.name}</div>
                    <div class="skin-price">${skin.price === 0 ? '免费' : `${skin.price} 积分`}</div>
                </div>
                <div class="skin-actions">
                    ${owned ? 
                        (selected ? '<span class="text-success">使用中</span>' : 
                            `<button class="btn btn-sm" data-action="select" data-category="note" data-id="${skin.id}">使用</button>`) :
                        `<button class="btn btn-sm ${this.userData?.totalScore >= skin.price ? 'btn-primary' : ''}" data-action="unlock" data-category="note" data-id="${skin.id}" ${this.userData?.totalScore < skin.price ? 'disabled' : ''}>解锁</button>`
                    }
                </div>
            `;
            
            container.appendChild(card);
        });
        
        this.bindSkinActions(container);
    }
    
    renderBackgroundSkins() {
        const container = document.getElementById('shop-background');
        container.innerHTML = '';
        
        Object.values(this.skins.background).forEach(skin => {
            const owned = this.userData?.unlockedSkins?.background?.includes(skin.id);
            const selected = this.currentSkin.background === skin.id;
            
            const card = document.createElement('div');
            card.className = `skin-card ${selected ? 'selected' : ''}`;
            
            card.innerHTML = `
                <div class="skin-bg-preview" style="background: ${skin.style}"></div>
                <div class="skin-info">
                    <div class="skin-name">${skin.name}</div>
                    <div class="skin-price">${skin.price === 0 ? '免费' : `${skin.price} 积分`}</div>
                </div>
                <div class="skin-actions">
                    ${owned ? 
                        (selected ? '<span class="text-success">使用中</span>' : 
                            `<button class="btn btn-sm" data-action="select" data-category="background" data-id="${skin.id}">使用</button>`) :
                        `<button class="btn btn-sm ${this.userData?.totalScore >= skin.price ? 'btn-primary' : ''}" data-action="unlock" data-category="background" data-id="${skin.id}" ${this.userData?.totalScore < skin.price ? 'disabled' : ''}>解锁</button>`
                    }
                </div>
            `;
            
            container.appendChild(card);
        });
        
        this.bindSkinActions(container);
    }
    
    bindSkinActions(container) {
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const action = btn.dataset.action;
                const category = btn.dataset.category;
                const skinId = btn.dataset.id;
                
                if (action === 'unlock') {
                    await this.unlockSkin(category, skinId);
                } else if (action === 'select') {
                    await this.selectSkin(category, skinId);
                }
            });
        });
    }
    
    async unlockSkin(category, skinId) {
        try {
            const response = await fetch(`/api/users/${this.userId}/skins/unlock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, skinId })
            });
            
            const result = await response.json();
            if (result.success) {
                this.userData = result.user;
                document.getElementById('user-score').textContent = `积分: ${this.userData.totalScore}`;
                this.renderShop();
                alert('解锁成功！');
            } else {
                alert(result.error || '解锁失败');
            }
        } catch (error) {
            console.error('解锁皮肤失败:', error);
            alert('解锁失败');
        }
    }
    
    async selectSkin(category, skinId) {
        try {
            const response = await fetch(`/api/users/${this.userId}/skins/select`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, skinId })
            });
            
            const result = await response.json();
            if (result.success) {
                this.userData = result.user;
                this.currentSkin = { ...this.userData.currentSkin };
                this.renderShop();
            }
        } catch (error) {
            console.error('选择皮肤失败:', error);
        }
    }
    
    applySkinStyles() {
        const noteSkin = this.skins.note[this.currentSkin.note];
        if (noteSkin && noteSkin.colors) {
            this.laneColors = [...noteSkin.colors];
        }
        
        const bgSkin = this.skins.background[this.currentSkin.background];
        if (bgSkin && bgSkin.style) {
            document.getElementById('game-screen').style.background = bgSkin.style;
        }
    }
    
    async loadSongs() {
        try {
            const response = await fetch('/api/songs');
            const songs = await response.json();
            this.renderSongList(songs);
        } catch (error) {
            console.error('加载歌曲列表失败:', error);
        }
    }
    
    renderSongList(songs) {
        const songList = document.getElementById('song-list');
        songList.innerHTML = '';
        
        songs.forEach(song => {
            const songCard = document.createElement('div');
            songCard.className = 'song-card' + (song.isCustom ? ' custom-song' : '');
            songCard.innerHTML = `
                <div class="song-info">
                    <h3>${song.name}</h3>
                    <p>BPM: ${song.bpm}</p>
                    <div class="difficulty">${song.difficulty}</div>
                </div>
                ${song.isCustom ? `<button class="btn btn-delete" data-id="${song.id}">删除</button>` : ''}
            `;
            
            songCard.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-delete')) {
                    this.deleteSong(song.id);
                } else {
                    this.startGame(song.id);
                }
            });
            
            songList.appendChild(songCard);
        });
    }
    
    async deleteSong(songId) {
        if (!confirm('确定要删除这首自定义歌曲吗？')) return;
        
        try {
            await fetch(`/api/songs/${songId}`, { method: 'DELETE' });
            this.loadSongs();
        } catch (error) {
            console.error('删除歌曲失败:', error);
        }
    }
    
    async importMIDI() {
        const name = document.getElementById('import-name').value.trim();
        const fileInput = document.getElementById('midi-file');
        const difficulty = document.getElementById('import-difficulty').value;
        const bpm = document.getElementById('import-bpm').value;
        
        if (!name) {
            alert('请输入歌曲名称');
            return;
        }
        
        if (!fileInput.files || fileInput.files.length === 0) {
            alert('请选择MIDI文件');
            return;
        }
        
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('midi', file);
        formData.append('name', name);
        formData.append('difficulty', difficulty);
        if (bpm) formData.append('bpm', bpm);
        
        try {
            this.showLoadingMessage('正在处理MIDI文件...');
            
            const response = await fetch('/api/midi/upload', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            this.hideLoadingMessage();
            
            if (result.success) {
                alert('歌曲导入成功！');
                this.loadSongs();
                document.querySelectorAll('.nav-tab')[0].click();
                document.getElementById('import-name').value = '';
                fileInput.value = '';
                document.getElementById('import-bpm').value = '';
            } else {
                alert(result.error || '导入失败');
            }
        } catch (error) {
            this.hideLoadingMessage();
            console.error('导入MIDI失败:', error);
            alert('导入失败: ' + error.message);
        }
    }
    
    async loadRoomList() {
        try {
            const response = await fetch('/api/rooms');
            const rooms = await response.json();
            this.renderRoomList(rooms);
        } catch (error) {
            console.error('加载房间列表失败:', error);
        }
    }
    
    renderRoomList(rooms) {
        const container = document.getElementById('room-list');
        
        if (rooms.length === 0) {
            container.innerHTML = '<p class="no-rooms">暂无在线房间，创建一个吧！</p>';
            return;
        }
        
        container.innerHTML = '';
        rooms.forEach(room => {
            const roomCard = document.createElement('div');
            roomCard.className = 'room-card';
            roomCard.innerHTML = `
                <div class="room-info">
                    <span class="room-id-label">房间号: ${room.id}</span>
                    <span class="room-status">${room.status === 'waiting' ? '等待中' : '游戏中'}</span>
                </div>
                <div class="room-players">${room.playerCount}/2 人</div>
                ${room.playerCount < 2 && room.status === 'waiting' ? 
                    `<button class="btn btn-sm" data-room="${room.id}">加入</button>` : ''}
            `;
            
            const btn = roomCard.querySelector('[data-room]');
            if (btn) {
                btn.addEventListener('click', () => {
                    document.getElementById('room-id-input').value = room.id;
                    this.joinBattleRoom();
                });
            }
            
            container.appendChild(roomCard);
        });
    }
    
    connectWebSocket() {
        const wsUrl = `ws://${window.location.host}`;
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket连接成功');
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('解析WebSocket消息失败:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket连接已关闭');
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket错误:', error);
        };
    }
    
    disconnectWebSocket() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isBattleMode = false;
        this.currentRoomId = null;
    }
    
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'room_created':
                this.currentRoomId = data.roomId;
                this.showRoomScreen(data.players);
                break;
            case 'player_joined':
                this.updateRoomPlayers(data.players);
                break;
            case 'player_left':
                this.updateRoomPlayers(data.players);
                break;
            case 'player_ready':
                this.updateRoomPlayers(data.players);
                break;
            case 'game_start':
                this.startBattleGame(data.startTime);
                break;
            case 'opponent_update':
                this.opponentData.score = data.score;
                this.opponentData.combo = data.combo;
                this.updateOpponentUI();
                break;
            case 'battle_end':
                this.handleBattleEnd(data.players);
                break;
            case 'error':
                alert(data.message);
                break;
        }
    }
    
    createBattleRoom() {
        const playerName = document.getElementById('player-name').value.trim() || '玩家1';
        
        if (!this.gameState.currentSong) {
            alert('请先选择一首歌曲！在"曲库"标签页点击任意歌曲来选择。');
            return;
        }
        
        this.connectWebSocket();
        
        this.ws.onopen = () => {
            this.ws.send(JSON.stringify({
                type: 'create_room',
                songId: this.gameState.currentSong.id,
                playerName
            }));
        };
    }
    
    joinBattleRoom() {
        const roomId = document.getElementById('room-id-input').value.trim().toUpperCase();
        const playerName = document.getElementById('player-name').value.trim() || '玩家2';
        
        if (!roomId) {
            alert('请输入房间号');
            return;
        }
        
        this.connectWebSocket();
        
        this.ws.onopen = () => {
            this.ws.send(JSON.stringify({
                type: 'join_room',
                roomId,
                playerName
            }));
        };
    }
    
    leaveBattleRoom() {
        if (this.ws && this.currentRoomId) {
            this.ws.send(JSON.stringify({
                type: 'leave_room',
                roomId: this.currentRoomId
            }));
        }
        this.disconnectWebSocket();
        this.showScreen('menu-screen');
    }
    
    markReady() {
        if (this.ws && this.currentRoomId) {
            this.ws.send(JSON.stringify({
                type: 'ready',
                roomId: this.currentRoomId
            }));
            
            document.getElementById('ready-btn').textContent = '已准备';
            document.getElementById('ready-btn').disabled = true;
        }
    }
    
    showRoomScreen(players) {
        this.currentRoomId = players[0].userId === this.ws.userId ? this.currentRoomId : players[0].userId;
        document.getElementById('current-room-id').textContent = this.currentRoomId;
        this.updateRoomPlayers(players);
        this.showScreen('room-screen');
    }
    
    updateRoomPlayers(players) {
        document.getElementById('current-room-id').textContent = this.currentRoomId;
        
        const myPlayer = players.find(p => p.userId === this.ws.userId);
        const otherPlayer = players.find(p => p.userId !== this.ws.userId);
        
        document.getElementById('player1-name').textContent = myPlayer ? myPlayer.name : '等待玩家...';
        document.getElementById('player1-status').textContent = myPlayer ? (myPlayer.ready ? '✅ 已准备' : '等待准备') : '';
        document.getElementById('player1').classList.toggle('me', true);
        
        document.getElementById('player2-name').textContent = otherPlayer ? otherPlayer.name : '等待玩家...';
        document.getElementById('player2-status').textContent = otherPlayer ? (otherPlayer.ready ? '✅ 已准备' : '等待准备') : '';
        document.getElementById('player2').classList.toggle('opponent', !!otherPlayer);
        
        if (otherPlayer && otherPlayer.name) {
            this.opponentData.name = otherPlayer.name;
        }
    }
    
    async startBattleGame(startTime) {
        this.isBattleMode = true;
        this.battleResult = null;
        
        await this.prepareAudio();
        this.resetGameState();
        this.resetHoldStates();
        
        document.getElementById('battle-overlay').classList.remove('hidden');
        this.updateOpponentUI();
        
        this.showScreen('game-screen');
        document.getElementById('current-song').textContent = this.gameState.currentSong.name;
        
        this.gameState.isPlaying = true;
        this.gameState.startTime = performance.now();
        this.startAudio();
        this.gameLoop();
    }
    
    updateOpponentUI() {
        document.getElementById('opponent-name').textContent = this.opponentData.name;
        document.getElementById('opponent-score').textContent = this.opponentData.score;
        document.getElementById('opponent-combo').textContent = this.opponentData.combo + '连击';
    }
    
    handleBattleEnd(players) {
        const myPlayer = players.find(p => p.userId === this.ws.userId);
        const otherPlayer = players.find(p => p.userId !== this.ws.userId);
        
        if (otherPlayer) {
            this.battleResult = {
                myScore: myPlayer?.score || this.gameState.score,
                opponentScore: otherPlayer.score,
                opponentName: otherPlayer.name
            };
        }
        
        if (this.gameState.isPlaying) {
            this.endGame();
        }
    }
    
    async startGame(songId) {
        try {
            this.showLoadingMessage('加载歌曲中...');
            
            const response = await fetch(`/api/songs/${songId}`);
            this.gameState.currentSong = await response.json();
            
            this.showLoadingMessage('准备音频...');
            await this.prepareAudio();
            
            this.applySkinStyles();
            this.resetGameState();
            this.resetHoldStates();
            this.hideLoadingMessage();
            
            this.showScreen('game-screen');
            document.getElementById('current-song').textContent = this.gameState.currentSong.name;
            document.getElementById('battle-overlay').classList.add('hidden');
            
            setTimeout(() => this.beginGame(), 500);
        } catch (error) {
            console.error('加载歌曲失败:', error);
            this.hideLoadingMessage();
            alert('加载歌曲失败: ' + error.message);
        }
    }
    
    async prepareAudio() {
        if (!this.gameState.currentSong.audioUrl) {
            this.gameState.isAudioReady = true;
            return;
        }
        
        try {
            if (!this.gameState.audioContext) {
                this.gameState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            const audioResponse = await fetch(this.gameState.currentSong.audioUrl);
            const arrayBuffer = await audioResponse.arrayBuffer();
            
            this.showLoadingMessage('解码音频中...');
            this.gameState.audioBuffer = await this.gameState.audioContext.decodeAudioData(arrayBuffer);
            
            this.gameState.isAudioReady = true;
        } catch (error) {
            console.warn('音频加载失败，游戏将继续但无音频:', error);
            this.gameState.isAudioReady = true;
        }
    }
    
    showLoadingMessage(message) {
        let loadingDiv = document.getElementById('loading-message');
        if (!loadingDiv) {
            loadingDiv = document.createElement('div');
            loadingDiv.id = 'loading-message';
            loadingDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px 40px;
                border-radius: 10px;
                font-size: 1.2em;
                z-index: 9999;
            `;
            document.body.appendChild(loadingDiv);
        }
        loadingDiv.textContent = message;
    }
    
    hideLoadingMessage() {
        const loadingDiv = document.getElementById('loading-message');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }
    
    resetGameState() {
        this.gameState = {
            ...this.gameState,
            isPlaying: false,
            startTime: 0,
            currentTime: 0,
            notes: [...this.gameState.currentSong.notes],
            activeNotes: [],
            score: 0,
            combo: 0,
            maxCombo: 0,
            perfect: 0,
            good: 0,
            miss: 0
        };
        this.opponentData = { score: 0, combo: 0, name: '对手' };
        this.updateUI();
    }
    
    resetHoldStates() {
        for (let lane = 0; lane < 4; lane++) {
            this.holdStates[lane] = {
                isHolding: false,
                startTime: null,
                currentNote: null
            };
        }
    }
    
    beginGame() {
        if (!this.gameState.isAudioReady) {
            setTimeout(() => this.beginGame(), 100);
            return;
        }
        
        this.gameState.isPlaying = true;
        this.gameState.startTime = performance.now();
        this.startAudio();
        this.gameLoop();
    }
    
    startAudio() {
        if (this.gameState.audioBuffer && this.gameState.audioContext) {
            this.gameState.audioSource = this.gameState.audioContext.createBufferSource();
            this.gameState.audioSource.buffer = this.gameState.audioBuffer;
            this.gameState.audioSource.connect(this.gameState.audioContext.destination);
            this.gameState.audioSource.start(0);
        }
    }
    
    stopAudio() {
        if (this.gameState.audioSource) {
            try {
                this.gameState.audioSource.stop();
            } catch (e) {}
            this.gameState.audioSource = null;
        }
    }
    
    gameLoop() {
        if (!this.gameState.isPlaying) return;
        
        this.gameState.currentTime = performance.now() - this.gameState.startTime;
        this.updateHoldStates();
        this.updateNotes();
        this.render();
        this.checkGameEnd();
        
        if (this.isBattleMode && this.ws && this.ws.readyState === 1) {
            this.ws.send(JSON.stringify({
                type: 'game_update',
                score: this.gameState.score,
                combo: this.gameState.combo
            }));
        }
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    updateHoldStates() {
        for (let lane = 0; lane < 4; lane++) {
            const holdState = this.holdStates[lane];
            if (holdState.isHolding && holdState.currentNote) {
                const note = holdState.currentNote;
                if (note.isHold && note.holdEndTime) {
                    if (this.gameState.currentTime >= note.holdEndTime) {
                        this.endHold(lane, true);
                    }
                }
            }
        }
    }
    
    updateNotes() {
        const currentTime = this.gameState.currentTime;
        
        while (this.gameState.notes.length > 0) {
            const note = this.gameState.notes[0];
            const noteScreenX = this.calculateNoteX(note.time);
            
            if (noteScreenX < this.canvas.width + 100) {
                this.gameState.activeNotes.push({
                    ...note,
                    hit: false,
                    holdCompleted: false,
                    screenX: noteScreenX
                });
                this.gameState.notes.shift();
            } else {
                break;
            }
        }
        
        this.gameState.activeNotes.forEach(note => {
            note.screenX = this.calculateNoteX(note.time);
        });
        
        this.gameState.activeNotes = this.gameState.activeNotes.filter(note => {
            if (!note.hit && note.time < currentTime - this.goodThreshold) {
                if (!note.isHold) {
                    this.handleMiss(note);
                } else {
                    const holdState = this.holdStates[note.lane];
                    if (!holdState.isHolding || holdState.currentNote !== note) {
                        this.handleMiss(note);
                    }
                }
                return false;
            }
            return note.screenX > -100 || (note.isHold && this.holdStates[note.lane].currentNote === note);
        });
    }
    
    calculateNoteX(noteTime) {
        const timeUntilHit = noteTime - this.gameState.currentTime;
        const distance = (timeUntilHit / 1000) * this.noteSpeed;
        return this.judgmentLineX + distance;
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawLanes();
        this.drawJudgmentLine();
        this.drawNotes();
        this.drawHoldEffects();
    }
    
    drawLanes() {
        const laneCount = 4;
        const laneWidth = 100;
        const startX = 100;
        const laneHeight = this.canvas.height;
        
        for (let i = 0; i < laneCount; i++) {
            const x = startX + i * laneWidth;
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, laneHeight);
            this.ctx.stroke();
        }
    }
    
    drawJudgmentLine() {
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(this.judgmentLineX, 0);
        this.ctx.lineTo(this.judgmentLineX, this.canvas.height);
        this.ctx.stroke();
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.fillRect(this.judgmentLineX - 50, 0, 100, this.canvas.height);
    }
    
    drawNotes() {
        const laneWidth = 100;
        const startX = 100;
        const noteWidth = 80;
        const noteHeight = 30;
        const noteSkin = this.skins.note[this.currentSkin.note];
        const hasGlow = noteSkin && noteSkin.glow;
        
        this.gameState.activeNotes.forEach(note => {
            if (note.hit && (!note.isHold || note.holdCompleted)) return;
            
            const laneX = startX + note.lane * laneWidth + (laneWidth - noteWidth) / 2;
            const gradient = this.ctx.createLinearGradient(laneX, 0, laneX + noteWidth, 0);
            gradient.addColorStop(0, this.laneColors[note.lane]);
            gradient.addColorStop(1, this.adjustColor(this.laneColors[note.lane], -30));
            
            if (hasGlow) {
                this.ctx.shadowColor = this.laneColors[note.lane];
                this.ctx.shadowBlur = 15;
            }
            
            if (note.isHold && note.holdEndTime) {
                const holdDuration = note.holdEndTime - note.time;
                const holdLength = (holdDuration / 1000) * this.noteSpeed;
                const startX = note.screenX - holdLength;
                
                this.ctx.fillStyle = this.laneColors[note.lane] + '40';
                this.ctx.fillRect(startX - noteWidth / 2, this.canvas.height / 2 - noteHeight / 4, 
                    holdLength, noteHeight / 2);
            }
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(note.screenX - noteWidth / 2, this.canvas.height / 2 - noteHeight / 2, noteWidth, noteHeight);
            
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(note.screenX - noteWidth / 2, this.canvas.height / 2 - noteHeight / 2, noteWidth, noteHeight);
            
            this.ctx.shadowBlur = 0;
        });
    }
    
    drawHoldEffects() {
        const noteSkin = this.skins.note[this.currentSkin.note];
        const hasGlow = noteSkin && noteSkin.glow;
        
        for (let lane = 0; lane < 4; lane++) {
            const holdState = this.holdStates[lane];
            if (holdState.isHolding) {
                const laneWidth = 100;
                const startX = 100 + lane * laneWidth + (laneWidth - 60) / 2;
                
                if (hasGlow) {
                    this.ctx.shadowColor = this.laneColors[lane];
                    this.ctx.shadowBlur = 20;
                }
                
                this.ctx.fillStyle = this.laneColors[lane] + '80';
                this.ctx.fillRect(startX, this.canvas.height / 2 - 50, 60, 100);
                
                this.ctx.shadowBlur = 0;
            }
        }
    }
    
    adjustColor(color, amount) {
        const hex = color.replace('#', '');
        const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
        const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
        const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    handleKeyDown(e) {
        if (!this.gameState.isPlaying) return;
        
        const key = e.key.toLowerCase();
        const lane = this.keyMap[key];
        
        if (lane !== undefined && !e.repeat) {
            e.preventDefault();
            this.highlightKey(lane, true);
            this.checkHit(lane);
        }
    }
    
    handleKeyUp(e) {
        const key = e.key.toLowerCase();
        const lane = this.keyMap[key];
        
        if (lane !== undefined) {
            e.preventDefault();
            this.highlightKey(lane, false);
            this.endHold(lane, false);
        }
    }
    
    handleTouchStart(e) {
        if (!this.gameState.isPlaying) return;
        e.preventDefault();
        
        const touches = Array.from(e.changedTouches);
        
        touches.forEach(touch => {
            const lane = this.getLaneFromTouch(touch);
            if (lane !== -1) {
                this.highlightKey(lane, true);
                this.checkHit(lane, touch.identifier);
            }
        });
    }
    
    handleTouchEnd(e) {
        e.preventDefault();
        
        const touches = Array.from(e.changedTouches);
        
        touches.forEach(touch => {
            const lane = this.getLaneFromTouch(touch);
            if (lane !== -1) {
                this.highlightKey(lane, false);
                this.endHold(lane, false);
            }
        });
    }
    
    getLaneFromTouch(touch) {
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const startX = 100;
        const laneWidth = 100;
        
        for (let lane = 0; lane < 4; lane++) {
            const laneStart = startX + lane * laneWidth;
            const laneEnd = laneStart + laneWidth;
            if (x >= laneStart && x <= laneEnd) {
                return lane;
            }
        }
        return -1;
    }
    
    highlightKey(lane, pressed) {
        const keyHint = document.querySelector(`.key-hint[data-lane="${lane}"]`);
        if (keyHint) {
            if (pressed) {
                keyHint.classList.add('pressed');
            } else {
                keyHint.classList.remove('pressed');
            }
        }
    }
    
    checkHit(lane, touchId = null) {
        const currentTime = this.gameState.currentTime;
        
        const hitableNotes = this.gameState.activeNotes.filter(note => 
            !note.hit && 
            note.lane === lane && 
            Math.abs(note.time - currentTime) <= this.goodThreshold
        );
        
        if (hitableNotes.length > 0) {
            const sortedNotes = hitableNotes.sort((a, b) => 
                Math.abs(a.time - currentTime) - Math.abs(b.time - currentTime)
            );
            
            const closestNote = sortedNotes[0];
            const timeDiff = Math.abs(closestNote.time - currentTime);
            
            if (closestNote.isHold && closestNote.holdEndTime) {
                this.startHold(lane, closestNote, timeDiff);
            } else {
                this.processHit(closestNote, timeDiff);
            }
        }
    }
    
    startHold(lane, note, timeDiff) {
        const holdState = this.holdStates[lane];
        
        if (holdState.isHolding) {
            this.endHold(lane, false);
        }
        
        holdState.isHolding = true;
        holdState.startTime = this.gameState.currentTime;
        holdState.currentNote = note;
        
        this.processHit(note, timeDiff);
    }
    
    endHold(lane, completed) {
        const holdState = this.holdStates[lane];
        
        if (holdState.isHolding && holdState.currentNote) {
            const note = holdState.currentNote;
            
            if (completed) {
                this.gameState.score += 200;
                this.gameState.perfect++;
                this.showJudgment('HOLD PERFECT', 'judgment-perfect');
            } else {
                const holdDuration = this.gameState.currentTime - holdState.startTime;
                const totalHoldTime = note.holdEndTime - note.time;
                const holdPercentage = holdDuration / totalHoldTime;
                
                if (holdPercentage >= 0.8) {
                    this.gameState.score += 150;
                    this.gameState.good++;
                    this.showJudgment('HOLD GOOD', 'judgment-good');
                }
            }
            
            note.holdCompleted = true;
            this.updateUI();
        }
        
        holdState.isHolding = false;
        holdState.startTime = null;
        holdState.currentNote = null;
    }
    
    processHit(note, timeDiff) {
        if (timeDiff <= this.perfectThreshold) {
            this.handlePerfect(note);
        } else {
            this.handleGood(note);
        }
        
        note.hit = true;
    }
    
    handlePerfect(note) {
        this.gameState.score += 100 + (this.gameState.combo * 10);
        this.gameState.combo++;
        this.gameState.maxCombo = Math.max(this.gameState.maxCombo, this.gameState.combo);
        this.gameState.perfect++;
        this.showJudgment('PERFECT', 'judgment-perfect');
        this.updateUI();
    }
    
    handleGood(note) {
        this.gameState.score += 50 + (this.gameState.combo * 5);
        this.gameState.combo++;
        this.gameState.maxCombo = Math.max(this.gameState.maxCombo, this.gameState.combo);
        this.gameState.good++;
        this.showJudgment('GOOD', 'judgment-good');
        this.updateUI();
    }
    
    handleMiss(note) {
        this.gameState.combo = 0;
        this.gameState.miss++;
        this.showJudgment('MISS', 'judgment-miss');
        this.updateUI();
    }
    
    showJudgment(text, className) {
        const judgmentElement = document.getElementById('judgment');
        judgmentElement.textContent = text;
        judgmentElement.className = 'value';
        void judgmentElement.offsetWidth;
        judgmentElement.classList.add(className);
    }
    
    updateUI() {
        document.getElementById('score').textContent = this.gameState.score;
        document.getElementById('combo').textContent = this.gameState.combo;
    }
    
    checkGameEnd() {
        if (this.gameState.notes.length === 0 && 
            this.gameState.activeNotes.length === 0 && 
            this.gameState.currentTime > this.gameState.currentSong.duration) {
            this.endGame();
        }
    }
    
    async endGame() {
        this.gameState.isPlaying = false;
        this.stopAudio();
        
        if (this.isBattleMode && this.ws && this.ws.readyState === 1) {
            this.ws.send(JSON.stringify({
                type: 'game_end',
                score: this.gameState.score,
                combo: this.gameState.maxCombo,
                perfect: this.gameState.perfect,
                good: this.gameState.good,
                miss: this.gameState.miss
            }));
        }
        
        await this.saveScoreWithRetry();
        this.showResult();
    }
    
    async saveScoreWithRetry() {
        const scoreData = {
            songId: this.gameState.currentSong.id,
            score: this.gameState.score,
            combo: this.gameState.maxCombo,
            perfect: this.gameState.perfect,
            good: this.gameState.good,
            miss: this.gameState.miss,
            userId: this.userId,
            timestamp: Date.now()
        };
        
        let success = false;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await fetch(`/api/scores/${scoreData.songId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        score: scoreData.score,
                        combo: scoreData.combo,
                        perfect: scoreData.perfect,
                        good: scoreData.good,
                        miss: scoreData.miss,
                        userId: this.userId
                    })
                });
                
                if (response.ok) {
                    success = true;
                    console.log('成绩保存成功');
                    break;
                }
            } catch (error) {
                console.warn(`保存成绩尝试 ${attempt}/${this.maxRetries} 失败:`, error);
            }
            
            if (attempt < this.maxRetries) {
                await this.delay(this.retryDelay * attempt);
            }
        }
        
        if (!success) {
            this.cacheScoreLocally(scoreData);
            console.log('成绩已缓存到本地，将在下次重试');
        }
    }
    
    cacheScoreLocally(scoreData) {
        try {
            const pendingScores = this.getPendingScores();
            pendingScores.push(scoreData);
            localStorage.setItem(this.localStorageKey, JSON.stringify(pendingScores));
        } catch (error) {
            console.error('缓存成绩失败:', error);
        }
    }
    
    getPendingScores() {
        try {
            const data = localStorage.getItem(this.localStorageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            return [];
        }
    }
    
    async processPendingScores() {
        const pendingScores = this.getPendingScores();
        if (pendingScores.length === 0) return;
        
        console.log(`发现 ${pendingScores.length} 个待上传的成绩`);
        
        const remainingScores = [];
        
        for (const scoreData of pendingScores) {
            try {
                const response = await fetch(`/api/scores/${scoreData.songId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        score: scoreData.score,
                        combo: scoreData.combo,
                        perfect: scoreData.perfect,
                        good: scoreData.good,
                        miss: scoreData.miss,
                        userId: scoreData.userId
                    })
                });
                
                if (!response.ok) {
                    remainingScores.push(scoreData);
                } else {
                    console.log('缓存的成绩上传成功');
                }
            } catch (error) {
                remainingScores.push(scoreData);
            }
        }
        
        if (remainingScores.length > 0) {
            localStorage.setItem(this.localStorageKey, JSON.stringify(remainingScores));
        } else {
            localStorage.removeItem(this.localStorageKey);
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    showResult() {
        document.getElementById('result-song').textContent = this.gameState.currentSong.name;
        document.getElementById('result-score').textContent = this.gameState.score;
        document.getElementById('result-combo').textContent = this.gameState.maxCombo;
        document.getElementById('result-perfect').textContent = this.gameState.perfect;
        document.getElementById('result-good').textContent = this.gameState.good;
        document.getElementById('result-miss').textContent = this.gameState.miss;
        
        const battleResultDiv = document.getElementById('battle-result');
        if (this.isBattleMode && this.battleResult) {
            battleResultDiv.classList.remove('hidden');
            document.getElementById('opponent-result-score').textContent = this.battleResult.opponentScore;
            
            const resultText = this.gameState.score > this.battleResult.opponentScore ? '🏆 胜利！' :
                              this.gameState.score < this.battleResult.opponentScore ? '💔 失败' : '🤝 平局';
            document.getElementById('battle-result-text').textContent = resultText;
        } else {
            battleResultDiv.classList.add('hidden');
        }
        
        this.loadUser();
        this.showScreen('result-screen');
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        document.getElementById(screenId).classList.remove('hidden');
        
        if (screenId === 'game-screen') {
            this.applySkinStyles();
        } else {
            document.getElementById('game-screen').style.background = '';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MusicRhythmGame();
});
