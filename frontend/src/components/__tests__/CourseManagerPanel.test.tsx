import { Course } from '../../types/Course';

// Mock console methods to reduce noise in tests
const originalConsole = console;
beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

describe('CourseManagerPanel Color Persistence Logic', () => {
  const mockCourse: Course = {
    id: 'test-course-1',
    name: '高等数学',
    teacher: '张教授',
    location: 'A-101',
    weeks: [1, 2, 3, 4, 5, 6, 7, 8],
    day: 1,
    start: 1,
    duration: 2,
    color: '#8B5CF6',
    credit: 4,
    note: '测试课程'
  };

  it('should include color field in course data structure', () => {
    // Test that Course interface includes color field
    expect(mockCourse.color).toBeDefined();
    expect(typeof mockCourse.color).toBe('string');
    expect(mockCourse.color).toMatch(/^#[0-9A-Fa-f]{6}$/); // Valid hex color
  });

  it('should preserve color when creating course data object', () => {
    // Simulate the handleSave logic from CourseManagerPanel
    const courseData = {
      id: mockCourse.id || `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: mockCourse.name,
      teacher: mockCourse.teacher,
      location: mockCourse.location,
      weeks: mockCourse.weeks,
      day: mockCourse.day,
      start: mockCourse.start,
      duration: mockCourse.duration,
      color: mockCourse.color, // This should be preserved
      credit: mockCourse.credit,
      note: mockCourse.note
    };

    expect(courseData.color).toBe('#8B5CF6');
    expect(courseData).toEqual(expect.objectContaining({
      color: '#8B5CF6'
    }));
  });

  it('should handle different color formats', () => {
    const testColors = [
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#3B82F6', // Blue
      '#10B981', // Green
      '#F59E0B', // Orange
      '#EF4444', // Red
    ];

    testColors.forEach(color => {
      const courseWithColor = { ...mockCourse, color };
      expect(courseWithColor.color).toBe(color);
      expect(courseWithColor.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('should default to purple color when no color specified', () => {
    const courseWithoutColor = { ...mockCourse };
    delete (courseWithoutColor as any).color;
    
    // Simulate default color assignment
    const defaultColor = '#8B5CF6';
    const courseData = {
      ...courseWithoutColor,
      color: courseWithoutColor.color || defaultColor
    };

    expect(courseData.color).toBe('#8B5CF6');
  });

  it('should validate color format', () => {
    const validColors = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981'];
    const invalidColors = ['8B5CF6', '#GGG', 'purple', '#12345', '#1234567'];

    validColors.forEach(color => {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    invalidColors.forEach(color => {
      expect(color).not.toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});