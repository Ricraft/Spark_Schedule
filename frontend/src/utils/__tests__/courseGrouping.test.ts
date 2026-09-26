/**
 * Unit tests for course grouping functionality
 * Tests the core logic for organizing courses by groups
 */

import { 
  organizeCoursesbyGroups, 
  getGroupingStats, 
  findMatchingGroups, 
  CourseWithGroup, 
  CourseGroup 
} from '../courseGrouping';

describe('Course Grouping Logic', () => {
  const mockCourses: CourseWithGroup[] = [
    {
      id: '1',
      name: '高等数学',
      teacher: '张教授',
      location: 'A-101',
      weeks: [1, 2, 3, 4, 5, 6, 7, 8],
      day: 1,
      start: 1,
      duration: 2,
      color: '#8B5CF6',
      groupId: 'group_1'
    },
    {
      id: '2',
      name: '高等数学',
      teacher: '张教授',
      location: 'A-101',
      weeks: [1, 2, 3, 4, 5, 6, 7, 8],
      day: 3,
      start: 3,
      duration: 2,
      color: '#8B5CF6',
      groupId: 'group_1'
    },
    {
      id: '3',
      name: '独立课程',
      teacher: '李老师',
      location: 'B-201',
      weeks: [1, 2, 3, 4, 5, 6, 7, 8],
      day: 5,
      start: 1,
      duration: 2,
      color: '#EC4899'
      // No groupId
    }
  ];

  const mockGroups: CourseGroup[] = [
    {
      id: 'group_1',
      name: '高等数学',
      teacher: '张教授',
      location: 'A-101',
      color: '#8B5CF6',
      course_count: 2
    }
  ];

  test('should organize courses by groups correctly', () => {
    const result = organizeCoursesbyGroups(mockCourses, mockGroups, true);

    // Should have two groups: one for grouped courses and one for ungrouped
    expect(Object.keys(result)).toHaveLength(2);
    expect(result['高等数学 - 张教授']).toHaveLength(2);
    expect(result['未分组课程']).toHaveLength(1);

    // Check grouped courses
    const groupedCourses = result['高等数学 - 张教授'];
    expect(groupedCourses[0].groupId).toBe('group_1');
    expect(groupedCourses[1].groupId).toBe('group_1');

    // Check ungrouped course
    const ungroupedCourses = result['未分组课程'];
    expect(ungroupedCourses[0].groupId).toBeUndefined();
    expect(ungroupedCourses[0].name).toBe('独立课程');
  });

  test('should return ungrouped when groupedView is false', () => {
    const result = organizeCoursesbyGroups(mockCourses, mockGroups, false);

    expect(Object.keys(result)).toHaveLength(1);
    expect(result['未分组课程']).toHaveLength(3);
    expect(result['未分组课程']).toEqual(mockCourses);
  });

  test('should return ungrouped when no groups exist', () => {
    const result = organizeCoursesbyGroups(mockCourses, [], true);

    expect(Object.keys(result)).toHaveLength(1);
    expect(result['未分组课程']).toHaveLength(3);
    expect(result['未分组课程']).toEqual(mockCourses);
  });

  test('should handle courses with invalid groupId', () => {
    const coursesWithInvalidGroup: CourseWithGroup[] = [
      {
        id: '1',
        name: '测试课程',
        teacher: '测试老师',
        location: '测试地点',
        weeks: [1, 2, 3, 4],
        day: 1,
        start: 1,
        duration: 2,
        color: '#8B5CF6',
        groupId: 'invalid_group_id'
      }
    ];

    const result = organizeCoursesbyGroups(coursesWithInvalidGroup, mockGroups, true);

    expect(Object.keys(result)).toHaveLength(1);
    expect(result['未分组课程']).toHaveLength(1);
    expect(result['未分组课程'][0].name).toBe('测试课程');
  });

  test('should handle empty courses array', () => {
    const result = organizeCoursesbyGroups([], mockGroups, true);

    expect(Object.keys(result)).toHaveLength(0);
  });

  test('should handle multiple groups correctly', () => {
    const multiGroupCourses: CourseWithGroup[] = [
      {
        id: '1',
        name: '高等数学',
        teacher: '张教授',
        location: 'A-101',
        weeks: [1, 2, 3, 4],
        day: 1,
        start: 1,
        duration: 2,
        color: '#8B5CF6',
        groupId: 'group_1'
      },
      {
        id: '2',
        name: 'Python编程',
        teacher: '李老师',
        location: 'B-201',
        weeks: [1, 2, 3, 4],
        day: 2,
        start: 1,
        duration: 2,
        color: '#EC4899',
        groupId: 'group_2'
      }
    ];

    const multiGroups: CourseGroup[] = [
      {
        id: 'group_1',
        name: '高等数学',
        teacher: '张教授',
        location: 'A-101',
        color: '#8B5CF6',
        course_count: 1
      },
      {
        id: 'group_2',
        name: 'Python编程',
        teacher: '李老师',
        location: 'B-201',
        color: '#EC4899',
        course_count: 1
      }
    ];

    const result = organizeCoursesbyGroups(multiGroupCourses, multiGroups, true);

    expect(Object.keys(result)).toHaveLength(2);
    expect(result['高等数学 - 张教授']).toHaveLength(1);
    expect(result['Python编程 - 李老师']).toHaveLength(1);
  });
});

