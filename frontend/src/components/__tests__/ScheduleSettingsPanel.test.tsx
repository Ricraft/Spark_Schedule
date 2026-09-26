import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DEFAULT_SETTINGS, ScheduleSettingsPanel } from '../ScheduleSettingsPanel';

const updateSettingsMock = jest.fn().mockResolvedValue(true);
const checkWeekConflictsMock = jest.fn().mockResolvedValue([]);

jest.mock('../../hooks/useSettingsBridge', () => ({
  useSettingsBridge: () => ({
    settings: { version: '1.0.0' },
    weekConflicts: [],
    loading: false,
    error: null,
    updateSettings: updateSettingsMock,
    checkWeekConflicts: checkWeekConflictsMock,
    fixWeekConflicts: jest.fn().mockResolvedValue({ success: true, message: 'ok' }),
    validateWeek: jest.fn().mockResolvedValue({ is_valid: true }),
    getWeekOptions: jest.fn().mockResolvedValue({ week_options: [], max_week: 20 }),
  }),
}));

describe('ScheduleSettingsPanel', () => {
  const onClose = jest.fn();
  const onUpdateSettings = jest.fn();
  const onPreviewSettings = jest.fn();

  const renderPanel = (isOpen = true) =>
    render(
      <ScheduleSettingsPanel
        isOpen={isOpen}
        onClose={onClose}
        settings={DEFAULT_SETTINGS}
        onUpdateSettings={onUpdateSettings}
        onPreviewSettings={onPreviewSettings}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'confirm', {
      writable: true,
      value: jest.fn(() => true),
    });
  });

  it('renders panel sections when open', () => {
    renderPanel();
    expect(screen.getByText('全局设置')).toBeInTheDocument();
    expect(screen.getAllByText('基础设定').length).toBeGreaterThan(0);
    expect(screen.getAllByText('界面外观').length).toBeGreaterThan(0);
    expect(screen.getAllByText('数据管理').length).toBeGreaterThan(0);
    expect(screen.getAllByText('系统高级').length).toBeGreaterThan(0);
  });

  it('does not render when closed', () => {
    renderPanel(false);
    expect(screen.queryByText('全局设置')).not.toBeInTheDocument();
  });

  it('switches tab content', async () => {
    renderPanel();
    fireEvent.click(screen.getByText('数据管理'));

    await waitFor(() => {
      expect(screen.getByText('数据管理核心')).toBeInTheDocument();
      expect(screen.getByText('导出完整配置')).toBeInTheDocument();
    });
  });

  it('toggles preview mode from header control', () => {
    renderPanel();
    const previewButton = screen.getByTitle('关闭实时预览');
    fireEvent.click(previewButton);
    expect(screen.getByTitle('开启实时预览')).toBeInTheDocument();
  });

  it('disables save button when total weeks is out of range', async () => {
    renderPanel();

    const totalWeeksInput = document.querySelector('input[type="number"][min="1"][max="52"]') as HTMLInputElement;
    expect(totalWeeksInput).toBeTruthy();

    fireEvent.change(totalWeeksInput, { target: { value: '100' } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '保存全局配置' })).toBeDisabled();
    });
  });

  it('saves valid settings and closes panel', async () => {
    renderPanel();

    const totalWeeksInput = document.querySelector('input[type="number"][min="1"][max="52"]') as HTMLInputElement;
    expect(totalWeeksInput).toBeTruthy();

    fireEvent.change(totalWeeksInput, { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: '保存全局配置' }));

    await waitFor(() => {
      expect(updateSettingsMock).toHaveBeenCalled();
      expect(onUpdateSettings).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
