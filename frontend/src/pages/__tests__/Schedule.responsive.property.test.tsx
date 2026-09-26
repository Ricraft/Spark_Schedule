import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Schedule from '../Schedule';
import type { Course } from '../../types/Course';

const setCurrentWeekMock = jest.fn();

const baseScheduleState = {
  bridge: {},
  courses: [] as Course[],
  courseGroups: [],
  loading: false,
  loadingProgress: 0,
  refresh: jest.fn(),
  saveCourse: jest.fn(),
  removeCourse: jest.fn(),
  currentWeek: 1,
  setCurrentWeek: setCurrentWeekMock,
  getCurrentWeek: jest.fn(async () => 1),
  error: null,
  clearError: jest.fn(),
  retryCount: 0,
};

let scheduleState = { ...baseScheduleState };

jest.mock('../../hooks/useScheduleBridge', () => ({
  useScheduleBridge: () => scheduleState,
}));

jest.mock('../../hooks/useSettingsBridge', () => {
  const stableSettings = {
    semester_weeks: 20,
    current_week: 1,
    start_date: '2026-03-02',
    show_weekends: true,
    time_slot_height: 80,
    ui_animations: true,
    section_duration: 45,
    break_duration: 10,
    sections_per_day: 12,
    course_opacity: 0.9,
    schedule_opacity: 0.2,
    show_grid_lines: true,
    show_time_indicator: false,
    highlight_today: true,
    show_teacher: true,
    show_location: true,
    auto_save: true,
    auto_color_import: true,
    enable_course_grouping: true,
    enable_notifications: true,
    enable_auto_backup: true,
    backup_freq: 'daily',
    backup_retention_days: 30,
    log_level: 'warn',
    version: '2.4.0',
    last_modified: '2026-03-06T00:00:00.000Z',
  };

  return {
    useSettingsBridge: () => ({
      settings: stableSettings,
    }),
  };
});

jest.mock('../../components/CourseManagerPanel', () => ({
  CourseManagerPanel: () => null,
}));

jest.mock('../../components/ImportSchedulerModal', () => ({
  __esModule: true,
  default: () => null,
}));

const renderSchedule = () =>
  render(
    <MemoryRouter initialEntries={['/schedule']}>
      <Schedule />
    </MemoryRouter>
  );

const demoCourse: Course = {
  id: 'demo-1',
  name: '线性代数',
  teacher: '李老师',
  location: 'B-201',
  weeks: [1],
  day: 1,
  start: 1,
  duration: 2,
  color: '#3B82F6',
};

describe('Schedule responsive layout regression tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    scheduleState = {
      ...baseScheduleState,
      refresh: jest.fn(),
      saveCourse: jest.fn(),
      removeCourse: jest.fn(),
      getCurrentWeek: jest.fn(async () => 1),
      setCurrentWeek: setCurrentWeekMock,
      loading: false,
      courses: [demoCourse],
      currentWeek: 1,
    };
  });

  it('keeps vertical scroll area and hides horizontal overflow', () => {
    const { container } = renderSchedule();

    const scrollArea = container.querySelector('.custom-scrollbar');
    expect(scrollArea).toBeTruthy();
    expect(scrollArea?.className).toContain('overflow-x-hidden');
    expect(screen.getByText('线性代数')).toBeInTheDocument();
  });

  it('renders stably across representative viewport sizes', () => {
    const viewports = [
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1366, height: 768 },
    ];

    const { unmount } = renderSchedule();

    viewports.forEach(({ width, height }) => {
      Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: height, configurable: true, writable: true });
      fireEvent(window, new Event('resize'));

      expect(screen.getAllByText('主课表').length).toBeGreaterThan(0);
      expect(screen.getByText('线性代数')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '添加课程' })).toBeInTheDocument();
    });

    unmount();
  });
});

