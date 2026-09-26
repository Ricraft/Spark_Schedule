import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import { MemoryRouter } from 'react-router-dom';
import Settings from '../Settings';
import { REDACTED_SECRET } from '@/utils/secrets';

const baseSettings = {
  dark_mode: false,
  midnight_mode: false,
  gpu_acceleration: true,
  ui_transitions: true,
  background_image: '',
  acrylic_opacity: 80,
  enable_notifications: true,
  notification_sound: 'bell',
  auto_save: true,
  enable_auto_backup: true,
  backup_freq: 'daily',
  backup_retention_days: 30,
  auto_start: false,
  minimize_to_tray: true,
  start_minimized: false,
  weather_enabled: true,
  weather_api_key: 'weather-key',
  weather_location: '北京',
  weather_host_url: 'devapi.qweather.com',
  shici_enabled: true,
  ai_learning_enabled: true,
  ai_task_parsing_enabled: true,
  ai_task_base_url: 'https://api.openai.com/v1',
  ai_task_api_key: 'task-key',
  ai_task_model: 'gpt-4o-mini',
  ai_learning_base_url: 'https://api.openai.com/v1',
  ai_learning_api_key: 'learning-key',
  ai_learning_model: 'gpt-4o',
  version: '2.4.0',
  last_modified: '2026-03-06T00:00:00.000Z',
};
let mockSettings: any = { ...baseSettings };

const mockUpdateSettings = jest.fn(async (updates: Record<string, unknown>) => {
  mockSettings = { ...mockSettings, ...updates };
  return true;
});

jest.mock('@/hooks/useSettingsBridge', () => ({
  useSettingsBridge: () => ({
    settings: mockSettings,
    updateSettings: mockUpdateSettings,
    export_all_data: jest.fn(async () => ({ success: true })),
    reset_app_data: jest.fn(async () => ({ success: true })),
    loading: false,
    error: null,
  }),
}));

const renderSettings = () =>
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <Settings />
    </MemoryRouter>
  );

const clickFirstTab = (name: string) => {
  const tabTrigger = screen.getByRole('tab', { name });
  fireEvent.mouseDown(tabTrigger, { button: 0 });
  fireEvent.click(tabTrigger);
};

const resetRuntimeClasses = () => {
  document.documentElement.classList.remove('dark', 'midnight', 'gpu-disabled', 'no-transitions');
  document.documentElement.style.removeProperty('--acrylic-opacity');
  document.documentElement.style.removeProperty('--glass-bg-opacity');
  document.body.classList.remove('gpu-disabled');
  document.body.style.backgroundImage = '';
};

describe('Settings preservation property tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettings = { ...baseSettings };
    resetRuntimeClasses();
    (window as any).pyBridge = {
      clear_runtime_cache: jest.fn().mockResolvedValue(JSON.stringify({ status: 'success' })),
      open_external_url: jest.fn().mockResolvedValue(JSON.stringify({ status: 'success' })),
      select_background_image: jest.fn().mockResolvedValue(JSON.stringify({ success: false, message: '未选择文件' })),
    };
  });

  afterEach(() => {
    resetRuntimeClasses();
  });

  it('applies runtime classes and styles consistently from loaded settings', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          dark_mode: fc.boolean(),
          midnight_mode: fc.boolean(),
          gpu_acceleration: fc.boolean(),
          ui_transitions: fc.boolean(),
          acrylic_opacity: fc.integer({ min: 30, max: 100 }),
          background_image: fc.constantFrom('', 'C:\\wallpaper.jpg', 'D:\\img\\bg.png'),
        }),
        async (runtime) => {
          mockSettings = {
            ...mockSettings,
            ...runtime,
          };

          const { unmount } = renderSettings();

          await waitFor(() => {
            expect(screen.getAllByText('外观与系统').length).toBeGreaterThan(0);
          });

          const expectDark = Boolean(runtime.dark_mode || runtime.midnight_mode);
          expect(document.documentElement.classList.contains('dark')).toBe(expectDark);
          expect(document.documentElement.classList.contains('midnight')).toBe(Boolean(runtime.midnight_mode));
          expect(document.documentElement.classList.contains('gpu-disabled')).toBe(!runtime.gpu_acceleration);
          expect(document.body.classList.contains('gpu-disabled')).toBe(!runtime.gpu_acceleration);
          expect(document.documentElement.classList.contains('no-transitions')).toBe(!runtime.ui_transitions);
          expect(document.documentElement.style.getPropertyValue('--acrylic-opacity')).toBe(
            String(runtime.acrylic_opacity / 100)
          );

          if (runtime.background_image) {
            expect(document.body.style.backgroundImage).toContain('file:///');
          } else {
            expect(document.body.style.backgroundImage).toBe('');
          }

          unmount();
          resetRuntimeClasses();
        }
      ),
      { numRuns: 12 }
    );
  });

  it('keeps key tab triggers visible after render', async () => {
    const { unmount } = renderSettings();
    expect(screen.getAllByText('外观与系统').length).toBeGreaterThan(0);
    expect(screen.getAllByText('通知提醒').length).toBeGreaterThan(0);
    expect(screen.getAllByText('外部服务与 AI').length).toBeGreaterThan(0);
    expect(screen.getAllByText('数据管理').length).toBeGreaterThan(0);
    unmount();
  });

  it('only clears a stored API key after the explicit clear action', async () => {
    mockSettings = { ...baseSettings, weather_api_key: REDACTED_SECRET };
    renderSettings();
    clickFirstTab('外部服务与 AI');
    fireEvent.click(await screen.findByRole('button', { name: '清除 Weather API Key' }));
    fireEvent.click(screen.getByText('同步服务凭据'));
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ weather_api_key: '' }));
    });
  });

  it('never displays the backend secret-redaction marker and round-trips it unchanged', async () => {
    mockSettings = {
      ...baseSettings,
      weather_api_key: REDACTED_SECRET,
      ai_task_api_key: REDACTED_SECRET,
      ai_learning_api_key: REDACTED_SECRET,
    };
    renderSettings();
    clickFirstTab('外部服务与 AI');

    const redactedInputs = await screen.findAllByPlaceholderText(
      '已配置密钥（隐藏）；留空保持不变，输入新密钥可替换'
    );
    expect(redactedInputs).toHaveLength(3);
    redactedInputs.forEach((input) => {
      expect(input).toHaveAttribute('type', 'password');
      expect(input).toHaveValue('');
      expect(input).not.toHaveValue(REDACTED_SECRET);
    });

    fireEvent.click(screen.getByText('保存解析引擎'));
    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ ai_task_api_key: REDACTED_SECRET }));
    });
  });
});
