const { loadGameCode, setupDOM, teardownDOM, getGameClass } = require('./test-utils');

describe('曲谱同步和音频缓冲补偿机制', () => {
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
  
  describe('音频加载和解码等待', () => {
    test('应该在音频未准备好时延迟开始游戏', async () => {
      let decodeAudioDataResolve;
      const decodeAudioDataPromise = new Promise(resolve => {
        decodeAudioDataResolve = resolve;
      });
      
      const mockDecodeAudioData = jest.fn().mockReturnValue(decodeAudioDataPromise);
      const mockAudioContext = {
        decodeAudioData: mockDecodeAudioData,
        createBufferSource: jest.fn().mockReturnValue({
          buffer: null,
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn()
        })
      };
      
      global.AudioContext = jest.fn().mockImplementation(() => mockAudioContext);
      
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/songs/song1')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 'song1',
              name: '测试歌曲',
              audioUrl: '/audio/test.mp3',
              notes: [{ time: 1000, lane: 0 }],
              duration: 30000
            })
          });
        }
        if (url.includes('/audio')) {
          return Promise.resolve({
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      const beginGameSpy = jest.spyOn(gameInstance, 'beginGame');
      
      const startPromise = gameInstance.startGame('song1');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockDecodeAudioData).toHaveBeenCalled();
      expect(beginGameSpy).not.toHaveBeenCalled();
      
      decodeAudioDataResolve({});
      await decodeAudioDataPromise;
      await startPromise;
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(gameInstance.gameState.isAudioReady).toBe(true);
      expect(beginGameSpy).toHaveBeenCalled();
    });
    
    test('没有音频URL时应该直接开始游戏', async () => {
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
      const beginGameSpy = jest.spyOn(gameInstance, 'beginGame');
      
      await gameInstance.startGame('song1');
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(gameInstance.gameState.isAudioReady).toBe(true);
      expect(beginGameSpy).toHaveBeenCalled();
    });
    
    test('音频加载失败时应该降级处理并继续游戏', async () => {
      const mockDecodeAudioData = jest.fn().mockRejectedValue(new Error('解码失败'));
      const mockAudioContext = {
        decodeAudioData: mockDecodeAudioData,
        createBufferSource: jest.fn().mockReturnValue({
          buffer: null,
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn()
        })
      };
      
      global.AudioContext = jest.fn().mockImplementation(() => mockAudioContext);
      
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/songs/song1')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 'song1',
              name: '测试歌曲',
              audioUrl: '/audio/test.mp3',
              notes: [{ time: 1000, lane: 0 }],
              duration: 30000
            })
          });
        }
        if (url.includes('/audio')) {
          return Promise.resolve({
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      const beginGameSpy = jest.spyOn(gameInstance, 'beginGame');
      
      await gameInstance.startGame('song1');
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(gameInstance.gameState.isAudioReady).toBe(true);
      expect(beginGameSpy).toHaveBeenCalled();
    });
    
    test('应该显示加载状态提示', async () => {
      let decodeAudioDataResolve;
      const decodeAudioDataPromise = new Promise(resolve => {
        decodeAudioDataResolve = resolve;
      });
      
      const mockDecodeAudioData = jest.fn().mockReturnValue(decodeAudioDataPromise);
      const mockAudioContext = {
        decodeAudioData: mockDecodeAudioData,
        createBufferSource: jest.fn().mockReturnValue({
          buffer: null,
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn()
        })
      };
      
      global.AudioContext = jest.fn().mockImplementation(() => mockAudioContext);
      
      global.fetch.mockImplementation((url) => {
        if (url.includes('/api/songs/song1')) {
          return Promise.resolve({
            json: () => Promise.resolve({
              id: 'song1',
              name: '测试歌曲',
              audioUrl: '/audio/test.mp3',
              notes: [{ time: 1000, lane: 0 }],
              duration: 30000
            })
          });
        }
        if (url.includes('/audio')) {
          return Promise.resolve({
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
          });
        }
        return Promise.resolve({
          json: () => Promise.resolve([])
        });
      });
      
      const gameInstance = new MusicRhythmGame();
      
      const startPromise = gameInstance.startGame('song1');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      let loadingDiv = document.getElementById('loading-message');
      expect(loadingDiv).not.toBeNull();
      expect(loadingDiv.textContent).toBeTruthy();
      
      decodeAudioDataResolve({});
      await decodeAudioDataPromise;
      await startPromise;
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      loadingDiv = document.getElementById('loading-message');
      expect(loadingDiv).toBeNull();
    });
  });
  
  describe('音画同步补偿', () => {
    test('游戏时间应该基于音频开始时间', async () => {
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
      
      const originalStartTime = gameInstance.gameState.startTime;
      
      gameInstance.beginGame();
      
      expect(gameInstance.gameState.startTime).toBeGreaterThan(0);
      
      gameInstance.gameState.currentTime = 1500;
      
      expect(gameInstance.gameState.currentTime).toBe(1500);
    });
    
    test('音符位置计算应该基于正确的时间偏移', async () => {
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
      
      gameInstance.beginGame();
      
      gameInstance.gameState.currentTime = 500;
      
      const noteTime = 1000;
      
      const noteX = gameInstance.calculateNoteX(noteTime);
      
      const timeUntilHit = noteTime - 500;
      const expectedDistance = (timeUntilHit / 1000) * gameInstance.noteSpeed;
      const expectedX = gameInstance.judgmentLineX + expectedDistance;
      
      expect(noteX).toBeCloseTo(expectedX, 0);
    });
  });
});
