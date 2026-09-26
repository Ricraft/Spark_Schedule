import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
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

describe('ScheduleSettingsPanel property tests', () => {
  const renderPanel = () =>
    render(
      <ScheduleSettingsPanel
        isOpen={true}
        onClose={jest.fn()}
        settings={DEFAULT_SETTINGS}
        onUpdateSettings={jest.fn()}
        onPreviewSettings={jest.fn()}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'confirm', {
      writable: true,
      value: jest.fn(() => true),
    });
  });

  it('preview toggle remains reversible across repeated clicks', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (clicks) => {
        const { unmount } = renderPanel();

        for (let i = 0; i < clicks; i += 1) {
          const currentTitle = i % 2 === 0 ? '关闭实时预览' : '开启实时预览';
          const nextTitle = i % 2 === 0 ? '开启实时预览' : '关闭实时预览';
          fireEvent.click(screen.getByTitle(currentTitle));
          await waitFor(() => {
            expect(screen.getByTitle(nextTitle)).toBeInTheDocument();
          });
        }

        unmount();
      }),
      { numRuns: 8 }
    );
  });

  it('save button disabled state follows totalWeeks validity', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -20, max: 120 }), async (weeks) => {
        const { unmount } = renderPanel();
        const totalWeeksInput = document.querySelector('input[type="number"][min="1"][max="52"]') as HTMLInputElement;
        expect(totalWeeksInput).toBeTruthy();

        fireEvent.change(totalWeeksInput, { target: { value: String(weeks) } });

        const saveButton = screen.getByRole('button', { name: '保存全局配置' });
        if (weeks >= 1 && weeks <= 52) {
          await waitFor(() => expect(saveButton).not.toBeDisabled());
        } else {
          await waitFor(() => expect(saveButton).toBeDisabled());
        }

        unmount();
      }),
      { numRuns: 10 }
    );
  });
});
