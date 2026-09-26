import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DEFAULT_SETTINGS, ScheduleSettingsPanel } from '../ScheduleSettingsPanel';

const updateSettingsMock = jest.fn().mockResolvedValue(true);

jest.mock('../../hooks/useSettingsBridge', () => ({
  useSettingsBridge: () => ({
    settings: { version: '1.0.0' },
    weekConflicts: [],
    loading: false,
    error: null,
    updateSettings: updateSettingsMock,
    checkWeekConflicts: jest.fn().mockResolvedValue([]),
    fixWeekConflicts: jest.fn().mockResolvedValue({ success: true, message: 'ok' }),
    validateWeek: jest.fn().mockResolvedValue({ is_valid: true }),
    getWeekOptions: jest.fn().mockResolvedValue({ week_options: [], max_week: 20 }),
  }),
}));

describe('ScheduleSettingsPanel enhanced behavior', () => {
  const onClose = jest.fn();
  const onUpdateSettings = jest.fn();
  const onPreviewSettings = jest.fn();

  const renderPanel = () =>
    render(
      <ScheduleSettingsPanel
        isOpen={true}
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

  it('exposes accessible header controls', () => {
    renderPanel();
    expect(screen.getByTitle('关闭实时预览')).toBeInTheDocument();
    expect(screen.getByTitle('重置设置')).toBeInTheDocument();
    expect(screen.getByTitle('关闭设置')).toBeInTheDocument();
  });

  it('exports settings json from data tab', async () => {
    const clickMock = jest.fn();
    const originalCreateObjectURL = (URL as any).createObjectURL;
    const originalRevokeObjectURL = (URL as any).revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: jest.fn(() => 'blob:mock-url'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: jest.fn(),
    });

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string) => {
        const element = originalCreateElement(tagName);
        if (tagName.toLowerCase() === 'a') {
          (element as HTMLAnchorElement).click = clickMock;
        }
        return element;
      }) as typeof document.createElement);

    renderPanel();
    fireEvent.click(screen.getByText('数据管理'));
    fireEvent.click(screen.getByText('导出完整配置'));

    await waitFor(() => {
      expect(clickMock).toHaveBeenCalled();
      expect((URL as any).createObjectURL).toHaveBeenCalled();
      expect((URL as any).revokeObjectURL).toHaveBeenCalled();
    });

    createElementSpy.mockRestore();
    Object.defineProperty(URL, 'createObjectURL', { writable: true, value: originalCreateObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: originalRevokeObjectURL });
  });

  it('saves and closes when clicking save button', async () => {
    renderPanel();

    const totalWeeksInput = document.querySelector('input[type="number"][min="1"][max="52"]') as HTMLInputElement;
    fireEvent.change(totalWeeksInput, { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: '保存全局配置' }));

    await waitFor(() => {
      expect(updateSettingsMock).toHaveBeenCalled();
      expect(onUpdateSettings).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
