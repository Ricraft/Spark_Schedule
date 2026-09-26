import { useEffect, type MutableRefObject, type RefObject } from 'react';

type BrowserViewBridge = {
  open_web_browser_view?: (config: string) => void;
};

interface UseBrowserPositionSyncOptions<T extends HTMLElement> {
  enabled: boolean;
  elementRef: RefObject<T | null>;
  bridge?: BrowserViewBridge | null;
  initialUrlRef?: MutableRefObject<string | null>;
  eventName?: string;
}

/** Keep the embedded Qt browser aligned with its DOM placeholder without polling. */
export const useBrowserPositionSync = <T extends HTMLElement>({
  enabled,
  elementRef,
  bridge,
  initialUrlRef,
  eventName = 'panel-scroll',
}: UseBrowserPositionSyncOptions<T>) => {
  useEffect(() => {
    if (!enabled) return;

    const element = elementRef.current;
    if (!element || typeof bridge?.open_web_browser_view !== 'function') return;

    let frameId: number | null = null;
    let lastRect: [number, number, number, number] | null = null;
    const requestFrame = window.requestAnimationFrame?.bind(window) ?? ((callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(Date.now()), 0));
    const cancelFrame = window.cancelAnimationFrame?.bind(window) ?? window.clearTimeout.bind(window);

    const syncPosition = () => {
      frameId = null;
      const target = elementRef.current;
      if (!target) return;

      const bounds = target.getBoundingClientRect();
      const rect: [number, number, number, number] = [
        Math.round(bounds.left),
        Math.round(bounds.top),
        Math.round(bounds.width),
        Math.round(bounds.height),
      ];
      const initialUrl = initialUrlRef?.current;
      const unchanged = lastRect?.every((value, index) => value === rect[index]) ?? false;
      if (unchanged && !initialUrl) return;

      const config: { visible: true; x: number; y: number; width: number; height: number; url?: string } = {
        visible: true,
        x: rect[0],
        y: rect[1],
        width: rect[2],
        height: rect[3],
      };
      if (initialUrl) config.url = initialUrl;

      bridge.open_web_browser_view!(JSON.stringify(config));
      lastRect = rect;
      if (initialUrl) initialUrlRef!.current = null;
    };

    const scheduleSync = () => {
      if (frameId !== null) return;
      frameId = requestFrame(syncPosition);
    };

    window.addEventListener('scroll', scheduleSync, { capture: true, passive: true });
    window.addEventListener('resize', scheduleSync);
    window.addEventListener(eventName, scheduleSync);

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleSync);
    observer?.observe(element);
    if (element.parentElement) observer?.observe(element.parentElement);

    scheduleSync();

    return () => {
      window.removeEventListener('scroll', scheduleSync, true);
      window.removeEventListener('resize', scheduleSync);
      window.removeEventListener(eventName, scheduleSync);
      observer?.disconnect();
      if (frameId !== null) cancelFrame(frameId);
    };
  }, [bridge, elementRef, enabled, eventName, initialUrlRef]);
};
