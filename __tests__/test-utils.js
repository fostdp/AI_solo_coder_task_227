const fs = require('fs');
const path = require('path');

let gameLoaded = false;

function setupCanvasMock() {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: jest.fn(() => ({
      clearRect: jest.fn(),
      fillStyle: '',
      fillRect: jest.fn(),
      strokeStyle: '',
      lineWidth: 0,
      strokeRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      fillText: jest.fn(),
      font: '',
      textAlign: '',
      textBaseline: '',
      createLinearGradient: jest.fn(() => ({
        addColorStop: jest.fn()
      })),
      arc: jest.fn(),
      fill: jest.fn(),
      closePath: jest.fn()
    })),
    configurable: true,
    writable: true
  });
}

function loadGameCode() {
  if (gameLoaded) {
    return;
  }
  
  setupCanvasMock();
  
  let gameCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'game.js'), 'utf8');
  
  gameCode = gameCode.replace(
    /document\.addEventListener\('DOMContentLoaded',[\s\S]*?\);?\s*$/,
    ''
  );
  
  gameCode = gameCode.replace(
    /class MusicRhythmGame/,
    'window.MusicRhythmGame = class MusicRhythmGame'
  );
  
  try {
    eval(gameCode);
    gameLoaded = true;
  } catch (error) {
    console.error('加载游戏代码失败:', error);
    console.error('错误位置:', error.stack);
    throw error;
  }
}

function setupDOM() {
  document.body.innerHTML = `
    <div id="app">
      <div id="menu-screen" class="screen">
        <h1>🎵 音乐节拍闯关 🎵</h1>
        <h2>选择歌曲</h2>
        <div id="song-list" class="song-list"></div>
      </div>
      
      <div id="game-screen" class="screen hidden">
        <div class="game-info">
          <div class="info-item">
            <span class="label">歌曲:</span>
            <span id="current-song" class="value"></span>
          </div>
          <div class="info-item">
            <span class="label">分数:</span>
            <span id="score" class="value">0</span>
          </div>
          <div class="info-item">
            <span class="label">连击:</span>
            <span id="combo" class="value">0</span>
          </div>
          <div class="info-item">
            <span class="label">判定:</span>
            <span id="judgment" class="value"></span>
          </div>
        </div>
        
        <canvas id="game-canvas" width="800" height="500"></canvas>
        
        <div class="controls">
          <div class="key-hints">
            <div class="key-hint" data-lane="0">D</div>
            <div class="key-hint" data-lane="1">F</div>
            <div class="key-hint" data-lane="2">J</div>
            <div class="key-hint" data-lane="3">K</div>
          </div>
          <p>使用 D、F、J、K 键对应 4 个轨道</p>
        </div>
      </div>
      
      <div id="result-screen" class="screen hidden">
        <h2>🎉 游戏结束 🎉</h2>
        <div class="result-info">
          <div class="result-item">
            <span class="label">歌曲:</span>
            <span id="result-song" class="value"></span>
          </div>
          <div class="result-item">
            <span class="label">总分:</span>
            <span id="result-score" class="value"></span>
          </div>
          <div class="result-item">
            <span class="label">最高连击:</span>
            <span id="result-combo" class="value"></span>
          </div>
          <div class="result-item">
            <span class="label">Perfect:</span>
            <span id="result-perfect" class="value"></span>
          </div>
          <div class="result-item">
            <span class="label">Good:</span>
            <span id="result-good" class="value"></span>
          </div>
          <div class="result-item">
            <span class="label">Miss:</span>
            <span id="result-miss" class="value"></span>
          </div>
        </div>
        <button id="back-to-menu" class="btn">返回菜单</button>
      </div>
    </div>
  `;
}

function teardownDOM() {
  document.body.innerHTML = '';
}

function getGameClass() {
  return window.MusicRhythmGame;
}

module.exports = {
  loadGameCode,
  setupDOM,
  teardownDOM,
  getGameClass
};
