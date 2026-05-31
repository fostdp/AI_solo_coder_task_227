beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      json: () => Promise.resolve([]),
      ok: true
    })
  );

  if (!window.AudioContext) {
    window.AudioContext = jest.fn(() => ({
      decodeAudioData: jest.fn().mockResolvedValue({}),
      createBufferSource: jest.fn(() => ({
        buffer: null,
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn()
      }))
    }));
  }

  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn()
    },
    writable: true,
    configurable: true
  });

  if (!global.performance || !global.performance.now || typeof global.performance.now.mockReturnValue !== 'function') {
    const mockNow = jest.fn(() => Date.now());
    global.performance = {
      now: mockNow
    };
  } else {
    global.performance.now.mockReset();
    global.performance.now.mockReturnValue(Date.now());
  }

  if (window.Touch === undefined) {
    window.Touch = class Touch {
      constructor(params) {
        Object.assign(this, params);
      }
    };
  }

  if (window.TouchEvent === undefined) {
    window.TouchEvent = class TouchEvent extends Event {
      constructor(type, params = {}) {
        super(type, params);
        this.changedTouches = params.changedTouches || [];
        this.touches = params.touches || [];
        this.targetTouches = params.targetTouches || [];
      }
    };
  }

  if (!HTMLCanvasElement.prototype.getContext) {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
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
      textBaseline: ''
    }));
  }

  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    value: jest.fn(() => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 500,
      width: 800,
      height: 500,
      x: 0,
      y: 0
    })),
    configurable: true
  });
});

afterEach(() => {
  if (typeof global.fetch.mockClear === 'function') {
    global.fetch.mockClear();
  }
  
  if (typeof global.performance.now.mockReset === 'function') {
    global.performance.now.mockReset();
  }
});
