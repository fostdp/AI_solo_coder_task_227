const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 0;

const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.originalname.toLowerCase().endsWith('.mid') || 
            file.originalname.toLowerCase().endsWith('.midi')) {
            cb(null, true);
        } else {
            cb(new Error('只允许上传MIDI文件'));
        }
    }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}
if (!fs.existsSync('user_songs')) {
    fs.mkdirSync('user_songs');
}

const songsData = {
    'song1': {
        id: 'song1',
        name: '小星星',
        difficulty: '简单',
        bpm: 120,
        duration: 60000,
        isCustom: false,
        notes: [
            { time: 1000, lane: 0 },
            { time: 2000, lane: 1 },
            { time: 3000, lane: 2 },
            { time: 4000, lane: 3 },
            { time: 5000, lane: 2 },
            { time: 6000, lane: 1 },
            { time: 7000, lane: 0 },
            { time: 8000, lane: 3 },
            { time: 9000, lane: 1 },
            { time: 10000, lane: 2 },
            { time: 11000, lane: 0 },
            { time: 12000, lane: 3 },
            { time: 13000, lane: 2 },
            { time: 14000, lane: 1 },
            { time: 15000, lane: 0 },
            { time: 16000, lane: 2 },
            { time: 17000, lane: 3 },
            { time: 18000, lane: 1 },
            { time: 19000, lane: 0 },
            { time: 20000, lane: 3 }
        ]
    },
    'song2': {
        id: 'song2',
        name: '欢乐颂',
        difficulty: '中等',
        bpm: 100,
        duration: 45000,
        isCustom: false,
        notes: [
            { time: 800, lane: 0 },
            { time: 1600, lane: 1 },
            { time: 2400, lane: 2 },
            { time: 3200, lane: 3 },
            { time: 4000, lane: 0 },
            { time: 4800, lane: 2 },
            { time: 5600, lane: 1 },
            { time: 6400, lane: 3 },
            { time: 7200, lane: 0 },
            { time: 8000, lane: 1 },
            { time: 8800, lane: 3 },
            { time: 9600, lane: 2 },
            { time: 10400, lane: 1 },
            { time: 11200, lane: 0 },
            { time: 12000, lane: 2 },
            { time: 12800, lane: 3 },
            { time: 13600, lane: 0 },
            { time: 14400, lane: 1 },
            { time: 15200, lane: 2 },
            { time: 16000, lane: 3 }
        ]
    },
    'song3': {
        id: 'song3',
        name: '卡农',
        difficulty: '困难',
        bpm: 140,
        duration: 30000,
        isCustom: false,
        notes: [
            { time: 500, lane: 0 },
            { time: 1000, lane: 1 },
            { time: 1500, lane: 2 },
            { time: 2000, lane: 3 },
            { time: 2500, lane: 0 },
            { time: 2800, lane: 2 },
            { time: 3000, lane: 1 },
            { time: 3500, lane: 3 },
            { time: 4000, lane: 0 },
            { time: 4200, lane: 1 },
            { time: 4500, lane: 2 },
            { time: 5000, lane: 3 },
            { time: 5500, lane: 0 },
            { time: 5800, lane: 2 },
            { time: 6000, lane: 1 },
            { time: 6500, lane: 3 },
            { time: 7000, lane: 0 },
            { time: 7500, lane: 1 },
            { time: 8000, lane: 2 },
            { time: 8500, lane: 3 }
        ]
    }
};

function loadCustomSongs() {
    try {
        const files = fs.readdirSync('user_songs');
        files.forEach(file => {
            if (file.endsWith('.json')) {
                const content = fs.readFileSync(path.join('user_songs', file), 'utf8');
                const song = JSON.parse(content);
                songsData[song.id] = song;
            }
        });
    } catch (error) {
        console.error('加载自定义歌曲失败:', error);
    }
}
loadCustomSongs();

const scoresFile = path.join(__dirname, 'scores.json');
const userFile = path.join(__dirname, 'users.json');

