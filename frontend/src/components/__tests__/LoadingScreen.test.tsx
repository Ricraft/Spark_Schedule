import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { LoadingScreen } from '../LoadingScreen';

const playMock = jest.fn();
const pauseMock = jest.fn();
let matchMediaMatches = false;
let mediaChangeListener: ((event: MediaQueryListEvent) => void) | null = null;

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: playMock });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pauseMock });
});

beforeEach(() => {
  playMock.mockReset().mockResolvedValue(undefined);
  pauseMock.mockReset();
  matchMediaMatches = false;
  mediaChangeListener = null;
  window.matchMedia = jest.fn((query: string) => ({
    matches: matchMediaMatches,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
      mediaChangeListener = listener;
    }),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  } as unknown as MediaQueryList));
});

describe('LoadingScreen reduced-motion behavior', () => {
  it('uses user-facing brand and progress wording without internal filenames', () => {
    const { container } = render(<LoadingScreen progress={25} disableMotion />);
    expect(container).toHaveTextContent('SPARK');
    expect(container).toHaveTextContent('正在加载任务');
    expect(container.textContent).not.toMatch(/courses\.json|tasks\.json|settings\.json|WebSocket|QWebChannel/);
  });

  it('does not render or request the startup video when the user disables UI animation', () => {
    const { container } = render(<LoadingScreen progress={25} disableMotion />);
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('.loading-screen')).toHaveClass('motion-disabled');
    expect(playMock).not.toHaveBeenCalled();
  });

  it('does not render the startup video when the OS requests reduced motion', () => {
    matchMediaMatches = true;
    const { container } = render(<LoadingScreen progress={25} />);
    expect(container.querySelector('video')).toBeNull();
    expect(playMock).not.toHaveBeenCalled();
  });

  it('plays the video only after media data is ready when motion is allowed', () => {
    const { container } = render(<LoadingScreen progress={25} />);
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(playMock).not.toHaveBeenCalled();
    fireEvent.loadedData(video!);
    expect(playMock).toHaveBeenCalledTimes(1);
  });

  it('stops requesting video when the OS preference changes to reduced motion', () => {
    const { container } = render(<LoadingScreen progress={25} />);
    expect(container.querySelector('video')).toBeInTheDocument();
    act(() => mediaChangeListener?.({ matches: true } as MediaQueryListEvent));
    expect(container.querySelector('video')).toBeNull();
  });
});