describe('Course Grouping Statistics', () => {
  const mockCourses: CourseWithGroup[] = [
    {
      id: '1',
      name: '高等数学',
      teacher: '张教授',
      location: 'A-101',
      weeks: [1, 2, 3, 4],
      day: 1,
      start: 1,
      duration: 2,
      color: '#8B5CF6',
      groupId: 'group_1'
    },
    {
      id: '2',
      name: '高等数学',
      teacher: '张教授',
      location: 'A-101',
      weeks: [1, 2, 3, 4],
      day: 3,
      start: 3,
      duration: 2,
      color: '#8B5CF6',
      groupId: 'group_1'
    },
    {
      id: '3',
      name: '独立课程',
      teacher: '李老师',
      location: 'B-201',
      weeks: [1, 2, 3, 4],
      day: 5,
      start: 1,
      duration: 2,
      color: '#EC4899'
      // No groupId
    }
  ];

  const mockGroups: CourseGroup[] = [
    {
      id: 'group_1',
      name: '高等数学',
      teacher: '张教授',
      location: 'A-101',
      color: '#8B5CF6',
      course_count: 2
    }
  ];

  test('should calculate grouping statistics correctly', () => {
    const stats = getGroupingStats(mockCourses, mockGroups);

    expect(stats.totalCourses).toBe(3);
    expect(stats.groupedCourses).toBe(2);
    expect(stats.ungroupedCourses).toBe(1);
    expect(stats.totalGroups).toBe(1);
    expect(stats.activeGroups).toBe(1);
    expect(stats.groupingRate).toBeCloseTo(66.67, 1);
  });

  test('should handle empty courses array', () => {
    const stats = getGroupingStats([], mockGroups);

    expect(stats.totalCourses).toBe(0);
    expect(stats.groupedCourses).toBe(0);
    expect(stats.ungroupedCourses).toBe(0);
    expect(stats.groupingRate).toBe(0);
  });
});

describe('Find Matching Groups', () => {
  const mockGroups: CourseGroup[] = [
    {
      id: 'group_1',
      name: '高等数学',
      teacher: '张教授',
      location: 'A-101',
      color: '#8B5CF6',
      course_count: 2
    },
    {
      id: 'group_2',
      name: 'Python编程',
      teacher: '李老师',
      location: 'B-201',
      color: '#EC4899',
      course_count: 1
    }
  ];

  test('should find matching groups based on name and teacher', () => {
    const course = {
      name: '高等数学',
      teacher: '张教授',
      location: 'C-301' // Different location
    };

    const matches = findMatchingGroups(course, mockGroups);
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('group_1');
  });

  test('should find matching groups based on teacher and location', () => {
    const course = {
      name: '数据结构', // Different name
      teacher: '李老师',
      location: 'B-201'
    };

    const matches = findMatchingGroups(course, mockGroups);
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('group_2');
  });

  test('should not match with only one criterion', () => {
    const course = {
      name: '高等数学', // Only name matches
      teacher: '王老师',
      location: 'D-401'
    };

    const matches = findMatchingGroups(course, mockGroups);
    expect(matches).toHaveLength(0);
  });

  test('should handle empty course data', () => {
    const course = {};
    const matches = findMatchingGroups(course, mockGroups);
    expect(matches).toHaveLength(0);
  });
});

// Tests are now using the imported function from courseGrouping.ts