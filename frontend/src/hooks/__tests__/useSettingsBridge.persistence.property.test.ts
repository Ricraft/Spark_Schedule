/**
 * 设置持久化属性测试
 * 
 * 使用 fast-check 进行属性测试，验证前端设置桥接的持久化属性
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

describe('useSettingsBridge Property Tests', () => {
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
          // Setup mock responses
          mockPyBridge.get_global_settings
            .mockResolvedValueOnce(JSON.stringify(initialSettings))
            .mockResolvedValueOnce(JSON.stringify({ ...initialSettings, ...updates }));
          
          mockPyBridge.update_global_settings.mockResolvedValue(
            JSON.stringify({
              status: 'success',
              settings: { ...initialSettings, ...updates }
            })
          );

          // First hook instance (simulate initial load)
          const { result: result1 } = renderHook(() => useSettingsBridge());

          // Wait for initial settings to load
          await waitFor(() => {
            expect(result1.current.settings).not.toBeNull();
          });

          const loadedSettings = result1.current.settings!;

          // Verify initial settings match
          expect(loadedSettings.semester_weeks).toBe(initialSettings.semester_weeks);
          expect(loadedSettings.start_date).toBe(initialSettings.start_date);
          expect(loadedSettings.show_weekends).toBe(initialSettings.show_weekends);
          expect(loadedSettings.time_slot_height).toBe(initialSettings.time_slot_height);
          expect(loadedSettings.auto_color_import).toBe(initialSettings.auto_color_import);
          expect(loadedSettings.enable_course_grouping).toBe(initialSettings.enable_course_grouping);
          expect(loadedSettings.ui_animations).toBe(initialSettings.ui_animations);
          expect(loadedSettings.version).toBe(initialSettings.version);

          // Update settings
          await act(async () => {
            const success = await result1.current.updateSettings(updates);
            expect(success).toBe(true);
          });

          // Wait for settings to update
          await waitFor(() => {
            const currentSettings = result1.current.settings!;
            // Verify all updated fields are applied
            Object.keys(updates).forEach(key => {
              expect(currentSettings[key as keyof typeof currentSettings]).toBe(
                updates[key as keyof typeof updates]
              );
            });
          });

          // Second hook instance (simulate system restart/reload)
          const { result: result2 } = renderHook(() => useSettingsBridge());

          // Wait for settings to load in second instance
          await waitFor(() => {
            expect(result2.current.settings).not.toBeNull();
          });

          const reloadedSettings = result2.current.settings!;
          const expectedSettings = { ...initialSettings, ...updates };

          // Verify roundtrip consistency - all settings should match after reload
          expect(reloadedSettings.semester_weeks).toBe(expectedSettings.semester_weeks);
          expect(reloadedSettings.start_date).toBe(expectedSettings.start_date);
          expect(reloadedSettings.show_weekends).toBe(expectedSettings.show_weekends);
          expect(reloadedSettings.time_slot_height).toBe(expectedSettings.time_slot_height);
          expect(reloadedSettings.auto_color_import).toBe(expectedSettings.auto_color_import);
          expect(reloadedSettings.enable_course_grouping).toBe(expectedSettings.enable_course_grouping);
          expect(reloadedSettings.ui_animations).toBe(expectedSettings.ui_animations);
          expect(reloadedSettings.version).toBe(expectedSettings.version);

          // Verify bridge was called correctly
          expect(mockPyBridge.get_global_settings).toHaveBeenCalledTimes(2);
          expect(mockPyBridge.update_global_settings).toHaveBeenCalledWith(JSON.stringify(updates));
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: schedule-optimization, Property 9: 全局设置实时应用**
   * 
   * 对于任何全局设置的修改，系统应该立即将更改应用到课程表显示，并正确处理设置验证
   * **验证需求: 5.2, 5.5**
   */
  it('should apply global settings changes immediately with proper validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        validSettingsArbitrary,
        fc.oneof(
          // Valid updates
          settingsUpdatesArbitrary,
          // Invalid updates for validation testing
          fc.record({
            semester_weeks: fc.integer({ min: 100, max: 200 }), // Invalid range
          }),
          fc.record({
            time_slot_height: fc.integer({ min: 300, max: 500 }), // Invalid range
          })
        ),
        async (initialSettings, updates) => {
          // Determine if updates are valid
          const isValidUpdate = (
            (!('semester_weeks' in updates) || (updates.semester_weeks! >= 1 && updates.semester_weeks! <= 52)) &&
            (!('time_slot_height' in updates) || (updates.time_slot_height! >= 20 && updates.time_slot_height! <= 200))
          );

          // Setup mock responses
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          
          if (isValidUpdate) {
            mockPyBridge.update_global_settings.mockResolvedValue(
              JSON.stringify({
                status: 'success',
                settings: { ...initialSettings, ...updates }
              })
            );
          } else {
            mockPyBridge.update_global_settings.mockResolvedValue(
              JSON.stringify({
                status: 'error',
                message: 'Invalid settings values'
              })
            );
          }

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial load
          await waitFor(() => {
            expect(result.current.settings).not.toBeNull();
          });

          const settingsBeforeUpdate = { ...result.current.settings! };

          // Attempt to update settings
          let updateSuccess: boolean;
          await act(async () => {
            updateSuccess = await result.current.updateSettings(updates);
          });

          if (isValidUpdate) {
            // Valid updates should succeed and apply immediately
            expect(updateSuccess!).toBe(true);
            
            await waitFor(() => {
              const currentSettings = result.current.settings!;
              // Verify immediate application of valid changes
              Object.keys(updates).forEach(key => {
                expect(currentSettings[key as keyof typeof currentSettings]).toBe(
                  updates[key as keyof typeof updates]
                );
              });
            });

            // Verify no error state
            expect(result.current.error).toBeNull();
          } else {
            // Invalid updates should fail and preserve original settings
            expect(updateSuccess!).toBe(false);
            
            // Settings should remain unchanged
            const currentSettings = result.current.settings!;
            expect(currentSettings.semester_weeks).toBe(settingsBeforeUpdate.semester_weeks);
            expect(currentSettings.time_slot_height).toBe(settingsBeforeUpdate.time_slot_height);
            expect(currentSettings.show_weekends).toBe(settingsBeforeUpdate.show_weekends);
            expect(currentSettings.auto_color_import).toBe(settingsBeforeUpdate.auto_color_import);
            expect(currentSettings.enable_course_grouping).toBe(settingsBeforeUpdate.enable_course_grouping);
            expect(currentSettings.ui_animations).toBe(settingsBeforeUpdate.ui_animations);

            // Should have error message
            expect(result.current.error).toBeTruthy();
          }

          // Verify bridge was called correctly
          expect(mockPyBridge.update_global_settings).toHaveBeenCalledWith(JSON.stringify(updates));
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test error handling during settings persistence
   */
  it('should handle persistence errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        validSettingsArbitrary,
        settingsUpdatesArbitrary,
        async (initialSettings, updates) => {
          // Setup initial successful load
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          
          // Setup update failure
          mockPyBridge.update_global_settings.mockRejectedValue(new Error('Network error'));

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial load
          await waitFor(() => {
            expect(result.current.settings).not.toBeNull();
          });

          const settingsBeforeUpdate = { ...result.current.settings! };

          // Attempt to update settings (should fail)
          let updateSuccess: boolean;
          await act(async () => {
            updateSuccess = await result.current.updateSettings(updates);
          });

          // Update should fail
          expect(updateSuccess!).toBe(false);

          // Settings should remain unchanged
          const currentSettings = result.current.settings!;
          expect(currentSettings.semester_weeks).toBe(settingsBeforeUpdate.semester_weeks);
          expect(currentSettings.start_date).toBe(settingsBeforeUpdate.start_date);
          expect(currentSettings.show_weekends).toBe(settingsBeforeUpdate.show_weekends);
          expect(currentSettings.time_slot_height).toBe(settingsBeforeUpdate.time_slot_height);

          // Should have error message
          expect(result.current.error).toBeTruthy();
          expect(result.current.error).toContain('Network error');
        }
      ),
      { numRuns: 15 }
    );
  });
});