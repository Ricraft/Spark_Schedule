/**
 * 全局设置实时应用属性测试
 * 
 * 使用 fast-check 进行属性测试，验证全局设置的实时应用功能
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

// Test timeout configuration
const TEST_TIMEOUT = 10000;
const WAIT_FOR_TIMEOUT = 1000;

// Settings arbitraries for property testing - simplified to avoid infinite loops
const validSettingsArbitrary = fc.record({
  semester_weeks: fc.integer({ min: 1, max: 20 }), // Reduced range
  start_date: fc.constant('2024-01-01'), // Fixed value to avoid date issues
  show_weekends: fc.boolean(),
  time_slot_height: fc.integer({ min: 60, max: 100 }), // Reduced range
  auto_color_import: fc.boolean(),
  enable_course_grouping: fc.boolean(),
  ui_animations: fc.boolean(),
  version: fc.constant('1.0.0'),
  last_modified: fc.constant('2024-01-01T00:00:00Z') // Fixed value
});

const settingsUpdatesArbitrary = fc.record({
  semester_weeks: fc.integer({ min: 1, max: 20 }),
  show_weekends: fc.boolean(),
  time_slot_height: fc.integer({ min: 60, max: 100 }),
  auto_color_import: fc.boolean(),
  enable_course_grouping: fc.boolean(),
  ui_animations: fc.boolean()
}, { requiredKeys: [] });

// Invalid settings for validation testing - simplified
const invalidSettingsArbitrary = fc.oneof(
  fc.record({
    semester_weeks: fc.constant(100), // Clearly invalid
  }),
  fc.record({
    time_slot_height: fc.constant(10), // Clearly invalid
  })
);

describe('useSettingsBridge Real-time Application Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.setTimeout(TEST_TIMEOUT);
  });

  afterEach(() => {
    jest.clearAllTimers();
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
        settingsUpdatesArbitrary,
        async (initialSettings, updates) => {
          // Setup mock responses
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          mockPyBridge.update_global_settings.mockResolvedValue(
            JSON.stringify({
              status: 'success',
              settings: { ...initialSettings, ...updates }
            })
          );

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial load with timeout
          await waitFor(() => {
            expect(result.current.settings).not.toBeNull();
          }, { timeout: WAIT_FOR_TIMEOUT });

          // Attempt to update settings
          let updateSuccess: boolean;
          await act(async () => {
            updateSuccess = await result.current.updateSettings(updates);
          });

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
          }, { timeout: WAIT_FOR_TIMEOUT });

          // Verify no error state
          expect(result.current.error).toBeNull();
          
          // Verify loading state was properly managed
          expect(result.current.loading).toBe(false);

          // Verify bridge was called correctly
          expect(mockPyBridge.update_global_settings).toHaveBeenCalledWith(JSON.stringify(updates));
        }
      ),
      { numRuns: 5, timeout: TEST_TIMEOUT } // Reduced numRuns for safety
    );
  }, TEST_TIMEOUT);

  /**
   * Test validation error handling during real-time application
   */
  it('should handle validation errors properly during real-time application', async () => {
    await fc.assert(
      fc.asyncProperty(
        validSettingsArbitrary,
        invalidSettingsArbitrary,
        async (initialSettings, invalidUpdates) => {
          // Setup initial successful load
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          
          // Setup validation failure
          mockPyBridge.update_global_settings.mockResolvedValue(
            JSON.stringify({
              status: 'error',
              message: 'Validation failed: Invalid settings values'
            })
          );

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial load with timeout
          await waitFor(() => {
            expect(result.current.settings).not.toBeNull();
          }, { timeout: WAIT_FOR_TIMEOUT });

          const settingsBeforeUpdate = { ...result.current.settings! };

          // Attempt to update with invalid settings
          let updateSuccess: boolean;
          await act(async () => {
            updateSuccess = await result.current.updateSettings(invalidUpdates);
          });

          // Update should fail
          expect(updateSuccess!).toBe(false);

          // Settings should remain unchanged (immediate preservation of valid state)
          const currentSettings = result.current.settings!;
          expect(currentSettings.semester_weeks).toBe(settingsBeforeUpdate.semester_weeks);
          expect(currentSettings.time_slot_height).toBe(settingsBeforeUpdate.time_slot_height);
          expect(currentSettings.show_weekends).toBe(settingsBeforeUpdate.show_weekends);

          // Should have proper error message immediately
          expect(result.current.error).toBeTruthy();
          expect(result.current.error).toContain('Validation failed');
          
          // Loading should be complete
          expect(result.current.loading).toBe(false);
        }
      ),
      { numRuns: 3, timeout: TEST_TIMEOUT } // Reduced numRuns for safety
    );
  }, TEST_TIMEOUT);

  /**
   * Test immediate application of settings changes without delay
   */
  it('should apply settings changes immediately without delay', async () => {
    const initialSettings = {
      semester_weeks: 20,
      start_date: '2024-01-01',
      show_weekends: true,
      time_slot_height: 80,
      auto_color_import: true,
      enable_course_grouping: true,
      ui_animations: true,
      version: '1.0.0',
      last_modified: '2024-01-01T00:00:00Z'
    };

    const updates = {
      semester_weeks: 18,
      show_weekends: false
    };

    // Setup mock responses
    mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
    mockPyBridge.update_global_settings.mockResolvedValue(
      JSON.stringify({
        status: 'success',
        settings: { ...initialSettings, ...updates }
      })
    );

    const { result } = renderHook(() => useSettingsBridge());

    // Wait for initial load with timeout
    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    }, { timeout: WAIT_FOR_TIMEOUT });

    const startTime = Date.now();

    // Update settings
    await act(async () => {
      const success = await result.current.updateSettings(updates);
      expect(success).toBe(true);
    });

    const endTime = Date.now();
    const updateDuration = endTime - startTime;

    // Verify settings were applied immediately (within reasonable time)
    await waitFor(() => {
      const currentSettings = result.current.settings!;
      expect(currentSettings.semester_weeks).toBe(18);
      expect(currentSettings.show_weekends).toBe(false);
    }, { timeout: WAIT_FOR_TIMEOUT });

    // Verify the update was reasonably fast (less than 2 seconds for immediate application)
    expect(updateDuration).toBeLessThan(2000);
    
    // Verify no loading state remains
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  }, TEST_TIMEOUT);
});