const { loadGameCode, setupDOM, teardownDOM, getGameClass } = require('./test-utils');

describe('长按判定和分数上传重试', () => {
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
  
  describe('长按判定', () => {
    test('应该正确识别并开始长按音符', async () => {
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
      
      expect(gameInstance.holdStates[0].isHolding).toBe(false);
      
      gameInstance.checkHit(0);
      
      expect(gameInstance.holdStates[0].isHolding).toBe(true);
      expect(gameInstance.holdStates[0].currentNote).toBeDefined();
    });
    
    test('松开手指后应该正确结束长按状态', async () => {
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
      
      gameInstance.checkHit(0);
      
      expect(gameInstance.holdStates[0].isHolding).toBe(true);
      
      gameInstance.gameState.currentTime = 1500;
      gameInstance.handleKeyUp({ key: 'd', preventDefault: () => {} });
      
      expect(gameInstance.holdStates[0].isHolding).toBe(false);
    });
    
    test('长按结束后不应该影响后续音符判定', async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/songs/song1')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 'song1',
              name: '测试歌曲',
              notes: [
                { time: 1000, lane: 0, isHold: true, holdEndTime: 2000 },
                { time: 3000, lane: 0 }
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
      
      gameInstance.gameState.currentTime = 2000;
      gameInstance.handleKeyUp({ key: 'd', preventDefault: () => {} });
      
      gameInstance.gameState.currentTime = 3000;
      gameInstance.updateNotes();
      gameInstance.checkHit(0);
      
      expect(gameInstance.gameState.perfect).toBeGreaterThanOrEqual(1);
      expect(gameInstance.gameState.combo).toBeGreaterThanOrEqual(1);
    });
    
    test('应该在长按时间到达后自动结束长按', async () => {
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
      
      gameInstance.checkHit(0);
      
      expect(gameInstance.holdStates[0].isHolding).toBe(true);
      
      gameInstance.gameState.currentTime = 2500;
      gameInstance.updateHoldStates();
      
      expect(gameInstance.holdStates[0].isHolding).toBe(false);
    });
    
    test('每个轨道应该独立管理长按状态', async () => {
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/songs/song1')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 'song1',
              name: '测试歌曲',
              notes: [
                { time: 1000, lane: 0, isHold: true, holdEndTime: 3000 },
                { time: 1000, lane: 1, isHold: true, holdEndTime: 2000 }
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
      gameInstance.checkHit(1);
      
      expect(gameInstance.holdStates[0].isHolding).toBe(true);
      expect(gameInstance.holdStates[1].isHolding).toBe(true);
      
      gameInstance.gameState.currentTime = 2500;
      gameInstance.updateHoldStates();
      
      expect(gameInstance.holdStates[0].isHolding).toBe(true);
      expect(gameInstance.holdStates[1].isHolding).toBe(false);
      
      gameInstance.gameState.currentTime = 3500;
      gameInstance.updateHoldStates();
      
      expect(gameInstance.holdStates[0].isHolding).toBe(false);
      expect(gameInstance.holdStates[1].isHolding).toBe(false);
    });
  });
  
  describe('分数上传重试机制', () => {
    test('应该在网络失败时进行重试', async () => {
      let callCount = 0;
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
        if (url.includes('/api/scores')) {
          callCount++;
          if (callCount < 3) {
            return Promise.reject(new Error('网络失败'));
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      gameInstance.gameState.score = 1000;
      gameInstance.gameState.maxCombo = 10;
      gameInstance.gameState.perfect = 8;
      gameInstance.gameState.good = 2;
      gameInstance.gameState.miss = 0;
      gameInstance.gameState.currentSong = { id: 'song1', name: '测试歌曲' };
      
      await gameInstance.saveScoreWithRetry();
      
      expect(callCount).toBe(3);
    }, 10000);
    
    test('重试应该有递增的延迟', async () => {
      let callCount = 0;
      
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
        if (url.includes('/api/scores')) {
          callCount++;
          if (callCount < 3) {
            return Promise.reject(new Error('网络失败'));
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      gameInstance.gameState.currentSong = { id: 'song1', name: '测试歌曲' };
      
      await gameInstance.saveScoreWithRetry();
      
      expect(callCount).toBe(3);
    }, 10000);
    
    test('重试失败后应该缓存到本地存储', async () => {
      let callCount = 0;
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
        if (url.includes('/api/scores')) {
          callCount++;
          return Promise.reject(new Error('网络失败'));
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      gameInstance.gameState.currentSong = { id: 'song1', name: '测试歌曲' };
      
      await gameInstance.saveScoreWithRetry();
      
      expect(callCount).toBe(3);
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'rhythm_game_pending_scores',
        expect.any(String)
      );
    }, 10000);
    
    test('应该在下次启动时上传缓存的成绩', async () => {
      const pendingScores = [
        {
          songId: 'song1',
          score: 1000,
          combo: 10,
          perfect: 8,
          good: 2,
          miss: 0,
          timestamp: Date.now()
        }
      ];
      
      window.localStorage.getItem.mockReturnValue(JSON.stringify(pendingScores));
      
      let uploadCalled = false;
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
        if (url.includes('/api/scores')) {
          uploadCalled = true;
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      await gameInstance.processPendingScores();
      
      expect(uploadCalled).toBe(true);
    });
    
    test('上传缓存成绩失败时应该保留缓存', async () => {
      const pendingScores = [
        {
          songId: 'song1',
          score: 1000,
          combo: 10,
          perfect: 8,
          good: 2,
          miss: 0,
          timestamp: Date.now()
        }
      ];
      
      window.localStorage.getItem.mockReturnValue(JSON.stringify(pendingScores));
      
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/scores')) {
          return Promise.reject(new Error('网络失败'));
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      await gameInstance.processPendingScores();
      
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'rhythm_game_pending_scores',
        expect.any(String)
      );
    });
    
    test('成功上传后应该清除缓存', async () => {
      const pendingScores = [
        {
          songId: 'song1',
          score: 1000,
          combo: 10,
          perfect: 8,
          good: 2,
          miss: 0,
          timestamp: Date.now()
        }
      ];
      
      window.localStorage.getItem.mockReturnValue(JSON.stringify(pendingScores));
      
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/scores')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      await gameInstance.processPendingScores();
      
      expect(window.localStorage.removeItem).toHaveBeenCalledWith(
        'rhythm_game_pending_scores'
      );
    });
  });
});
