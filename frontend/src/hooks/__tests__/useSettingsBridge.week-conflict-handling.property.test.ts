/**
 * 周数冲突处理属性测试
 * 
 * 使用 fast-check 进行属性测试，验证周数冲突处理功能
 * **Feature: schedule-optimization, Property 12: 周数冲突处理**
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

// Week conflict arbitraries for property testing
const weekConflictArbitrary = fc.record({
  course: fc.record({
    id: fc.string({ minLength: 1, maxLength: 10 }),
    name: fc.string({ minLength: 1, maxLength: 20 }),
    teacher: fc.string({ minLength: 1, maxLength: 15 }),
    location: fc.string({ minLength: 1, maxLength: 15 })
  }),
  conflict_type: fc.constantFrom('week_overflow', 'invalid_range', 'out_of_bounds'),
  invalid_week: fc.option(fc.integer({ min: 21, max: 100 })),
  week_range: fc.option(fc.string()),
  max_week: fc.integer({ min: 1, max: 20 })
});

const conflictListArbitrary = fc.array(weekConflictArbitrary, { minLength: 0, maxLength: 10 });

const settingsArbitrary = fc.record({
  semester_weeks: fc.integer({ min: 1, max: 52 }),
  start_date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31'), noInvalidDate: true })
    .map(d => d.toISOString().split('T')[0]),
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

describe('useSettingsBridge Week Conflict Handling Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Feature: schedule-optimization, Property 12: 周数冲突处理**
   * 
   * 对于任何检测到的课程周数冲突，系统应该提示用户处理冲突课程
   * **验证需求: 6.4**
   */
  it('should detect and handle week conflicts properly', async () => {
    await fc.assert(
      fc.asyncProperty(
        settingsArbitrary,
        conflictListArbitrary,
        async (initialSettings, conflicts) => {
          // Setup mock responses
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          mockPyBridge.check_course_week_conflicts.mockResolvedValue(
            JSON.stringify({
              status: 'success',
              conflicts: conflicts
            })
          );

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial settings to load
          await waitFor(() => {
            expect(result.current.settings).not.toBeNull();
          }, { timeout: 2000 });

          // Check for week conflicts
          let detectedConflicts: any[] = [];
          await act(async () => {
            detectedConflicts = await result.current.checkWeekConflicts();
          });

          // Verify conflict detection
          expect(detectedConflicts).toEqual(conflicts);
          expect(result.current.weekConflicts).toEqual(conflicts);

          // Verify bridge was called correctly
          expect(mockPyBridge.check_course_week_conflicts).toHaveBeenCalledTimes(1);

          // If conflicts exist, verify they are properly exposed to the UI
          if (conflicts.length > 0) {
            expect(result.current.weekConflicts.length).toBeGreaterThan(0);
            
            // Verify each conflict has required properties
            result.current.weekConflicts.forEach(conflict => {
              expect(conflict).toHaveProperty('course');
              expect(conflict).toHaveProperty('conflict_type');
              expect(conflict).toHaveProperty('max_week');
              
              // Verify conflict types are valid
              expect(['week_overflow', 'invalid_range', 'out_of_bounds']).toContain(conflict.conflict_type);
              
              // Verify max_week is reasonable
              expect(conflict.max_week).toBeGreaterThan(0);
              expect(conflict.max_week).toBeLessThanOrEqual(52);
            });
          } else {
            expect(result.current.weekConflicts).toHaveLength(0);
          }
        }
      ),
      { numRuns: 15, timeout: 5000 }
    );
  });

  /**
   * Test conflict resolution strategies
   */
  it('should handle conflict resolution strategies correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        settingsArbitrary,
        conflictListArbitrary.filter(conflicts => conflicts.length > 0), // Only test with conflicts
        fc.constantFrom('truncate', 'remove'),
        async (initialSettings, conflicts, strategy) => {
          // Setup mock responses
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          
          // Initial conflict check
          mockPyBridge.check_course_week_conflicts
            .mockResolvedValueOnce(JSON.stringify({
              status: 'success',
              conflicts: conflicts
            }))
            .mockResolvedValueOnce(JSON.stringify({
              status: 'success',
              conflicts: [] // After fix, no conflicts
            }));

          // Fix conflicts response
          mockPyBridge.fix_course_week_conflicts.mockResolvedValue(
            JSON.stringify({
              status: 'success',
              message: `Successfully ${strategy === 'truncate' ? 'truncated' : 'removed'} ${conflicts.length} conflicting courses`
            })
          );

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial settings to load
          await waitFor(() => {
            expect(result.current.settings).not.toBeNull();
          }, { timeout: 2000 });

          // Check for conflicts first
          await act(async () => {
            await result.current.checkWeekConflicts();
          });

          // Verify conflicts are detected
          expect(result.current.weekConflicts).toEqual(conflicts);

          // Fix conflicts using the strategy
          let fixResult: any;
          await act(async () => {
            fixResult = await result.current.fixWeekConflicts(strategy);
          });

          // Verify fix was successful
          expect(fixResult.success).toBe(true);
          expect(fixResult.message).toContain(strategy === 'truncate' ? 'truncated' : 'removed');

          // Verify conflicts are cleared after fix
          await waitFor(() => {
            expect(result.current.weekConflicts).toHaveLength(0);
          }, { timeout: 2000 });

          // Verify bridge methods were called correctly
          expect(mockPyBridge.fix_course_week_conflicts).toHaveBeenCalledWith(strategy);
          expect(mockPyBridge.check_course_week_conflicts).toHaveBeenCalledTimes(2); // Initial check + recheck after fix
        }
      ),
      { numRuns: 10, timeout: 8000 }
    );
  });

  /**
   * Test error handling during conflict operations
   */
  it('should handle conflict operation errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        settingsArbitrary,
        fc.constantFrom('Network error', 'Bridge not available', 'Invalid response'),
        async (initialSettings, errorMessage) => {
          // Setup mock responses
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          
          // Setup conflict check error
          mockPyBridge.check_course_week_conflicts.mockRejectedValue(new Error(errorMessage));

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial settings to load
          await waitFor(() => {
            expect(result.current.settings).not.toBeNull();
          }, { timeout: 2000 });

          // Attempt to check conflicts (should fail)
          let conflictResult: any[] = [];
          await act(async () => {
            conflictResult = await result.current.checkWeekConflicts();
          });

          // Verify error handling
          expect(conflictResult).toEqual([]);
          expect(result.current.error).toBeTruthy();
          expect(result.current.error).toContain(errorMessage);
          expect(result.current.weekConflicts).toHaveLength(0);
        }
      ),
      { numRuns: 10, timeout: 3000 }
    );
  });

  /**
   * Test conflict fix operation errors
   */
  it('should handle conflict fix errors gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        settingsArbitrary,
        conflictListArbitrary.filter(conflicts => conflicts.length > 0),
        fc.constantFrom('truncate', 'remove'),
        fc.constantFrom('Fix operation failed', 'Insufficient permissions', 'Database error'),
        async (initialSettings, conflicts, strategy, errorMessage) => {
          // Setup mock responses
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          mockPyBridge.check_course_week_conflicts.mockResolvedValue(
            JSON.stringify({
              status: 'success',
              conflicts: conflicts
            })
          );

          // Setup fix error
          mockPyBridge.fix_course_week_conflicts.mockResolvedValue(
            JSON.stringify({
              status: 'error',
              message: errorMessage
            })
          );

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial settings to load
          await waitFor(() => {
            expect(result.current.settings).not.toBeNull();
          }, { timeout: 2000 });

          // Check for conflicts first
          await act(async () => {
            await result.current.checkWeekConflicts();
          });

          // Verify conflicts are detected
          expect(result.current.weekConflicts).toEqual(conflicts);

          // Attempt to fix conflicts (should fail)
          let fixResult: any;
          await act(async () => {
            fixResult = await result.current.fixWeekConflicts(strategy);
          });

          // Verify fix failure is handled gracefully
          expect(fixResult.success).toBe(false);
          expect(fixResult.message).toBe(errorMessage);

          // Verify conflicts remain unchanged
          expect(result.current.weekConflicts).toEqual(conflicts);

          // Verify error state
          expect(result.current.error).toBeTruthy();
          expect(result.current.error).toContain(errorMessage);
        }
      ),
      { numRuns: 10, timeout: 5000 }
    );
  });

  /**
   * Test conflict detection with network failures
   */
  it('should handle network failures during conflict detection', async () => {
    await fc.assert(
      fc.asyncProperty(
        settingsArbitrary,
        async (initialSettings) => {
          // Setup mock responses
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          
          // Setup network failure
          mockPyBridge.check_course_week_conflicts.mockRejectedValue(new Error('Network connection failed'));

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial settings to load
          await waitFor(() => {
            expect(result.current.settings).not.toBeNull();
          }, { timeout: 2000 });

          // Attempt to check conflicts (should fail due to network)
          let conflictResult: any[] = [];
          await act(async () => {
            conflictResult = await result.current.checkWeekConflicts();
          });

          // Verify graceful failure handling
          expect(conflictResult).toEqual([]);
          expect(result.current.weekConflicts).toHaveLength(0);
          expect(result.current.error).toBeTruthy();
          expect(result.current.error).toContain('Network connection failed');
        }
      ),
      { numRuns: 8, timeout: 3000 }
    );
  });
});
