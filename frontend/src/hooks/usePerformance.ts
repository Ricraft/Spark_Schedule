/**
 * React 性能优化 Hooks
 */

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { performanceOptimizer } from '../utils/performanceOptimizer';

/**
 * 虚拟滚动 Hook
 * 用于优化大列表渲染性能
 */
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 3
) {
  const scrollTop = useRef(0);

  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop.current / itemHeight);
    const end = Math.ceil((scrollTop.current + containerHeight) / itemHeight);

    return {
      start: Math.max(0, start - overscan),
      end: Math.min(items.length, end + overscan),
    };
  }, [scrollTop.current, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end).map((item, index) => ({
      item,
      index: visibleRange.start + index,
      style: {
        position: 'absolute' as const,
        top: (visibleRange.start + index) * itemHeight,
        height: itemHeight,
        width: '100%',
      },
    }));
  }, [items, visibleRange, itemHeight]);

  const totalHeight = items.length * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    scrollTop.current = e.currentTarget.scrollTop;
  }, []);

  return {
    visibleItems,
    totalHeight,
    handleScroll,
  };
}

/**
 * 防抖 Hook
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 节流 Hook
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(Date.now());

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastRun.current >= delay) {
        lastRun.current = now;
        callback(...args);
      }
    },
    [callback, delay]
  ) as T;
}

/**
 * 交叉观察器 Hook
 * 用于懒加载和可见性检测
 */
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return isIntersecting;
}

/**
 * 性能监控 Hook
 */
export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current += 1;
    const renderTime = Date.now() - startTime.current;

    if (renderTime > 16) {
      // 超过一帧的时间（16ms）
      console.warn(
        `⚠️ [Performance] ${componentName} 渲染耗时 ${renderTime}ms (第 ${renderCount.current} 次渲染)`
      );
    }

    startTime.current = Date.now();
  });

  return {
    renderCount: renderCount.current,
  };
}

/**
 * 优化的列表渲染 Hook
 */
export function useOptimizedList<T>(
  items: T[],
  containerRef: React.RefObject<HTMLElement>
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 应用性能优化
    const status = performanceOptimizer.getStatus();
    if (!status.gpuEnabled || status.performanceMode === 'low') {
      container.style.contain = 'layout style paint';
      container.style.contentVisibility = 'auto';
    }
  }, [containerRef]);

  return items;
}

/**
 * 请求空闲回调 Hook
 */
export function useIdleCallback(callback: () => void, deps: React.DependencyList = []) {
  useEffect(() => {
    performanceOptimizer.requestIdleCallback(callback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * 图片懒加载 Hook
 */
export function useLazyImage(src: string) {
  const [imageSrc, setImageSrc] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);

  const isVisible = useIntersectionObserver(imgRef, {
    rootMargin: '50px',
  });

  useEffect(() => {
    if (isVisible && !imageSrc) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setImageSrc(src);
        setIsLoading(false);
      };
      img.onerror = () => {
        setIsLoading(false);
      };
    }
  }, [isVisible, src, imageSrc]);

  return {
    imgRef,
    imageSrc,
    isLoading,
  };
}

/**
 * 动画帧 Hook
 */
export function useAnimationFrame(callback: (deltaTime: number) => void, deps: React.DependencyList = []) {
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== null) {
      const deltaTime = time - previousTimeRef.current;
      callback(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [callback]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * 媒体查询 Hook
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * 窗口大小 Hook（带节流）
 */
export function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = performanceOptimizer.throttle(() => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }, 200);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}
