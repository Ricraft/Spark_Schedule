/**
 * 设置持久化属性测试
 * 
 * 使用 fast-check 进行属性测试，验证设置数据往返一致性
 * **Feature: schedule-optimization, Property 10: 设置数据往返一致性**
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import { useSettingsBridge } from '../useSettingsBridge';

// Mock window.pyBridge
const mockPyBridge = {
  get_global_settings: jest.fn(),
  update_global_settings: jest.fn(),
  check_course_week_conflicts: jest.fn(),
  fix_course_week_conflicts: jest.fn(),
  validate_week_number: jest.fn(),
  get_week_options: jest.fn()
};

// Setup window mock
Object.defineProperty(window, 'pyBridge', {
  value: mockPyBridge,
  writable: true
});

// Settings arbitraries for property testing
const validSettingsArbitrary = fc.record({
  semester_weeks: fc.integer({ min: 1, max: 52 }),
  start_date: fc.oneof(
    fc.constant(''),
    fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31'), noInvalidDate: true })
      .map(d => d.toISOString().split('T')[0])
  ),
  show_weekends: fc.boolean(),
  time_slot_height: fc.integer({ min: 20, max: 200 }),
  auto_color_import: fc.boolean(),
  enable_course_grouping: fc.boolean(),
  ui_animations: fc.boolean(),
  version: fc.constant('1.0.0'),
  last_modified: fc.date({
    min: new Date('2000-01-01T00:00:00.000Z'),
    max: new Date('2099-12-31T23:59:59.999Z'),
    noInvalidDate: true,
  }).map(d => d.toISOString())
});

const settingsUpdatesArbitrary = fc.record({
  semester_weeks: fc.integer({ min: 1, max: 52 }),
  show_weekends: fc.boolean(),
  time_slot_height: fc.integer({ min: 20, max: 200 }),
  auto_color_import: fc.boolean(),
  enable_course_grouping: fc.boolean(),
  ui_animations: fc.boolean()
}, { requiredKeys: [] });

describe('useSettingsBridge Persistence Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Feature: schedule-optimization, Property 10: 设置数据往返一致性**
   * 
   * 对于任何保存的设置数据，系统重启后加载的设置应该与保存前的设置完全一致
   * **验证需求: 5.3, 5.4**
   */
  it('should maintain settings data roundtrip consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        validSettingsArbitrary,
        settingsUpdatesArbitrary,
        async (initialSettings, updates) => {
          // Skip empty updates to avoid unnecessary complexity
          if (Object.keys(updates).length === 0) {
            return true;
          }

          // Calculate expected final settings
          const expectedFinalSettings = { ...initialSettings, ...updates };
          
          // Setup mock responses - use fresh mocks for each test
          jest.clearAllMocks();
          
          // Phase 1: Initial load
          mockPyBridge.get_global_settings.mockResolvedValueOnce(JSON.stringify(initialSettings));
          mockPyBridge.update_global_settings.mockResolvedValueOnce(
            JSON.stringify({
              status: 'success',
              settings: expectedFinalSettings
            })
          );

          const { result: initialResult, unmount: unmountInitial } = renderHook(() => useSettingsBridge());

          // Wait for initial settings to load
          await waitFor(() => {
            expect(initialResult.current.settings).not.toBeNull();
            expect(initialResult.current.loading).toBe(false);
          }, { timeout: 2000 });

          const loadedSettings = initialResult.current.settings!;

          // Verify initial settings are loaded correctly
          expect(loadedSettings.semester_weeks).toBe(initialSettings.semester_weeks);
          expect(loadedSettings.show_weekends).toBe(initialSettings.show_weekends);
          expect(loadedSettings.time_slot_height).toBe(initialSettings.time_slot_height);
          expect(loadedSettings.auto_color_import).toBe(initialSettings.auto_color_import);
          expect(loadedSettings.enable_course_grouping).toBe(initialSettings.enable_course_grouping);
          expect(loadedSettings.ui_animations).toBe(initialSettings.ui_animations);

          // Update settings
          let updateSuccess: boolean = false;
          await act(async () => {
            updateSuccess = await initialResult.current.updateSettings(updates);
          });

          expect(updateSuccess).toBe(true);

          // Wait for settings to update in the hook
          await waitFor(() => {
            const currentSettings = initialResult.current.settings!;
            // Verify all updated fields are applied
            Object.keys(updates).forEach(key => {
              expect(currentSettings[key as keyof typeof currentSettings]).toBe(
                updates[key as keyof typeof updates]
              );
            });
            expect(initialResult.current.loading).toBe(false);
          }, { timeout: 2000 });

          // Clean up first hook instance
          unmountInitial();

          // Phase 2: Simulate system restart by creating new hook instance
          // Setup fresh mock for the restart scenario
          mockPyBridge.get_global_settings.mockResolvedValueOnce(JSON.stringify(expectedFinalSettings));

          const { result: restartResult } = renderHook(() => useSettingsBridge());

          // Wait for settings to load after "restart"
          await waitFor(() => {
            expect(restartResult.current.settings).not.toBeNull();
            expect(restartResult.current.loading).toBe(false);
          }, { timeout: 2000 });

          const reloadedSettings = restartResult.current.settings!;

          // Verify roundtrip consistency - all settings should match after reload
          expect(reloadedSettings.semester_weeks).toBe(expectedFinalSettings.semester_weeks);
          expect(reloadedSettings.start_date).toBe(expectedFinalSettings.start_date);
          expect(reloadedSettings.show_weekends).toBe(expectedFinalSettings.show_weekends);
          expect(reloadedSettings.time_slot_height).toBe(expectedFinalSettings.time_slot_height);
          expect(reloadedSettings.auto_color_import).toBe(expectedFinalSettings.auto_color_import);
          expect(reloadedSettings.enable_course_grouping).toBe(expectedFinalSettings.enable_course_grouping);
          expect(reloadedSettings.ui_animations).toBe(expectedFinalSettings.ui_animations);
          expect(reloadedSettings.version).toBe(expectedFinalSettings.version);

          // Verify bridge was called correctly (2 times: initial load + restart load)
          expect(mockPyBridge.get_global_settings).toHaveBeenCalledTimes(2);
          expect(mockPyBridge.update_global_settings).toHaveBeenCalledTimes(1);
          expect(mockPyBridge.update_global_settings).toHaveBeenCalledWith(JSON.stringify(updates));
        }
      ),
      { numRuns: 10, timeout: 8000 }
    );
  });

  /**
   * Test persistence failure handling
   */
  it('should handle persistence failures gracefully without data corruption', async () => {
    await fc.assert(
      fc.asyncProperty(
        validSettingsArbitrary,
        settingsUpdatesArbitrary,
        async (initialSettings, updates) => {
          // Setup initial successful load
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          
          // Setup update failure
          mockPyBridge.update_global_settings.mockResolvedValue(
            JSON.stringify({
              status: 'error',
              message: 'Persistence failed'
            })
          );

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial load
          await waitFor(() => {
            expect(result.current.settings).not.toBeNull();
          }, { timeout: 1000 });

          const settingsBeforeUpdate = { ...result.current.settings! };

          // Attempt to update settings (should fail)
          let updateSuccess: boolean = true;
          await act(async () => {
            updateSuccess = await result.current.updateSettings(updates);
          });

          // Update should fail
          expect(updateSuccess).toBe(false);

          // Settings should remain unchanged (no data corruption)
          const currentSettings = result.current.settings!;
          expect(currentSettings.semester_weeks).toBe(settingsBeforeUpdate.semester_weeks);
          expect(currentSettings.start_date).toBe(settingsBeforeUpdate.start_date);
          expect(currentSettings.show_weekends).toBe(settingsBeforeUpdate.show_weekends);
          expect(currentSettings.time_slot_height).toBe(settingsBeforeUpdate.time_slot_height);
          expect(currentSettings.auto_color_import).toBe(settingsBeforeUpdate.auto_color_import);
          expect(currentSettings.enable_course_grouping).toBe(settingsBeforeUpdate.enable_course_grouping);
          expect(currentSettings.ui_animations).toBe(settingsBeforeUpdate.ui_animations);

          // Should have error message
          expect(result.current.error).toBeTruthy();
          expect(result.current.error).toContain('Persistence failed');
        }
      ),
      { numRuns: 10, timeout: 3000 }
    );
  });

  /**
   * Test network error handling during persistence
   */
  it('should handle network errors during persistence operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        validSettingsArbitrary,
        settingsUpdatesArbitrary,
        async (initialSettings, updates) => {
          // Setup initial successful load
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          
          // Setup network error
          mockPyBridge.update_global_settings.mockRejectedValue(new Error('Network connection failed'));

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial load
          await waitFor(() => {
            expect(result.current.settings).not.toBeNull();
          }, { timeout: 1000 });

          const settingsBeforeUpdate = { ...result.current.settings! };

          // Attempt to update settings (should fail due to network error)
          let updateSuccess: boolean = true;
          await act(async () => {
            updateSuccess = await result.current.updateSettings(updates);
          });

          // Update should fail
          expect(updateSuccess).toBe(false);

          // Settings should remain unchanged
          const currentSettings = result.current.settings!;
          expect(currentSettings.semester_weeks).toBe(settingsBeforeUpdate.semester_weeks);
          expect(currentSettings.show_weekends).toBe(settingsBeforeUpdate.show_weekends);
          expect(currentSettings.time_slot_height).toBe(settingsBeforeUpdate.time_slot_height);

          // Should have error message indicating network failure
          expect(result.current.error).toBeTruthy();
          expect(result.current.error).toContain('Network connection failed');
        }
      ),
      { numRuns: 10, timeout: 3000 }
    );
  });
});