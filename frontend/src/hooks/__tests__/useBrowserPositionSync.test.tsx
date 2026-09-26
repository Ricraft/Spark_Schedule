import { act, renderHook } from '@testing-library/react';
import { useBrowserPositionSync } from '../useBrowserPositionSync';

const originalAnimationFrame = Object.getOwnPropertyDescriptor(window, 'requestAnimationFrame');
const originalCancelAnimationFrame = Object.getOwnPropertyDescriptor(window, 'cancelAnimationFrame');
const originalResizeObserver = globalThis.ResizeObserver;

let frameId = 0;
let callbacks = new Map<number, FrameRequestCallback>();
let resizeCallback: ResizeObserverCallback | null = null;

const flushFrames = () => {
  const pending = Array.from(callbacks.values());
  callbacks.clear();
  act(() => pending.forEach((callback) => callback(16)));
};

describe('useBrowserPositionSync', () => {
  let element: HTMLDivElement;
  let rect: { left: number; top: number; width: number; height: number };
  let bridge: { open_web_browser_view: jest.Mock };
  let initialUrlRef: { current: string | null };

  beforeEach(() => {
    frameId = 0;
    callbacks = new Map();
    rect = { left: 10, top: 20, width: 320, height: 180 };
    element = document.createElement('div');
    document.body.appendChild(element);
    element.getBoundingClientRect = jest.fn(() => ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    } as DOMRect));
    bridge = { open_web_browser_view: jest.fn() };
    initialUrlRef = { current: 'https://portal.example.edu' };

    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: jest.fn((callback: FrameRequestCallback) => {
        const nextId = ++frameId;
        callbacks.set(nextId, callback);
        return nextId;
      }),
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: jest.fn((id: number) => callbacks.delete(id)),
    });
    class TestResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe(_target: Element, _options?: ResizeObserverOptions) {}
      unobserve(_target: Element) {}
      disconnect() {}
    }
    globalThis.ResizeObserver = TestResizeObserver;
  });

  afterEach(() => {
    element.remove();
    resizeCallback = null;
    if (originalAnimationFrame) Object.defineProperty(window, 'requestAnimationFrame', originalAnimationFrame);
    else delete (window as any).requestAnimationFrame;
    if (originalCancelAnimationFrame) Object.defineProperty(window, 'cancelAnimationFrame', originalCancelAnimationFrame);
    else delete (window as any).cancelAnimationFrame;
    globalThis.ResizeObserver = originalResizeObserver;
  });

  it('coalesces geometry events and bridges only changed integer bounds', () => {
    const elementRef = { current: element } as React.RefObject<HTMLDivElement | null>;
    const { unmount } = renderHook(() => useBrowserPositionSync({
      enabled: true,
      elementRef,
      bridge,
      initialUrlRef,
    }));

    flushFrames();
    expect(bridge.open_web_browser_view).toHaveBeenCalledTimes(1);
    expect(JSON.parse(bridge.open_web_browser_view.mock.calls[0][0])).toEqual({
      visible: true,
      x: 10,
      y: 20,
      width: 320,
      height: 180,
      url: 'https://portal.example.edu',
    });
    expect(initialUrlRef.current).toBeNull();

    act(() => {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('panel-scroll'));
    });
    flushFrames();
    expect(bridge.open_web_browser_view).toHaveBeenCalledTimes(1);

    rect.top = 27;
    act(() => window.dispatchEvent(new Event('scroll')));
    flushFrames();
    expect(bridge.open_web_browser_view).toHaveBeenCalledTimes(2);
    expect(JSON.parse(bridge.open_web_browser_view.mock.calls[1][0])).toMatchObject({ y: 27 });

    rect.width = 400;
    act(() => resizeCallback?.([] as ResizeObserverEntry[], {} as ResizeObserver));
    flushFrames();
    expect(bridge.open_web_browser_view).toHaveBeenCalledTimes(3);
    expect(JSON.parse(bridge.open_web_browser_view.mock.calls[2][0])).toMatchObject({ width: 400 });

    unmount();
    rect.left = 90;
    act(() => window.dispatchEvent(new Event('scroll')));
    flushFrames();
    expect(bridge.open_web_browser_view).toHaveBeenCalledTimes(3);
  });
});
