import '@testing-library/jest-dom';
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util';

// Polyfill for TextEncoder/TextDecoder
if (typeof globalThis.TextEncoder === 'undefined') {
  Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: NodeTextEncoder });
  Object.defineProperty(globalThis, 'TextDecoder', { configurable: true, value: NodeTextDecoder });
}

// Mock ResizeObserver
class MockResizeObserver {
  callback: ResizeObserverCallback;
  
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = MockResizeObserver;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});