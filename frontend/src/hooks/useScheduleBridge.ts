import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Course } from '../types/Course';
import { SafeStorage } from '../utils/safeStorage';

let globalBridge: any = null;
let bridgeInitInProgress = false;
let bridgePromise: Promise<any> | null = null;
let signalsBound = false;
let lastScheduleSyncAt = 0;

const CACHE_KEY = 'wakeup_courses';
const FRESH_CACHE_MS = 15000;

const getAnyBridge = (): any => {
  const fromWindow = (window as any).pyBridge;
  const fromGlobal = (globalThis as any).globalBridge;
  return fromWindow || fromGlobal || globalBridge || null;
};

export const __resetScheduleBridgeStateForTests = () => {
  globalBridge = null;
  bridgeInitInProgress = false;
  bridgePromise = null;
  signalsBound = false;
  lastScheduleSyncAt = 0;
};

const normalizeWeeks = (input: any): number[] => {
  if (Array.isArray(input)) return input.map(Number).filter((n) => !Number.isNaN(n));
  if (typeof input === 'number') return [input];
  if (typeof input === 'string') {
    if (input.includes('-')) {
      const [start, end] = input.split('-').map(Number);
      if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end) {
        const arr: number[] = [];
        for (let i = start; i <= end; i++) arr.push(i);
        return arr;
      }
    }
    if (input.includes(',')) return input.split(',').map(Number).filter((n) => !Number.isNaN(n));
    const single = Number(input);
    return Number.isNaN(single) ? [] : [single];
  }
  return [];
};

const dispatchScheduleUpdate = (action: string, courses?: any[]) => {
  window.dispatchEvent(
    new CustomEvent('scheduleDataUpdated', {
      detail: { action, courses },
    })
  );
};

const ensureSignalsConnected = (py: any) => {
  if (!py || signalsBound) return;

  if (py.scheduleLoaded?.connect) {
    py.scheduleLoaded.connect((jsonStr: string) => {
      try {
        const data = JSON.parse(jsonStr);
        if (Array.isArray(data)) dispatchScheduleUpdate('signal_update', data);
      } catch {
        // ignore malformed payload
      }
    });
  }

  if (py.dataStateChanged?.connect) {
    py.dataStateChanged.connect((state: string) => {
      if (typeof state !== 'string') return;
      const lower = state.toLowerCase();
      if (lower.includes('cleared')) dispatchScheduleUpdate('clear', []);
      if (lower.includes('imported_instant')) dispatchScheduleUpdate('refresh_request');
    });
  }

  if (py.asyncOperationProgress?.connect) {
    py.asyncOperationProgress.connect((operationId: string, percent: number) => {
      window.dispatchEvent(
        new CustomEvent('asyncOperationProgress', {
          detail: { operationId, percent },
        })
      );
    });
  }

  if (py.asyncOperationCompleted?.connect) {
    py.asyncOperationCompleted.connect((operationId: string, payload: string) => {
      window.dispatchEvent(
        new CustomEvent('asyncOperationCompleted', {
          detail: { operationId, payload },
        })
      );
    });
  }

  if (py.asyncOperationFailed?.connect) {
    py.asyncOperationFailed.connect((operationId: string, error: string) => {
      window.dispatchEvent(
        new CustomEvent('asyncOperationFailed', {
          detail: { operationId, error },
        })
      );
    });
  }

  signalsBound = true;
};

const initBridge = async (): Promise<any> => {
  if (globalBridge) return globalBridge;
  if (bridgePromise) return bridgePromise;

  bridgePromise = new Promise((resolve, reject) => {
    const direct = getAnyBridge();
    if (direct) {
      globalBridge = direct;
      (window as any).pyBridge = direct;
      (globalThis as any).globalBridge = direct;
      ensureSignalsConnected(direct);
      resolve(direct);
      return;
    }

    if (bridgeInitInProgress) return;
    bridgeInitInProgress = true;

    let retries = 0;
    const maxRetries = 50;
    const timer = setInterval(() => {
      const qt = (window as any).qt?.webChannelTransport;
      const QWebChannel = (window as any).QWebChannel;
      retries += 1;

      if (qt && QWebChannel) {
        clearInterval(timer);
        new QWebChannel(qt, (channel: any) => {
          const py = channel?.objects?.bridge;
          if (!py) {
            reject(new Error('Bridge object unavailable'));
            return;
          }
          globalBridge = py;
          (window as any).pyBridge = py;
          (globalThis as any).globalBridge = py;
          ensureSignalsConnected(py);
          resolve(py);
        });
        return;
      }

      if (retries >= maxRetries) {
        clearInterval(timer);
        reject(new Error('Bridge init timeout'));
      }
    }, 200);
  })
    .catch((error) => {
      bridgePromise = null;
      throw error;
    })
    .finally(() => {
      bridgeInitInProgress = false;
    });

  return bridgePromise;
};

