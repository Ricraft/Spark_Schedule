import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  CourseManagerPanel: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="course-manager-panel">课程管理面板</div> : null,
}));

jest.mock('../../components/ImportSchedulerModal', () => ({
  __esModule: true,
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="import-modal">导入弹窗</div> : null,
}));

const renderSchedule = () =>
  render(
    <MemoryRouter initialEntries={['/schedule']}>
      <Schedule />
    </MemoryRouter>
  );

const makeCourse = (id: string, name: string): Course => ({
  id,
  name,
  teacher: '张老师',
  location: 'A-101',
  weeks: [1],
  day: 1,
  start: 1,
  duration: 2,
  color: '#8B5CF6',
});

describe('Schedule UI feedback regression tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    scheduleState = {
      ...baseScheduleState,
      refresh: jest.fn(),
      saveCourse: jest.fn(),
      removeCourse: jest.fn(),
      getCurrentWeek: jest.fn(async () => 1),
      setCurrentWeek: setCurrentWeekMock,
      courses: [],
      loading: false,
      currentWeek: 1,
    };
  });

  it('shows loading feedback when schedule data is loading', () => {
    scheduleState = {
      ...scheduleState,
      loading: true,
      courses: [],
      loadingProgress: 35,
    };

    renderSchedule();

    expect(screen.getByText(/正在加载课表/)).toBeInTheDocument();
    expect(screen.getByText(/35%/)).toBeInTheDocument();
  });

  it('opens course manager panel when clicking add course', async () => {
    renderSchedule();

    fireEvent.click(screen.getByRole('button', { name: '添加课程' }));

    await waitFor(() => {
      expect(screen.getByTestId('course-manager-panel')).toBeInTheDocument();
    });
  });

  it('renders interactive course cards with transition classes', async () => {
    const course = makeCourse('c-1', '课程-测试');
    scheduleState = {
      ...scheduleState,
      loading: false,
      currentWeek: 1,
      courses: [course],
    };

    const { unmount } = renderSchedule();

    const titleNode = await screen.findByText('课程-测试');
    const card = titleNode.closest('div');

    expect(card).toBeTruthy();
    expect(card?.className).toContain('transition-all');
    expect(card?.className).toContain('cursor-pointer');

    unmount();
  });
});
