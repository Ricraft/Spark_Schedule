/**
 * 学期周数一致性属性测试
 * 
 * 使用 fast-check 进行属性测试，验证学期周数一致性约束
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

// Course data structure for testing
interface TestCourse {
  id: string;
  name: string;
  teacher: string;
  location: string;
  weeks: number[];
  day: number;
  start: number;
  duration: number;
}

// Week conflict structure
interface WeekConflict {
  course: TestCourse;
  conflict_type: string;
  invalid_week?: number;
  week_range?: string;
  max_week: number;
}

// Arbitraries for property testing
const semesterWeeksArbitrary = fc.integer({ min: 1, max: 52 });

const courseArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 10 }),
  name: fc.string({ minLength: 1, maxLength: 20 }),
  teacher: fc.string({ minLength: 1, maxLength: 15 }),
  location: fc.string({ minLength: 1, maxLength: 10 }),
  weeks: fc.array(fc.integer({ min: 1, max: 60 }), { minLength: 1, maxLength: 20 }),
  day: fc.integer({ min: 1, max: 7 }),
  start: fc.integer({ min: 1, max: 12 }),
  duration: fc.integer({ min: 1, max: 4 })
});

const coursesArbitrary = fc.array(courseArbitrary, { minLength: 0, maxLength: 10 });

const settingsArbitrary = fc.record({
  semester_weeks: semesterWeeksArbitrary,
  start_date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31'), noInvalidDate: true })
    .map(d => d.toISOString().split('T')[0]),
  show_weekends: fc.boolean(),
  time_slot_height: fc.integer({ min: 40, max: 200 }),
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

describe('useSettingsBridge Week Consistency Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Feature: schedule-optimization, Property 11: 学期周数一致性约束**
   * 
   * 对于任何学期总周数的设置，系统应该在所有相关界面保持一致，课程编辑时的可选周数不应超过学期总周数，
   * 并在设置变更时验证现有课程的合规性
   * **验证需求: 6.1, 6.2, 6.3, 6.5**
   */
  it('should maintain semester week consistency constraints across all interfaces', async () => {
    await fc.assert(
      fc.asyncProperty(
        settingsArbitrary,
        coursesArbitrary,
        fc.integer({ min: 1, max: 52 }), // New semester weeks
        async (initialSettings, courses, newSemesterWeeks) => {
          // Generate conflicts based on courses that exceed the new semester weeks
          const conflictingCourses = courses.filter(course => 
            course.weeks.some(week => week > newSemesterWeeks)
          );
          
          const weekConflicts: WeekConflict[] = conflictingCourses.map(course => ({
            course,
            conflict_type: 'week_exceeds_semester',
            invalid_week: Math.max(...course.weeks.filter(w => w > newSemesterWeeks)),
            max_week: newSemesterWeeks
          }));

          // Setup mock responses
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          
          mockPyBridge.update_global_settings.mockResolvedValue(
            JSON.stringify({
              status: 'success',
              settings: { ...initialSettings, semester_weeks: newSemesterWeeks }
            })
          );

          mockPyBridge.check_course_week_conflicts.mockResolvedValue(
            JSON.stringify({
              conflicts: weekConflicts,
              total_conflicts: weekConflicts.length
            })
          );

          // Mock week options based on semester weeks
          mockPyBridge.get_week_options.mockResolvedValue(
            JSON.stringify({
              week_options: Array.from({ length: newSemesterWeeks }, (_, i) => i + 1),
              max_week: newSemesterWeeks
            })
          );

          // Mock week validation
          mockPyBridge.validate_week_number.mockImplementation((week: number) => {
            const isValid = week >= 1 && week <= newSemesterWeeks;
            return Promise.resolve(JSON.stringify({
              is_valid: isValid,
              error: isValid ? null : `Week ${week} exceeds semester limit of ${newSemesterWeeks}`
            }));
          });

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial settings to load
          await waitFor(() => {
            expect(result.current.settings).not.toBeNull();
          });

          // Update semester weeks
          await act(async () => {
            const success = await result.current.updateSettings({ 
              semester_weeks: newSemesterWeeks 
            });
            expect(success).toBe(true);
          });

          // Wait for settings to update
          await waitFor(() => {
            expect(result.current.settings?.semester_weeks).toBe(newSemesterWeeks);
          });

          // Check for week conflicts after semester weeks change
          await act(async () => {
            await result.current.checkWeekConflicts();
          });

          // Wait for conflicts to be detected
          await waitFor(() => {
            expect(result.current.weekConflicts).toHaveLength(weekConflicts.length);
          });

          // Verify consistency constraint 1: Week options should not exceed semester weeks
          await act(async () => {
            const weekOptions = await result.current.getWeekOptions();
            expect(weekOptions.max_week).toBe(newSemesterWeeks);
            expect(weekOptions.week_options).toHaveLength(newSemesterWeeks);
            expect(Math.max(...weekOptions.week_options)).toBe(newSemesterWeeks);
            expect(Math.min(...weekOptions.week_options)).toBe(1);
          });

          // Verify consistency constraint 2: Week validation respects semester limit
          for (let testWeek = 1; testWeek <= Math.min(newSemesterWeeks + 5, 60); testWeek++) {
            await act(async () => {
              const validation = await result.current.validateWeek(testWeek);
              if (testWeek <= newSemesterWeeks) {
                expect(validation.is_valid).toBe(true);
                expect(validation.error).toBeNull();
              } else {
                expect(validation.is_valid).toBe(false);
                expect(validation.error).toContain(`exceeds semester limit of ${newSemesterWeeks}`);
              }
            });
          }

          // Verify consistency constraint 3: Conflicts are properly detected
          const detectedConflicts = result.current.weekConflicts;
          expect(detectedConflicts).toHaveLength(conflictingCourses.length);
          
          detectedConflicts.forEach(conflict => {
            expect(conflict.max_week).toBe(newSemesterWeeks);
            expect(conflict.conflict_type).toBe('week_exceeds_semester');
            if (conflict.invalid_week) {
              expect(conflict.invalid_week).toBeGreaterThan(newSemesterWeeks);
            }
          });

          // Verify consistency constraint 4: All interfaces use the same semester weeks value
          const currentSettings = result.current.settings!;
          expect(currentSettings.semester_weeks).toBe(newSemesterWeeks);

          // Verify bridge calls were made correctly
          expect(mockPyBridge.update_global_settings).toHaveBeenCalledWith(
            JSON.stringify({ semester_weeks: newSemesterWeeks })
          );
          expect(mockPyBridge.check_course_week_conflicts).toHaveBeenCalled();
          expect(mockPyBridge.get_week_options).toHaveBeenCalled();
        }
      ),
      { numRuns: 25 }
    );
  });

  /**
   * Test semester weeks consistency when reducing total weeks
   */
  it('should detect conflicts when reducing semester weeks below existing course weeks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 20, max: 52 }), // Initial higher semester weeks
        fc.integer({ min: 1, max: 19 }),  // Reduced semester weeks
        coursesArbitrary,
        async (initialWeeks, reducedWeeks, courses) => {
          // Create courses that will conflict with reduced weeks
          // If courses array is empty, create at least one course to test conflict detection
          const baseCourses = courses.length === 0 ? [{
            id: 'test_course',
            name: 'Test Course',
            teacher: 'Test Teacher',
            location: 'Test Location',
            weeks: [initialWeeks], // This will conflict with reduced weeks
            day: 1,
            start: 1,
            duration: 2
          }] : courses;

          const conflictingCourses = baseCourses.map(course => ({
            ...course,
            weeks: [...course.weeks, initialWeeks] // Ensure at least one week equals initial weeks
          }));

          const initialSettings = {
            semester_weeks: initialWeeks,
            start_date: '2024-01-01',
            show_weekends: true,
            time_slot_height: 80,
            auto_color_import: true,
            enable_course_grouping: true,
            ui_animations: true,
            version: '1.0.0',
            last_modified: new Date().toISOString()
          };

          // Setup mocks
          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(initialSettings));
          
          mockPyBridge.update_global_settings.mockResolvedValue(
            JSON.stringify({
              status: 'success',
              settings: { ...initialSettings, semester_weeks: reducedWeeks }
            })
          );

          // All courses should conflict since they have weeks >= initialWeeks > reducedWeeks
          const expectedConflicts = conflictingCourses.map(course => ({
            course,
            conflict_type: 'week_exceeds_semester',
            invalid_week: initialWeeks,
            max_week: reducedWeeks
          }));

          mockPyBridge.check_course_week_conflicts.mockResolvedValue(
            JSON.stringify({
              conflicts: expectedConflicts,
              total_conflicts: expectedConflicts.length
            })
          );

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for initial load
          await waitFor(() => {
            expect(result.current.settings?.semester_weeks).toBe(initialWeeks);
          });

          // Reduce semester weeks
          await act(async () => {
            const success = await result.current.updateSettings({ 
              semester_weeks: reducedWeeks 
            });
            expect(success).toBe(true);
          });

          // Check for conflicts
          await act(async () => {
            await result.current.checkWeekConflicts();
          });

          // Verify conflicts are detected (should always have at least one conflict now)
          await waitFor(() => {
            expect(result.current.weekConflicts.length).toBeGreaterThan(0);
            result.current.weekConflicts.forEach(conflict => {
              expect(conflict.max_week).toBe(reducedWeeks);
              expect(conflict.invalid_week).toBeGreaterThan(reducedWeeks);
            });
          });

          // Verify settings were updated despite conflicts
          expect(result.current.settings?.semester_weeks).toBe(reducedWeeks);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Test week validation consistency across different semester week settings
   */
  it('should maintain consistent week validation across different semester settings', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 52 }), { minLength: 2, maxLength: 5 }),
        fc.array(fc.integer({ min: 1, max: 60 }), { minLength: 5, maxLength: 15 }),
        async (semesterWeeksList, testWeeks) => {
          for (const semesterWeeks of semesterWeeksList) {
            const settings = {
              semester_weeks: semesterWeeks,
              start_date: '2024-01-01',
              show_weekends: true,
              time_slot_height: 80,
              auto_color_import: true,
              enable_course_grouping: true,
              ui_animations: true,
              version: '1.0.0',
              last_modified: new Date().toISOString()
            };

            mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(settings));
            
            mockPyBridge.validate_week_number.mockImplementation((week: number) => {
              const isValid = week >= 1 && week <= semesterWeeks;
              return Promise.resolve(JSON.stringify({
                is_valid: isValid,
                error: isValid ? null : `Week ${week} exceeds semester limit of ${semesterWeeks}`
              }));
            });

            const { result } = renderHook(() => useSettingsBridge());

            // Wait for settings to load
            await waitFor(() => {
              expect(result.current.settings?.semester_weeks).toBe(semesterWeeks);
            });

            // Test week validation consistency
            for (const testWeek of testWeeks) {
              await act(async () => {
                const validation = await result.current.validateWeek(testWeek);
                
                if (testWeek >= 1 && testWeek <= semesterWeeks) {
                  // Week should be valid
                  expect(validation.is_valid).toBe(true);
                  expect(validation.error).toBeNull();
                } else {
                  // Week should be invalid
                  expect(validation.is_valid).toBe(false);
                  expect(validation.error).toBeTruthy();
                  if (testWeek > semesterWeeks) {
                    expect(validation.error).toContain(`exceeds semester limit of ${semesterWeeks}`);
                  }
                }
              });
            }
          }
        }
      ),
      { numRuns: 15 }
    );
  });

  /**
   * Test week options consistency with semester weeks
   */
  it('should provide week options that exactly match semester weeks range', async () => {
    await fc.assert(
      fc.asyncProperty(
        semesterWeeksArbitrary,
        async (semesterWeeks) => {
          const settings = {
            semester_weeks: semesterWeeks,
            start_date: '2024-01-01',
            show_weekends: true,
            time_slot_height: 80,
            auto_color_import: true,
            enable_course_grouping: true,
            ui_animations: true,
            version: '1.0.0',
            last_modified: new Date().toISOString()
          };

          mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(settings));
          
          mockPyBridge.get_week_options.mockResolvedValue(
            JSON.stringify({
              week_options: Array.from({ length: semesterWeeks }, (_, i) => i + 1),
              max_week: semesterWeeks
            })
          );

          const { result } = renderHook(() => useSettingsBridge());

          // Wait for settings to load
          await waitFor(() => {
            expect(result.current.settings?.semester_weeks).toBe(semesterWeeks);
          });

          // Get week options
          await act(async () => {
            const weekOptions = await result.current.getWeekOptions();
            
            // Verify week options consistency
            expect(weekOptions.max_week).toBe(semesterWeeks);
            expect(weekOptions.week_options).toHaveLength(semesterWeeks);
            expect(weekOptions.week_options).toEqual(
              Array.from({ length: semesterWeeks }, (_, i) => i + 1)
            );
            
            // Verify no gaps in week options
            for (let i = 1; i <= semesterWeeks; i++) {
              expect(weekOptions.week_options).toContain(i);
            }
            
            // Verify no weeks beyond semester limit
            expect(weekOptions.week_options.every(week => week <= semesterWeeks)).toBe(true);
            expect(weekOptions.week_options.every(week => week >= 1)).toBe(true);
          });
        }
      ),
      { numRuns: 30 }
    );
  });
});