export const useScheduleBridge = () => {
  const [initialCourses] = useState<Course[]>(() => SafeStorage.getItem<Course[]>(CACHE_KEY, []));
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [loading, setLoading] = useState(initialCourses.length === 0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [bridge, setBridge] = useState<any>(getAnyBridge());
  const [currentWeek, setCurrentWeek] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [retryCount] = useState(0);
  const currentCourseOpRef = useRef<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const processAndSetData = useCallback((rawData: any[], shouldClearCache = false) => {
    try {
      const processed: Course[] = rawData.map((item, index) => {
        const weeks = normalizeWeeks(item.week_list ?? item.weeks);
        return {
          ...item,
          id: item.id || `course_${Date.now()}_${index}`,
          name: item.name || 'Unnamed Course',
          teacher: item.teacher || '',
          location: item.location || '',
          day: Number.parseInt(String(item.day), 10) || 1,
          start: Number.parseInt(String(item.start), 10) || 1,
          duration: Number.parseInt(String(item.duration), 10) || 2,
          weeks,
          week_list: weeks,
          color: item.color || '#8B5CF6',
        };
      });

      setCourses(processed);
      lastScheduleSyncAt = Date.now();

      if (processed.length > 0 || shouldClearCache) {
        SafeStorage.setItem(CACHE_KEY, processed);
      }
    } catch {
      // keep UI stable on malformed data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;

    initBridge()
      .then((py) => {
        if (!alive) return;
        setBridge(py);

        const hasLocal = courses.length > 0;
        const isFresh = hasLocal && Date.now() - lastScheduleSyncAt < FRESH_CACHE_MS;
        if (isFresh) return;

        py.get_courses?.()
          .then((json: string) => {
            try {
              const data = JSON.parse(json);
              if (Array.isArray(data)) processAndSetData(data);
            } catch {
              // ignore malformed payload
            }
          })
          .catch(() => {
            setLoading(false);
          });
      })
      .catch(() => {
        if (alive) {
          setError('Bridge unavailable');
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [processAndSetData, courses.length]);

  const handleGlobalEvent = useCallback(
    (event: any) => {
      const detail = event?.detail || {};
      const action = detail.action;

      if (action === '__self_test__') return;

      if (action === 'refresh_request' || action === 'import') {
        setTimeout(() => {
          refresh(false);
        }, 300);
        return;
      }

      if (action === 'clear') {
        processAndSetData([], true);
        return;
      }

      if (Array.isArray(detail.courses)) {
        processAndSetData(detail.courses);
      }
    },
    [processAndSetData]
  );

  useEffect(() => {
    window.addEventListener('scheduleDataUpdated', handleGlobalEvent as EventListener);
    window.addEventListener('schedule-update-event', handleGlobalEvent as EventListener);
    return () => {
      window.removeEventListener('scheduleDataUpdated', handleGlobalEvent as EventListener);
      window.removeEventListener('schedule-update-event', handleGlobalEvent as EventListener);
    };
  }, [handleGlobalEvent]);

  useEffect(() => {
    const onAsyncProgress = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const opId = String(detail.operationId || '');
      if (!currentCourseOpRef.current || opId !== currentCourseOpRef.current) return;
      const percent = Number(detail.percent || 0);
      setLoadingProgress((prev) => Math.max(prev, Math.max(0, Math.min(100, percent))));
    };

    const onAsyncCompleted = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const opId = String(detail.operationId || '');
      if (!currentCourseOpRef.current || opId !== currentCourseOpRef.current) return;
      try {
        const payload = JSON.parse(String(detail.payload || '{}'));
        if (payload?.status === 'success' && Array.isArray(payload.courses)) {
          processAndSetData(payload.courses);
        }
      } catch {
        // ignore
      } finally {
        setLoadingProgress(100);
        setTimeout(() => {
          setLoading(false);
          currentCourseOpRef.current = null;
        }, 120);
      }
    };

    const onAsyncFailed = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const opId = String(detail.operationId || '');
      if (!currentCourseOpRef.current || opId !== currentCourseOpRef.current) return;
      setLoading(false);
      currentCourseOpRef.current = null;
    };

    window.addEventListener('asyncOperationProgress', onAsyncProgress as EventListener);
    window.addEventListener('asyncOperationCompleted', onAsyncCompleted as EventListener);
    window.addEventListener('asyncOperationFailed', onAsyncFailed as EventListener);

    return () => {
      window.removeEventListener('asyncOperationProgress', onAsyncProgress as EventListener);
      window.removeEventListener('asyncOperationCompleted', onAsyncCompleted as EventListener);
      window.removeEventListener('asyncOperationFailed', onAsyncFailed as EventListener);
    };
  }, [processAndSetData]);

  const refresh = useCallback(
    async (showLoading = false) => {
      if (showLoading && courses.length === 0) {
        setLoading(true);
        setLoadingProgress(1);
      }

      const py = globalBridge || bridge || getAnyBridge();
      if (!py) {
        setLoading(false);
        return;
      }

      const safetyTimer = setTimeout(() => setLoading(false), 3000);
      try {
        if (py.get_all_courses) {
          const json = await py.get_all_courses();
          const result = JSON.parse(json);
          if (result?.status === 'pending' && result?.operation_id) {
            currentCourseOpRef.current = String(result.operation_id);
          } else if (result?.status === 'success' && Array.isArray(result?.courses)) {
            processAndSetData(result.courses);
            setLoadingProgress(100);
          } else if (py.get_courses) {
            const fallbackJson = await py.get_courses();
            const fallbackData = JSON.parse(fallbackJson);
            if (Array.isArray(fallbackData)) processAndSetData(fallbackData);
            setLoadingProgress(100);
          }
        } else if (py.get_courses) {
          const json = await py.get_courses();
          const data = JSON.parse(json);
          if (Array.isArray(data)) processAndSetData(data);
          setLoadingProgress(100);
        }
      } catch {
        // ignore transient bridge errors
      } finally {
        clearTimeout(safetyTimer);
        if (!currentCourseOpRef.current) setLoading(false);
      }
    },
    [bridge, courses.length, processAndSetData]
  );

  const removeCourse = useCallback(
    async (id: string) => {
      const py = bridge || getAnyBridge();
      if (py?.delete_course_by_id) {
        await py.delete_course_by_id(id);
      }
      setCourses((prev) => {
        const next = prev.filter((item) => item.id !== id);
        SafeStorage.setItem(CACHE_KEY, next);
        return next;
      });
      lastScheduleSyncAt = Date.now();
      dispatchScheduleUpdate('local_delete');
    },
    [bridge]
  );

  const saveCourse = useCallback(
    async (course: Course) => {
      const py = bridge || getAnyBridge();
      const normalizedCourse: Course = {
        ...course,
        id: course.id || `temp_${Date.now()}`,
        color: course.color || '#8B5CF6',
      };

      if (py) {
        const exists = courses.some((c) => c.id === normalizedCourse.id);
        if (exists && py.update_course) {
          await py.update_course(JSON.stringify(normalizedCourse));
        } else if (py.add_course) {
          await py.add_course(JSON.stringify(normalizedCourse));
        }
      }

      setCourses((prev) => {
        const index = prev.findIndex((item) => item.id === normalizedCourse.id);
        const next = [...prev];
        if (index >= 0) {
          next[index] = normalizedCourse;
        } else {
          next.push(normalizedCourse);
        }
        SafeStorage.setItem(CACHE_KEY, next);
        return next;
      });
      lastScheduleSyncAt = Date.now();
      dispatchScheduleUpdate('local_save');
    },
    [bridge, courses]
  );

  const courseGroups = useMemo(() => {
    const groupsMap = new Map();
    courses.forEach((c: any) => {
      const key = c.groupId || 'default';
      if (!groupsMap.has(key)) {
        groupsMap.set(key, { id: key, name: c.name, color: c.color, course_count: 0 });
      }
      groupsMap.get(key).course_count++;
    });
    return Array.from(groupsMap.values());
  }, [courses]);

  const getWeekCourses = useCallback(
    (week: number) => courses.filter((c) => Array.isArray(c.weeks) && c.weeks.includes(week)),
    [courses]
  );

  const getCurrentWeek = useCallback(async () => {
    const normalize = (value: unknown) => {
      const parsed = Number.parseInt(String(value), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    };

    const applyBoundary = (baseWeek: number, settings?: any) => {
      const maxWeek = Number(settings?.semester_weeks || 0);
      const normalized = Math.max(1, baseWeek);
      if (Number.isFinite(maxWeek) && maxWeek > 0) {
        return Math.min(normalized, Math.trunc(maxWeek));
      }
      return normalized;
    };

    try {
      if (bridge?.get_global_settings) {
        const settingsRaw = await bridge.get_global_settings();
        const settings = JSON.parse(String(settingsRaw));
        const baseWeek = normalize(settings?.current_week);
        const normalized = applyBoundary(baseWeek, settings);
        setCurrentWeek(normalized);
        return normalized;
      }

      if (bridge?.get_current_week) {
        const week = await bridge.get_current_week();
        const normalized = normalize(week);
        setCurrentWeek(normalized);
        return normalized;
      }
    } catch {
      // fall through
    }

    return 1;
  }, [bridge]);

  return {
    bridge,
    courses,
    loading,
    loadingProgress,
    refresh,
    saveCourse,
    removeCourse,
    getWeekCourses,
    currentWeek,
    setCurrentWeek,
    courseGroups,
    error,
    clearError,
    retryCount,
    getCurrentWeek,
  };
};
