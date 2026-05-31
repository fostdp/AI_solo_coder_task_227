const { loadGameCode, setupDOM, teardownDOM, getGameClass } = require('./test-utils');

describe('判定逻辑和多点触控事件队列', () => {
  let MusicRhythmGame;
  
  beforeAll(() => {
    loadGameCode();
    MusicRhythmGame = getGameClass();
  });
  
  beforeEach(() => {
    setupDOM();
  });
  
  afterEach(() => {
    teardownDOM();
  });
  
  describe('判定精度', () => {
    test('应该在时间差小于等于80ms时判定为Perfect', async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/songs/song1')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 'song1',
              name: '测试歌曲',
              notes: [{ time: 1000, lane: 0 }],
              duration: 30000
            })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      await gameInstance.startGame('song1');
      
      gameInstance.gameState.isPlaying = true;
      gameInstance.gameState.currentTime = 1000;
      gameInstance.updateNotes();
      
      gameInstance.checkHit(0);
      
      expect(gameInstance.gameState.perfect).toBe(1);
      expect(gameInstance.gameState.good).toBe(0);
      expect(gameInstance.gameState.combo).toBe(1);
    });
    
    test('应该在时间差在80ms-150ms之间时判定为Good', async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/songs/song1')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 'song1',
              name: '测试歌曲',
              notes: [{ time: 1000, lane: 0 }],
              duration: 30000
            })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      await gameInstance.startGame('song1');
      
      gameInstance.gameState.isPlaying = true;
      gameInstance.gameState.currentTime = 1100;
      gameInstance.updateNotes();
      
      gameInstance.checkHit(0);
      
      expect(gameInstance.gameState.perfect).toBe(0);
      expect(gameInstance.gameState.good).toBe(1);
      expect(gameInstance.gameState.combo).toBe(1);
    });
    
    test('应该在时间差超过150ms时不进行判定', async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/songs/song1')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 'song1',
              name: '测试歌曲',
              notes: [{ time: 1000, lane: 0 }],
              duration: 30000
            })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      await gameInstance.startGame('song1');
      
      gameInstance.gameState.isPlaying = true;
      gameInstance.gameState.currentTime = 2000;
      gameInstance.updateNotes();
      
      gameInstance.checkHit(0);
      
      expect(gameInstance.gameState.perfect).toBe(0);
      expect(gameInstance.gameState.good).toBe(0);
      expect(gameInstance.gameState.combo).toBe(0);
    });
    
    test('应该只判定对应轨道的音符', async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/songs/song1')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 'song1',
              name: '测试歌曲',
              notes: [
                { time: 1000, lane: 0 },
                { time: 1000, lane: 1 }
              ],
              duration: 30000
            })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      await gameInstance.startGame('song1');
      
      gameInstance.gameState.isPlaying = true;
      gameInstance.gameState.currentTime = 1000;
      gameInstance.updateNotes();
      
      gameInstance.checkHit(0);
      
      expect(gameInstance.gameState.perfect).toBe(1);
      
      gameInstance.checkHit(1);
      
      expect(gameInstance.gameState.perfect).toBe(2);
      expect(gameInstance.gameState.combo).toBe(2);
    });
  });
  
  describe('多点触控事件队列', () => {
    test('应该能够同时处理多个触摸点', async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/songs/song1')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 'song1',
              name: '测试歌曲',
              notes: [
                { time: 1000, lane: 0 },
                { time: 1000, lane: 1 },
                { time: 1000, lane: 2 }
              ],
              duration: 30000
            })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      await gameInstance.startGame('song1');
      
      gameInstance.gameState.isPlaying = true;
      gameInstance.gameState.currentTime = 1000;
      gameInstance.updateNotes();
      
      const canvas = document.getElementById('game-canvas');
      const rect = canvas.getBoundingClientRect();
      
      const touch1 = new Touch({
        identifier: 1,
        clientX: rect.left + 120,
        clientY: rect.top + 250,
        target: canvas
      });
      
      const touch2 = new Touch({
        identifier: 2,
        clientX: rect.left + 220,
        clientY: rect.top + 250,
        target: canvas
      });
      
      const touch3 = new Touch({
        identifier: 3,
        clientX: rect.left + 320,
        clientY: rect.top + 250,
        target: canvas
      });
      
      const touchEvent = new TouchEvent('touchstart', {
        changedTouches: [touch1, touch2, touch3]
      });
      
      canvas.dispatchEvent(touchEvent);
      
      expect(gameInstance.gameState.perfect).toBe(3);
      expect(gameInstance.gameState.combo).toBe(3);
    });
    
    test('高密度音符时应该正确处理每个触摸事件', async () => {
      const notes = [];
      for (let i = 0; i < 10; i++) {
        notes.push({ time: 1000 + i * 50, lane: i % 4 });
      }
      
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/songs/song1')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 'song1',
              name: '测试歌曲',
              notes: notes,
              duration: 30000
            })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      await gameInstance.startGame('song1');
      
      gameInstance.gameState.isPlaying = true;
      gameInstance.gameState.currentTime = 1000;
      gameInstance.updateNotes();
      
      gameInstance.checkHit(0);
      gameInstance.checkHit(1);
      gameInstance.checkHit(2);
      gameInstance.checkHit(3);
      
      expect(gameInstance.gameState.combo).toBe(4);
      
      gameInstance.gameState.currentTime = 1050;
      gameInstance.updateNotes();
      gameInstance.checkHit(0);
      gameInstance.checkHit(1);
      
      expect(gameInstance.gameState.combo).toBeGreaterThanOrEqual(5);
    });
    
    test('应该正确映射触摸坐标到轨道', async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/songs/song1')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 'song1',
              name: '测试歌曲',
              notes: [
                { time: 1000, lane: 0 },
                { time: 1000, lane: 1 },
                { time: 1000, lane: 2 },
                { time: 1000, lane: 3 }
              ],
              duration: 30000
            })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      await gameInstance.startGame('song1');
      
      gameInstance.gameState.isPlaying = true;
      gameInstance.gameState.currentTime = 1000;
      gameInstance.updateNotes();
      
      const canvas = document.getElementById('game-canvas');
      const rect = canvas.getBoundingClientRect();
      
      const startX = 100;
      const laneWidth = 100;
      
      for (let lane = 0; lane < 4; lane++) {
        const touch = new Touch({
          identifier: lane,
          clientX: rect.left + startX + lane * laneWidth + 50,
          clientY: rect.top + 250,
          target: canvas
        });
        
        const touchEvent = new TouchEvent('touchstart', {
          changedTouches: [touch]
        });
        
        canvas.dispatchEvent(touchEvent);
      }
      
      expect(gameInstance.gameState.perfect).toBe(4);
      expect(gameInstance.gameState.combo).toBe(4);
    });
    
    test('触摸结束时应该正确处理松开事件', async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/songs/song1')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 'song1',
              name: '测试歌曲',
              notes: [{ time: 1000, lane: 0, isHold: true, holdEndTime: 2000 }],
              duration: 30000
            })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      await gameInstance.startGame('song1');
      
      gameInstance.gameState.isPlaying = true;
      gameInstance.gameState.currentTime = 1000;
      gameInstance.updateNotes();
      
      const canvas = document.getElementById('game-canvas');
      const rect = canvas.getBoundingClientRect();
      
      const touch = new Touch({
        identifier: 1,
        clientX: rect.left + 120,
        clientY: rect.top + 250,
        target: canvas
      });
      
      const touchStartEvent = new TouchEvent('touchstart', {
        changedTouches: [touch]
      });
      
      canvas.dispatchEvent(touchStartEvent);
      
      expect(gameInstance.holdStates[0].isHolding).toBe(true);
      
      gameInstance.gameState.currentTime = 1500;
      
      const touchEndEvent = new TouchEvent('touchend', {
        changedTouches: [touch]
      });
      
      canvas.dispatchEvent(touchEndEvent);
      
      expect(gameInstance.holdStates[0].isHolding).toBe(false);
    });
  });
  
  describe('分数计算', () => {
    test('Perfect判定应该获得100分+连击加成', async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/songs/song1')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 'song1',
              name: '测试歌曲',
              notes: [
                { time: 1000, lane: 0 },
                { time: 2000, lane: 1 },
                { time: 3000, lane: 2 }
              ],
              duration: 30000
            })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      await gameInstance.startGame('song1');
      
      gameInstance.gameState.isPlaying = true;
      
      gameInstance.gameState.currentTime = 1000;
      gameInstance.updateNotes();
      gameInstance.checkHit(0);
      expect(gameInstance.gameState.score).toBe(100);
      
      gameInstance.gameState.currentTime = 2000;
      gameInstance.updateNotes();
      gameInstance.checkHit(1);
      expect(gameInstance.gameState.score).toBe(100 + 100 + 10);
      
      gameInstance.gameState.currentTime = 3000;
      gameInstance.updateNotes();
      gameInstance.checkHit(2);
      expect(gameInstance.gameState.score).toBe(100 + 110 + 100 + 20);
    });
    
    test('Good判定应该获得50分+连击加成', async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/songs/song1')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 'song1',
              name: '测试歌曲',
              notes: [
                { time: 1000, lane: 0 },
                { time: 2000, lane: 1 }
              ],
              duration: 30000
            })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      await gameInstance.startGame('song1');
      
      gameInstance.gameState.isPlaying = true;
      
      gameInstance.gameState.currentTime = 1000;
      gameInstance.updateNotes();
      gameInstance.checkHit(0);
      expect(gameInstance.gameState.score).toBe(100);
      
      gameInstance.gameState.currentTime = 2100;
      gameInstance.updateNotes();
      gameInstance.checkHit(1);
      expect(gameInstance.gameState.score).toBe(100 + 50 + 5);
    });
    
    test('Miss判定应该重置连击', async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/songs/song1')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 'song1',
              name: '测试歌曲',
              notes: [
                { time: 1000, lane: 0 },
                { time: 2000, lane: 1 },
                { time: 3000, lane: 2 }
              ],
              duration: 30000
            })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      await gameInstance.startGame('song1');
      
      gameInstance.gameState.isPlaying = true;
      
      gameInstance.gameState.currentTime = 1000;
      gameInstance.updateNotes();
      gameInstance.checkHit(0);
      expect(gameInstance.gameState.combo).toBe(1);
      
      gameInstance.gameState.currentTime = 3000;
      gameInstance.updateNotes();
      
      expect(gameInstance.gameState.miss).toBe(1);
      expect(gameInstance.gameState.combo).toBe(0);
      
      gameInstance.checkHit(2);
      expect(gameInstance.gameState.combo).toBe(1);
    });
  });
});
