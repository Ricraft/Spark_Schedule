import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Settings from '../Settings';

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
const mockExportAllData = jest.fn(async () => ({ success: true }));
const mockResetAppData = jest.fn(async () => ({ success: true }));

jest.mock('@/hooks/useSettingsBridge', () => ({
  useSettingsBridge: () => ({
    settings: mockSettings,
    updateSettings: mockUpdateSettings,
    export_all_data: mockExportAllData,
    reset_app_data: mockResetAppData,
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
  const tabTriggers = screen.getAllByText(name);
  fireEvent.click(tabTriggers[0]);
};

describe('Settings regression checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettings = { ...baseSettings };

    (window as any).pyBridge = {
      select_background_image: jest.fn().mockResolvedValue(
        JSON.stringify({ success: true, path: 'C:\\Users\\OMEN\\Pictures\\wallpaper.jpg' })
      ),
      clear_runtime_cache: jest.fn().mockResolvedValue(JSON.stringify({ status: 'success' })),
      open_external_url: jest.fn().mockResolvedValue(JSON.stringify({ status: 'success' })),
    };

    document.documentElement.classList.remove('dark', 'midnight', 'gpu-disabled', 'no-transitions');
    document.body.classList.remove('gpu-disabled');
    document.body.style.backgroundImage = '';
  });

  it('wires key toggles to backend updates', async () => {
    renderSettings();

    fireEvent.click(screen.getByRole('switch', { name: 'GPU 硬件加速' }));

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({ gpu_acceleration: false });
    });
  });

  it('renders data management tab trigger', async () => {
    renderSettings();
    expect(screen.getAllByText('数据管理').length).toBeGreaterThan(0);
  });

  it('renders services tab trigger', async () => {
    renderSettings();
    expect(screen.getAllByText('外部服务与 AI').length).toBeGreaterThan(0);
  });

  it('applies selected background image and persists through updateSettings', async () => {
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: '选择背景图片 / Browse File' }));

    await waitFor(() => {
      expect((window as any).pyBridge.select_background_image).toHaveBeenCalled();
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        background_image: 'C:\\Users\\OMEN\\Pictures\\wallpaper.jpg',
      });
    });

    expect(document.body.style.backgroundImage).toContain('file:///C:/Users/OMEN/Pictures/wallpaper.jpg');
  });
});
