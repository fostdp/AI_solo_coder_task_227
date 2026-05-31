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
