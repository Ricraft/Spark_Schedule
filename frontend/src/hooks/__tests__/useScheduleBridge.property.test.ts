import { renderHook, act, waitFor } from '@testing-library/react';
import { __resetScheduleBridgeStateForTests, useScheduleBridge } from '../useScheduleBridge';
import type { Course } from '../../types/Course';

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

const buildBridge = (seedCourses: Course[] = [], weekConfig?: { current_week: number; semester_weeks: number }) => {
  let memory = [...seedCourses];
  return {
    get_courses: jest.fn(async () => JSON.stringify(memory)),
    add_course: jest.fn(async (raw: string) => {
      memory.push(JSON.parse(raw));
      return JSON.stringify({ status: 'success' });
    }),
    update_course: jest.fn(async (raw: string) => {
      const incoming = JSON.parse(raw);
      memory = memory.map((item) => (item.id === incoming.id ? incoming : item));
      return JSON.stringify({ status: 'success' });
    }),
    delete_course_by_id: jest.fn(async (id: string) => {
      memory = memory.filter((item) => item.id !== id);
      return JSON.stringify({ status: 'success' });
    }),
    get_global_settings: jest.fn(async () =>
      JSON.stringify(
        weekConfig || {
          current_week: 3,
          semester_weeks: 20,
        }
      )
    ),
  };
};

describe('useScheduleBridge regression tests', () => {
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

  it('loads courses from bridge and normalizes week_list formats', async () => {
    const bridge = buildBridge([
      {
        id: 'c-1',
        name: '高等数学',
        teacher: '王老师',
        location: 'A-101',
        week_list: '1-3',
        day: 1,
        start: 1,
        duration: 2,
        color: '#8B5CF6',
      } as any,
      {
        id: 'c-2',
        name: '英语',
        teacher: '李老师',
        location: 'B-202',
        week_list: [2, 4],
        day: 2,
        start: 3,
        duration: 2,
        color: '#3B82F6',
      } as any,
    ]);
    (window as any).pyBridge = bridge;

    const { result } = renderHook(() => useScheduleBridge());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.courses).toHaveLength(2);
    expect(result.current.courses[0].weeks).toEqual([1, 2, 3]);
    expect(result.current.courses[1].weeks).toEqual([2, 4]);
  });

  it('saveCourse and removeCourse keep local state consistent', async () => {
    const bridge = buildBridge([]);
    (window as any).pyBridge = bridge;

    const { result } = renderHook(() => useScheduleBridge());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const course: Course = {
      id: 'course-1',
      name: '编译原理',
      teacher: '赵老师',
      location: 'C-301',
      weeks: [1, 2],
      day: 3,
      start: 5,
      duration: 2,
      color: '#10B981',
    };

    await act(async () => {
      await result.current.saveCourse(course);
    });

    expect(bridge.add_course).toHaveBeenCalledTimes(1);
    expect(result.current.courses.find((c) => c.id === course.id)).toBeDefined();

    await act(async () => {
      await result.current.removeCourse(course.id);
    });

    expect(bridge.delete_course_by_id).toHaveBeenCalledWith(course.id);
    expect(result.current.courses.find((c) => c.id === course.id)).toBeUndefined();
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('getCurrentWeek clamps value by semester_weeks upper bound', async () => {
    const bridge = buildBridge([], {
      current_week: 21,
      semester_weeks: 16,
    });
    (window as any).pyBridge = bridge;

    const { result } = renderHook(() => useScheduleBridge());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let week = 0;
    await act(async () => {
      week = await result.current.getCurrentWeek();
    });

    expect(week).toBe(16);
    expect(result.current.currentWeek).toBe(16);
  });

  it('getCurrentWeek falls back to 1 for invalid settings values', async () => {
    const bridge = buildBridge([], {
      current_week: -10,
      semester_weeks: 0,
    });
    (window as any).pyBridge = bridge;

    const { result } = renderHook(() => useScheduleBridge());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let week = 99;
    await act(async () => {
      week = await result.current.getCurrentWeek();
    });

    expect(week).toBe(1);
    expect(result.current.currentWeek).toBe(1);
  });
});