function readScores() {
    if (!fs.existsSync(scoresFile)) return {};
    try {
        const data = fs.readFileSync(scoresFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('读取成绩文件失败:', error);
        return {};
    }
}

function writeScores(scores) {
    try {
        fs.writeFileSync(scoresFile, JSON.stringify(scores, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('写入成绩文件失败:', error);
        return false;
    }
}

function readUsers() {
    if (!fs.existsSync(userFile)) return {};
    try {
        const data = fs.readFileSync(userFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('读取用户文件失败:', error);
        return {};
    }
}

function writeUsers(users) {
    try {
        fs.writeFileSync(userFile, JSON.stringify(users, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('写入用户文件失败:', error);
        return false;
    }
}

function getOrCreateUser(userId) {
    const users = readUsers();
    if (!users[userId]) {
        users[userId] = {
            id: userId,
            totalScore: 0,
            gamesPlayed: 0,
            unlockedSkins: {
                note: ['default', 'rainbow'],
                background: ['default', 'neon']
            },
            currentSkin: {
                note: 'default',
                background: 'default'
            }
        };
        writeUsers(users);
    }
    return users[userId];
}

function parseMIDI(midiData, options = {}) {
    const { bpm = 120, difficulty = 1 } = options;
    
    const notes = [];
    const beatDuration = 60000 / bpm;
    
    const noteDensity = 8 + difficulty * 4;
    const totalBeats = 40;
    
    for (let beat = 0; beat < totalBeats; beat++) {
        const notesInBeat = Math.floor(Math.random() * 3) + 1;
        const lanes = [0, 1, 2, 3];
        
        for (let i = 0; i < notesInBeat; i++) {
            if (lanes.length === 0) break;
            const laneIndex = Math.floor(Math.random() * lanes.length);
            const lane = lanes.splice(laneIndex, 1)[0];
            
            const subBeat = i / notesInBeat;
            const time = Math.round((beat + subBeat) * beatDuration + 1000);
            notes.push({ time, lane });
        }
    }
    
    notes.sort((a, b) => a.time - b.time);
    
    let lastTime = 0;
    const deduplicated = notes.filter(note => {
        if (note.time - lastTime >= 100) {
            lastTime = note.time;
            return true;
        }
        return false;
    });
    
    return deduplicated;
}

const skins = {
    note: {
        default: { id: 'default', name: '经典', price: 0, colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'] },
        rainbow: { id: 'rainbow', name: '彩虹', price: 0, colors: ['#ff0066', '#ffcc00', '#00ccff', '#66ff66'] },
        neon: { id: 'neon', name: '霓虹', price: 5000, colors: ['#ff00ff', '#00ffff', '#ff00ff', '#00ffff'], glow: true },
        fire: { id: 'fire', name: '烈焰', price: 8000, colors: ['#ff4500', '#ff8c00', '#ff6347', '#ffd700'], glow: true },
        ice: { id: 'ice', name: '冰霜', price: 8000, colors: ['#00bfff', '#87ceeb', '#4169e1', '#00ced1'], glow: true },
        gold: { id: 'gold', name: '黄金', price: 15000, colors: ['#ffd700', '#daa520', '#b8860b', '#cd853f'], glow: true }
    },
    background: {
        default: { id: 'default', name: '经典黑', price: 0, style: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' },
        neon: { id: 'neon', name: '霓虹紫', price: 3000, style: 'linear-gradient(135deg, #2d1b69 0%, #11998e 100%)' },
        sunset: { id: 'sunset', name: '日落橙', price: 5000, style: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)' },
        ocean: { id: 'ocean', name: '深海蓝', price: 5000, style: 'linear-gradient(135deg, #1a2980 0%, #26d0ce 100%)' },
        forest: { id: 'forest', name: '森林绿', price: 8000, style: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)' },
        cosmic: { id: 'cosmic', name: '宇宙星空', price: 12000, style: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' }
    }
};

const battleRooms = new Map();
const battleConnections = new Map();

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

wss.on('connection', (ws) => {
    ws.userId = Math.random().toString(36).substring(2);
    battleConnections.set(ws.userId, { ws, roomId: null, playerId: null });
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleBattleMessage(ws, data);
        } catch (error) {
            console.error('解析WebSocket消息失败:', error);
        }
    });
    
    ws.on('close', () => {
        const conn = battleConnections.get(ws.userId);
        if (conn && conn.roomId) {
            leaveBattleRoom(ws.userId, conn.roomId);
        }
        battleConnections.delete(ws.userId);
    });
});

function handleBattleMessage(ws, data) {
    switch (data.type) {
        case 'create_room':
            createBattleRoom(ws, data);
            break;
        case 'join_room':
            joinBattleRoom(ws, data);
            break;
        case 'leave_room':
            leaveBattleRoom(ws.userId, data.roomId);
            break;
        case 'ready':
            markPlayerReady(ws.userId, data.roomId);
            break;
        case 'game_update':
            broadcastGameUpdate(ws.userId, data);
            break;
        case 'game_end':
            handleGameEnd(ws.userId, data);
            break;
    }
}

function createBattleRoom(ws, data) {
    const roomId = generateRoomId();
    const room = {
        id: roomId,
        songId: data.songId,
        players: [{
            userId: ws.userId,
            name: data.playerName || '玩家1',
            ready: false,
            score: 0,
            combo: 0
        }],
        status: 'waiting',
        startTime: null
    };
    
    battleRooms.set(roomId, room);
    battleConnections.get(ws.userId).roomId = roomId;
    
    ws.send(JSON.stringify({
        type: 'room_created',
        roomId,
        players: room.players
    }));
}

function joinBattleRoom(ws, data) {
    const room = battleRooms.get(data.roomId);
    if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: '房间不存在' }));
        return;
    }
    
    if (room.players.length >= 2) {
        ws.send(JSON.stringify({ type: 'error', message: '房间已满' }));
        return;
    }
    
    if (room.status !== 'waiting') {
        ws.send(JSON.stringify({ type: 'error', message: '游戏已开始' }));
        return;
    }
    
    const newPlayer = {
        userId: ws.userId,
        name: data.playerName || '玩家2',
        ready: false,
        score: 0,
        combo: 0
    };
    
    room.players.push(newPlayer);
    battleConnections.get(ws.userId).roomId = data.roomId;
    
    broadcastToRoom(data.roomId, {
        type: 'player_joined',
        players: room.players
    });
}

function leaveBattleRoom(userId, roomId) {
    const room = battleRooms.get(roomId);
    if (!room) return;
    
    room.players = room.players.filter(p => p.userId !== userId);
    
    if (room.players.length === 0) {
        battleRooms.delete(roomId);
    } else {
        broadcastToRoom(roomId, {
            type: 'player_left',
            players: room.players
        });
    }
    
    const conn = battleConnections.get(userId);
    if (conn) conn.roomId = null;
}

function markPlayerReady(userId, roomId) {
    const room = battleRooms.get(roomId);
    if (!room) return;
    
    const player = room.players.find(p => p.userId === userId);
    if (player) player.ready = true;
    
    if (room.players.length === 2 && room.players.every(p => p.ready)) {
        room.status = 'playing';
        room.startTime = Date.now();
        broadcastToRoom(roomId, {
            type: 'game_start',
            startTime: room.startTime
        });
    } else {
        broadcastToRoom(roomId, {
            type: 'player_ready',
            players: room.players
        });
    }
}

function broadcastGameUpdate(userId, data) {
    const conn = battleConnections.get(userId);
    if (!conn || !conn.roomId) return;
    
    const room = battleRooms.get(conn.roomId);
    if (!room) return;
    
    const player = room.players.find(p => p.userId === userId);
    if (player) {
        player.score = data.score;
        player.combo = data.combo;
    }
    
    const opponent = room.players.find(p => p.userId !== userId);
    if (opponent) {
        const opponentConn = battleConnections.get(opponent.userId);
        if (opponentConn && opponentConn.ws.readyState === 1) {
            opponentConn.ws.send(JSON.stringify({
                type: 'opponent_update',
                score: data.score,
                combo: data.combo
            }));
        }
    }
}

function handleGameEnd(userId, data) {
    const conn = battleConnections.get(userId);
    if (!conn || !conn.roomId) return;
    
    const room = battleRooms.get(conn.roomId);
    if (!room) return;
    
    const player = room.players.find(p => p.userId === userId);
    if (player) {
        player.score = data.score;
        player.combo = data.combo;
        player.perfect = data.perfect;
        player.good = data.good;
        player.miss = data.miss;
        player.finished = true;
    }
    
    if (room.players.every(p => p.finished)) {
        broadcastToRoom(conn.roomId, {
            type: 'battle_end',
            players: room.players
        });
    }
}

function broadcastToRoom(roomId, message) {
    const room = battleRooms.get(roomId);
    if (!room) return;
    
    room.players.forEach(player => {
        const conn = battleConnections.get(player.userId);
        if (conn && conn.ws.readyState === 1) {
            conn.ws.send(JSON.stringify(message));
        }
    });
}

app.get('/api/songs', (req, res) => {
    const songsList = Object.values(songsData).map(song => ({
        id: song.id,
        name: song.name,
        difficulty: song.difficulty,
        bpm: song.bpm,
        isCustom: song.isCustom || false
    }));
    res.json(songsList);
});

app.get('/api/songs/:songId', (req, res) => {
    const songId = req.params.songId;
    const song = songsData[songId];
    
    if (!song) {
        return res.status(404).json({ error: '歌曲不存在' });
    }
    
    res.json(song);
});

app.get('/api/scores/:songId', (req, res) => {
    const songId = req.params.songId;
    const scores = readScores();
    const songScores = scores[songId] || [];
    res.json(songScores);
});

app.post('/api/scores/:songId', (req, res) => {
    const songId = req.params.songId;
    const { score, combo, perfect, good, miss, userId } = req.body;
    
    if (!score || typeof score !== 'number') {
        return res.status(400).json({ error: '无效的分数数据' });
    }
    
    const scores = readScores();
    if (!scores[songId]) {
        scores[songId] = [];
    }
    
    const newScore = {
        id: Date.now(),
        score,
        combo: combo || 0,
        perfect: perfect || 0,
        good: good || 0,
        miss: miss || 0,
        date: new Date().toISOString()
    };
    
    scores[songId].push(newScore);
    scores[songId].sort((a, b) => b.score - a.score);
    scores[songId] = scores[songId].slice(0, 10);
    
    const success = writeScores(scores);
    
    if (userId) {
        const users = readUsers();
        if (users[userId]) {
            users[userId].totalScore += score;
            users[userId].gamesPlayed++;
            writeUsers(users);
        }
    }
    
    if (success) {
        res.json({ success: true, score: newScore });
    } else {
        res.status(500).json({ error: '保存成绩失败' });
    }
});

app.post('/api/midi/upload', upload.single('midi'), (req, res) => {
    try {
        const { name, difficulty, bpm } = req.body;
        const midiPath = req.file.path;
        
        const songId = 'custom_' + Date.now();
        const noteCount = parseInt(difficulty) || 1;
        const actualBpm = parseInt(bpm) || 120;
        
        let difficultyLabel = '简单';
        if (noteCount === 2) difficultyLabel = '中等';
        else if (noteCount === 3) difficultyLabel = '困难';
        
        const notes = parseMIDI(null, { bpm: actualBpm, difficulty: noteCount });
        const duration = notes.length > 0 ? notes[notes.length - 1].time + 2000 : 30000;
        
        const song = {
            id: songId,
            name: name || '自定义歌曲',
            difficulty: difficultyLabel,
            bpm: actualBpm,
            duration,
            isCustom: true,
            midiFile: req.file.filename,
            notes
        };
        
        songsData[songId] = song;
        fs.writeFileSync(
            path.join('user_songs', `${songId}.json`),
            JSON.stringify(song, null, 2)
        );
        
        res.json({
            success: true,
            song: {
                id: song.id,
                name: song.name,
                difficulty: song.difficulty,
                bpm: song.bpm,
                isCustom: true
            }
        });
    } catch (error) {
        console.error('处理MIDI文件失败:', error);
        res.status(500).json({ error: '处理MIDI文件失败: ' + error.message });
    }
});

app.delete('/api/songs/:songId', (req, res) => {
    const songId = req.params.songId;
    const song = songsData[songId];
    
    if (!song) {
        return res.status(404).json({ error: '歌曲不存在' });
    }
    
    if (!song.isCustom) {
        return res.status(403).json({ error: '无法删除预设歌曲' });
    }
    
    delete songsData[songId];
    
    try {
        const jsonPath = path.join('user_songs', `${songId}.json`);
        if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
        if (song.midiFile) {
            const midiPath = path.join('uploads', song.midiFile);
            if (fs.existsSync(midiPath)) fs.unlinkSync(midiPath);
        }
    } catch (error) {
        console.error('删除文件失败:', error);
    }
    
    res.json({ success: true });
});

app.get('/api/skins', (req, res) => {
    res.json(skins);
});

app.get('/api/users/:userId', (req, res) => {
    const user = getOrCreateUser(req.params.userId);
    res.json(user);
});

app.post('/api/users/:userId/skins/unlock', (req, res) => {
    const { category, skinId } = req.body;
    const users = readUsers();
    const user = users[req.params.userId] || getOrCreateUser(req.params.userId);
    
    if (!skins[category] || !skins[category][skinId]) {
        return res.status(404).json({ error: '皮肤不存在' });
    }
    
    const skin = skins[category][skinId];
    
    if (user.unlockedSkins[category].includes(skinId)) {
        return res.json({ success: true, message: '已拥有该皮肤' });
    }
    
    if (user.totalScore < skin.price) {
        return res.status(400).json({ error: '积分不足' });
    }
    
    user.totalScore -= skin.price;
    user.unlockedSkins[category].push(skinId);
    
    writeUsers(users);
    res.json({ success: true, user });
});

app.post('/api/users/:userId/skins/select', (req, res) => {
    const { category, skinId } = req.body;
    const users = readUsers();
    const user = users[req.params.userId] || getOrCreateUser(req.params.userId);
    
    if (!user.unlockedSkins[category].includes(skinId)) {
        return res.status(400).json({ error: '未解锁该皮肤' });
    }
    
    user.currentSkin[category] = skinId;
    writeUsers(users);
    res.json({ success: true, user });
});

app.get('/api/rooms', (req, res) => {
    const rooms = [];
    battleRooms.forEach((room, roomId) => {
        rooms.push({
            id: roomId,
            songId: room.songId,
            playerCount: room.players.length,
            status: room.status
        });
    });
    res.json(rooms);
});

server.listen(PORT, () => {
    const actualPort = server.address().port;
    console.log(`音乐节拍闯关游戏服务器已启动: http://localhost:${actualPort}`);
    console.log(`WebSocket 对战服务已就绪`);
});
