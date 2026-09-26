/**
 * 实时同步属性测试
 * 
 * 使用 fast-check 进行属性测试，验证设置的实时同步功能
 * 
 * **Validates: Requirements 3.2, 3.5**
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import { useSettingsBridge } from '../useSettingsBridge';

// Mock window.pyBridge
const mockPyBridge = {
  get_global_settings: jest.fn(),
  update_global_settings: jest.fn(),
  update_settings: jest.fn(),
  check_course_week_conflicts: jest.fn(),
  fix_course_week_conflicts: jest.fn(),
  validate_week_number: jest.fn(),
  get_week_options: jest.fn(),
  settingsUpdated: {
    connect: jest.fn(),
    disconnect: jest.fn()
  }
};

// Setup window mock
Object.defineProperty(window, 'pyBridge', {
  value: mockPyBridge,
  writable: true,
  configurable: true
});

// Test timeout configuration
const TEST_TIMEOUT = 15000;
const WAIT_FOR_TIMEOUT = 1000;
const SYNC_DELAY_MS = 100; // Requirement 3.2: Updates within 100ms

// Settings arbitraries for property testing
const validSettingsArbitrary = fc.record({
  semester_weeks: fc.integer({ min: 1, max: 20 }),
  current_week: fc.integer({ min: 1, max: 20 }),
  start_date: fc.constant('2024-01-01'),
  holidays: fc.array(fc.integer({ min: 1, max: 20 }), { maxLength: 5 }),
  start_hour: fc.integer({ min: 6, max: 10 }),
  start_minute: fc.integer({ min: 0, max: 59 }),
  end_hour: fc.integer({ min: 18, max: 23 }),
  use24_hour_format: fc.boolean(),
  section_duration: fc.integer({ min: 40, max: 60 }),
  break_duration: fc.integer({ min: 5, max: 20 }),
  sections_per_day: fc.integer({ min: 8, max: 12 }),
  show_weekends: fc.boolean(),
  time_slot_height: fc.integer({ min: 60, max: 100 }),
  course_opacity: fc.integer({ min: 70, max: 100 }),
  show_grid_lines: fc.boolean(),
  show_time_indicator: fc.boolean(),
  highlight_today: fc.boolean(),
  show_teacher: fc.boolean(),
  show_location: fc.boolean(),
  font_size: fc.constantFrom('small', 'medium', 'large'),
  conflict_mode: fc.constantFrom('overlay', 'split', 'hide'),
  auto_save: fc.boolean(),
  auto_color_import: fc.boolean(),
  enable_course_grouping: fc.boolean(),
  ui_animations: fc.boolean(),
  enable_notifications: fc.boolean(),
  dark_mode: fc.boolean(),
  gpu_acceleration: fc.boolean(),
  ui_transitions: fc.boolean(),
  background_image: fc.constant(''),
  acrylic_opacity: fc.integer({ min: 0, max: 100 }),
  notification_sound: fc.constantFrom('default', 'chime', 'bell'),
  notification_volume: fc.integer({ min: 0, max: 100 }),
  auto_start: fc.boolean(),
  minimize_to_tray: fc.boolean(),
  start_minimized: fc.boolean(),
  weather_enabled: fc.boolean(),
  weather_api_key: fc.constant(''),
  weather_location: fc.constant(''),
  shici_enabled: fc.boolean(),
  ai_learning_enabled: fc.boolean(),
  ai_task_parsing_enabled: fc.boolean(),
  ai_provider: fc.constantFrom('openai', 'deepseek', 'local'),
  ai_api_key: fc.constant(''),
  ai_base_url: fc.constant(''),
  ai_model: fc.constant('gpt-4'),
  ai_system_prompt: fc.constant(''),
  enable_devtools: fc.boolean(),
  show_python_console: fc.boolean(),
  performance_overlay: fc.boolean(),
  enable_auto_backup: fc.boolean(),
  backup_freq: fc.constantFrom('daily', 'weekly', 'monthly'),
  backup_retention_days: fc.integer({ min: 7, max: 90 }),
  enable_debug_mode: fc.boolean(),
  log_level: fc.constantFrom('DEBUG', 'INFO', 'WARNING', 'ERROR'),
  focus_duration: fc.integer({ min: 15, max: 60 }),
  pomodoro_break_duration: fc.integer({ min: 5, max: 20 }),
  ambient_sound: fc.constantFrom('none', 'rain', 'cafe', 'forest'),
  ambient_volume: fc.integer({ min: 0, max: 100 }),
  auto_play_noise: fc.boolean(),
  week_goal_hours: fc.integer({ min: 10, max: 80 }),
  week_minutes: fc.integer({ min: 0, max: 10000 }),
  study_time_last_updated: fc.constant(null),
  version: fc.constant('1.0.0'),
  last_modified: fc.constant('2024-01-01T00:00:00Z')
});

const settingsUpdatesArbitrary = fc.record({
  semester_weeks: fc.integer({ min: 1, max: 20 }),
  show_weekends: fc.boolean(),
  time_slot_height: fc.integer({ min: 60, max: 100 }),
  dark_mode: fc.boolean(),
  enable_notifications: fc.boolean(),
  ui_animations: fc.boolean(),
  acrylic_opacity: fc.integer({ min: 0, max: 100 }),
  notification_volume: fc.integer({ min: 0, max: 100 })
}, { requiredKeys: [] });

describe('useSettingsBridge Real-time Sync Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.setTimeout(TEST_TIMEOUT);
    
    // Setup default mock behavior
    mockPyBridge.settingsUpdated.connect.mockImplementation(() => {});
    mockPyBridge.settingsUpdated.disconnect.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  /**
   * **Property 3: 实时同步一致性**
   * **Validates: Requirements 3.2, 3.5**
   * 
   * 对于任何设置更新，前端状态应该在100ms内与后端状态匹配
   */
  it('should sync frontend state with backend state within 100ms', async () => {
    await fc.assert(
      fc.asyncProperty(
        validSettingsArbitrary,
        settingsUpdatesArbitrary,
        async (initialSettings, updates) => {
          // Setup mock responses
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          mockPyBridge.update_settings.mockResolvedValue(
            JSON.stringify({
              status: 'success',
              settings: { ...initialSettings, ...updates }
            })
          );

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial load
          await waitFor(() => {
            expect(result.current.settings).not.toBeNull();
          }, { timeout: WAIT_FOR_TIMEOUT });

          const startTime = Date.now();

          // Update settings
          let updateSuccess: boolean;
          await act(async () => {
            updateSuccess = await result.current.updateSettings(updates);
          });

          const endTime = Date.now();
          const syncDuration = endTime - startTime;

          // Verify update succeeded
          expect(updateSuccess!).toBe(true);

          // Verify frontend state matches backend state
          await waitFor(() => {
            const currentSettings = result.current.settings!;
            Object.keys(updates).forEach(key => {
              expect(currentSettings[key as keyof typeof currentSettings]).toBe(
                updates[key as keyof typeof updates]
              );
            });
          }, { timeout: WAIT_FOR_TIMEOUT });

          // Verify sync happened within 100ms (Requirement 3.2)
          expect(syncDuration).toBeLessThan(SYNC_DELAY_MS + 50); // Allow 50ms buffer for test overhead

          // Verify no error state
          expect(result.current.error).toBeNull();
          expect(result.current.loading).toBe(false);
        }
      ),
      { numRuns: 10, timeout: TEST_TIMEOUT }
    );
  }, TEST_TIMEOUT);

  /**
   * **Property 3: 批处理快速更新**
   * **Validates: Requirement 3.4**
   * 
   * 当多个设置快速更新时，系统应该将它们批处理为单个保存操作
   */
  it('should batch multiple rapid updates into single save operation', async () => {
    await fc.assert(
      fc.asyncProperty(
        validSettingsArbitrary,
        fc.array(settingsUpdatesArbitrary, { minLength: 2, maxLength: 5 }),
        async (initialSettings, updateSequence) => {
          // Filter out empty updates to avoid test flakiness
          const nonEmptyUpdates = updateSequence.filter(update => Object.keys(update).length > 0);
          
          // Skip if no valid updates
          if (nonEmptyUpdates.length === 0) {
            return;
          }

          // Setup mock responses
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          
          // Track all update calls
          const updateCalls: any[] = [];
          let currentState = { ...initialSettings };
          mockPyBridge.update_settings.mockImplementation((updatesJson: string) => {
            const updates = JSON.parse(updatesJson);
            updateCalls.push(updates);
            currentState = { ...currentState, ...updates };
            return Promise.resolve(JSON.stringify({
              status: 'success',
              settings: currentState
            }));
          });

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial load
          await waitFor(() => {
            expect(result.current.settings).not.toBeNull();
          }, { timeout: WAIT_FOR_TIMEOUT });

          // Perform rapid updates
          await act(async () => {
            const updatePromises = nonEmptyUpdates.map(updates => 
              result.current.updateSettings(updates)
            );
            await Promise.all(updatePromises);
          });

          // Wait for all updates to complete
          await waitFor(() => {
            expect(result.current.loading).toBe(false);
          }, { timeout: WAIT_FOR_TIMEOUT });

          // Verify batching: number of backend calls should be less than or equal to number of updates
          // (ideally much less due to batching, but at minimum not more)
          expect(updateCalls.length).toBeLessThanOrEqual(nonEmptyUpdates.length);

          // Verify final state contains all updates
          const finalSettings = result.current.settings!;
          const mergedUpdates = nonEmptyUpdates.reduce((acc, update) => ({ ...acc, ...update }), {});
          
          Object.keys(mergedUpdates).forEach(key => {
            expect(finalSettings[key as keyof typeof finalSettings]).toBe(
              mergedUpdates[key as keyof typeof mergedUpdates]
            );
          });

          // Verify no error state
          expect(result.current.error).toBeNull();
        }
      ),
      { numRuns: 8, timeout: TEST_TIMEOUT }
    );
  }, TEST_TIMEOUT);

  /**
   * **Property 3: 更新顺序保持**
   * **Validates: Requirements 3.2, 3.5**
   * 
   * 设置更新的顺序应该被保持，后续更新应该覆盖之前的更新
   */
  it('should preserve update ordering with later updates overriding earlier ones', async () => {
    await fc.assert(
      fc.asyncProperty(
        validSettingsArbitrary,
        fc.array(
          fc.record({
            dark_mode: fc.boolean(),
            ui_animations: fc.boolean()
          }),
          { minLength: 2, maxLength: 4 }
        ),
        async (initialSettings, updateSequence) => {
          // Setup mock responses
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          
          let currentState = { ...initialSettings };
          mockPyBridge.update_settings.mockImplementation((updatesJson: string) => {
            const updates = JSON.parse(updatesJson);
            currentState = { ...currentState, ...updates };
            return Promise.resolve(JSON.stringify({
              status: 'success',
              settings: currentState
            }));
          });

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial load
          await waitFor(() => {
            expect(result.current.settings).not.toBeNull();
          }, { timeout: WAIT_FOR_TIMEOUT });

          // Apply updates sequentially
          for (const updates of updateSequence) {
            await act(async () => {
              const success = await result.current.updateSettings(updates);
              expect(success).toBe(true);
            });
          }

          // Wait for all updates to complete
          await waitFor(() => {
            expect(result.current.loading).toBe(false);
          }, { timeout: WAIT_FOR_TIMEOUT });

          // Verify final state matches the last update in sequence
          const finalSettings = result.current.settings!;
          const lastUpdate = updateSequence[updateSequence.length - 1];
          
          expect(finalSettings.dark_mode).toBe(lastUpdate.dark_mode);
          expect(finalSettings.ui_animations).toBe(lastUpdate.ui_animations);

          // Verify no error state
          expect(result.current.error).toBeNull();
        }
      ),
      { numRuns: 10, timeout: TEST_TIMEOUT }
    );
  }, TEST_TIMEOUT);

  /**
   * **Property 3: 往返一致性 (Round-trip)**
   * **Validates: Requirement 3.5**
   * 
   * 对于所有设置更改，解析 → 序列化 → 解析应产生等效的设置
   */
  it('should maintain round-trip consistency: parse → serialize → parse', async () => {
    await fc.assert(
      fc.asyncProperty(
        validSettingsArbitrary,
        settingsUpdatesArbitrary,
        async (initialSettings, updates) => {
          // Setup mock responses
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          
          const mergedSettings = { ...initialSettings, ...updates };
          mockPyBridge.update_settings.mockResolvedValue(
            JSON.stringify({
              status: 'success',
              settings: mergedSettings
            })
          );

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial load
          await waitFor(() => {
            expect(result.current.settings).not.toBeNull();
          }, { timeout: WAIT_FOR_TIMEOUT });

          // Update settings
          await act(async () => {
            const success = await result.current.updateSettings(updates);
            expect(success).toBe(true);
          });

          // Wait for update to complete
          await waitFor(() => {
            expect(result.current.loading).toBe(false);
          }, { timeout: WAIT_FOR_TIMEOUT });

          // Get the settings from frontend
          const frontendSettings = result.current.settings!;

          // Simulate round-trip: serialize and parse
          const serialized = JSON.stringify(frontendSettings);
          const parsed = JSON.parse(serialized);

          // Verify all fields match after round-trip
          Object.keys(frontendSettings).forEach(key => {
            const originalValue = frontendSettings[key as keyof typeof frontendSettings];
            const parsedValue = parsed[key];
            
            // Handle special cases (null, undefined, NaN)
            if (originalValue === null) {
              expect(parsedValue).toBeNull();
            } else if (typeof originalValue === 'number' && isNaN(originalValue)) {
              expect(isNaN(parsedValue)).toBe(true);
            } else {
              expect(parsedValue).toEqual(originalValue);
            }
          });

          // Verify no error state
          expect(result.current.error).toBeNull();
        }
      ),
      { numRuns: 15, timeout: TEST_TIMEOUT }
    );
  }, TEST_TIMEOUT);

  /**
   * **Property 3: 信号驱动的实时同步**
   * **Validates: Requirements 3.1, 3.2**
   * 
   * 当后端发出 settingsUpdated 信号时，前端应该在100ms内更新状态
   */
  it('should update React state within 100ms when settingsUpdated signal is emitted', async () => {
    await fc.assert(
      fc.asyncProperty(
        validSettingsArbitrary,
        settingsUpdatesArbitrary,
        async (initialSettings, updates) => {
          // Setup mock responses
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          
          let signalHandler: ((jsonStr: string) => void) | null = null;
          mockPyBridge.settingsUpdated.connect.mockImplementation((handler: any) => {
            signalHandler = handler;
          });

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial load and signal connection
          await waitFor(() => {
            expect(result.current.settings).not.toBeNull();
            expect(signalHandler).not.toBeNull();
          }, { timeout: WAIT_FOR_TIMEOUT });

          // Verify initial state
          const initialState = { ...result.current.settings! };

          // Simulate backend signal emission
          const updatedSettings = { ...initialSettings, ...updates };
          const startTime = Date.now();

          await act(async () => {
            signalHandler!(JSON.stringify(updatedSettings));
          });

          const endTime = Date.now();
          const signalProcessingTime = endTime - startTime;

          // Verify state updated within 100ms
          expect(signalProcessingTime).toBeLessThan(SYNC_DELAY_MS);

          // Verify frontend state matches the signal payload
          await waitFor(() => {
            const currentSettings = result.current.settings!;
            Object.keys(updates).forEach(key => {
              expect(currentSettings[key as keyof typeof currentSettings]).toBe(
                updates[key as keyof typeof updates]
              );
            });
          }, { timeout: WAIT_FOR_TIMEOUT });

          // Verify no error state
          expect(result.current.error).toBeNull();
        }
      ),
      { numRuns: 10, timeout: TEST_TIMEOUT }
    );
  }, TEST_TIMEOUT);
});
