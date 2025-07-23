// Test setup file for Vitest
import { vi } from 'vitest';

// Mock PDF.js worker
global.pdfjsWorker = {};

// Mock Chrome extension APIs
global.chrome = {
  runtime: {
    getURL: vi.fn((path) => `chrome-extension://test/${path}`)
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn()
    }
  }
};

// Mock fetch for testing
global.fetch = vi.fn();

// Mock ArrayBuffer and related APIs
if (typeof ArrayBuffer === 'undefined') {
  global.ArrayBuffer = class ArrayBuffer {
    constructor(length) {
      this.byteLength = length;
    }
  };
}

if (typeof Uint8Array === 'undefined') {
  global.Uint8Array = class Uint8Array extends Array {
    constructor(buffer, offset = 0, length) {
      super();
      this.buffer = buffer;
      this.byteOffset = offset;
      this.byteLength = length || buffer.byteLength;
    }
  };
}

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn()
};