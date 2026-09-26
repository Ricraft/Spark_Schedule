import { renderHook, act, waitFor } from '@testing-library/react';
import { __resetScheduleBridgeStateForTests, useScheduleBridge } from '../useScheduleBridge';
import { Course } from '../../types/Course';

const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

const baseCourse: Course = {
  id: 'c1',
  name: 'Test Course',
  teacher: 'Teacher',
  location: 'Room 101',
  weeks: [1, 2, 3],
  day: 1,
  start: 1,
  duration: 2,
  color: '#8B5CF6',
};

const createBridge = (seedCourses: Course[] = [], weekConfig?: { current_week: number; semester_weeks: number }) => {
  let memory = [...seedCourses];

  return {
    get_courses: jest.fn().mockImplementation(async () => JSON.stringify(memory)),
    add_course: jest.fn().mockImplementation(async (courseJson: string) => {
      memory.push(JSON.parse(courseJson));
      return JSON.stringify({ status: 'success' });
    }),
    update_course: jest.fn().mockImplementation(async (courseJson: string) => {
      const incoming = JSON.parse(courseJson);
      memory = memory.map((c) => (c.id === incoming.id ? incoming : c));
      return JSON.stringify({ status: 'success' });
    }),
    delete_course_by_id: jest.fn().mockImplementation(async (id: string) => {
      memory = memory.filter((c) => c.id !== id);
      return JSON.stringify({ status: 'success' });
    }),
    get_global_settings: jest.fn().mockImplementation(async () =>
      JSON.stringify(
        weekConfig || {
          current_week: 3,
          semester_weeks: 20,
        }
      )
    ),
  };
};

describe('useScheduleBridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetScheduleBridgeStateForTests();
    localStorageMock.getItem.mockReturnValue(null);
    (window as any).pyBridge = undefined;
    (globalThis as any).globalBridge = undefined;
    delete (window as any).qt;
    delete (window as any).QWebChannel;
  });

  afterEach(() => {
    (window as any).pyBridge = undefined;
    (globalThis as any).globalBridge = undefined;
    __resetScheduleBridgeStateForTests();
  });

  it('exposes API and loads courses from bridge', async () => {
    (window as any).pyBridge = createBridge([baseCourse]);

    const { result } = renderHook(() => useScheduleBridge());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.courses.length).toBe(1);
    });

    expect(result.current.courses[0].name).toBe('Test Course');
    expect(typeof result.current.refresh).toBe('function');
    expect(typeof result.current.saveCourse).toBe('function');
    expect(typeof result.current.removeCourse).toBe('function');
    expect(typeof result.current.getCurrentWeek).toBe('function');
  });

  it('saves and updates courses with bridge sync and local state sync', async () => {
    const bridge = createBridge();
    (window as any).pyBridge = bridge;

    const { result } = renderHook(() => useScheduleBridge());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.saveCourse(baseCourse);
    });
    expect(bridge.add_course).toHaveBeenCalledTimes(1);
    expect(result.current.courses.find((c) => c.id === baseCourse.id)?.color).toBe('#8B5CF6');

    await act(async () => {
      await result.current.saveCourse({ ...baseCourse, color: '#FF0000' });
    });
    expect(bridge.update_course).toHaveBeenCalledTimes(1);
    expect(result.current.courses.find((c) => c.id === baseCourse.id)?.color).toBe('#FF0000');
  });

  it('removes courses and keeps local cache in sync', async () => {
    const bridge = createBridge([baseCourse]);
    (window as any).pyBridge = bridge;

    const { result } = renderHook(() => useScheduleBridge());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.courses).toHaveLength(1);

    await act(async () => {
      await result.current.removeCourse(baseCourse.id);
    });

    expect(bridge.delete_course_by_id).toHaveBeenCalledWith(baseCourse.id);
    expect(result.current.courses).toHaveLength(0);
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('handles malformed local cache without crashing', async () => {
    localStorageMock.getItem.mockReturnValue('invalid json');
    (window as any).pyBridge = createBridge([]);

    const { result } = renderHook(() => useScheduleBridge());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(Array.isArray(result.current.courses)).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('clamps current week from backend settings', async () => {
    (window as any).pyBridge = createBridge([], { current_week: 99, semester_weeks: 16 });

    const { result } = renderHook(() => useScheduleBridge());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      const week = await result.current.getCurrentWeek();
      expect(week).toBe(16);
    });

    expect(result.current.currentWeek).toBe(16);
  });
});
