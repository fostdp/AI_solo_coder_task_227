module.exports = {
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    html: '<!DOCTYPE html><html><body><div id="app"><div id="menu-screen" class="screen"></div><div id="game-screen" class="screen hidden"><canvas id="game-canvas"></canvas></div><div id="result-screen" class="screen hidden"></div></div></body></html>'
  },
  testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  setupFiles: ['<rootDir>/jest.setup-after-env.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  verbose: true,
  collectCoverageFrom: ['public/**/*.js', '!public/**/*.test.js']
};