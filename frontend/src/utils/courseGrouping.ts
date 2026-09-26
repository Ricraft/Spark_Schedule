/**
 * Course grouping utilities
 * Provides functions for organizing courses by groups
 */

interface CourseWithGroup {
  id: string;
  name: string;
  teacher: string;
  location: string;
  weeks: number[];
  day: number;
  start: number;
  duration: number;
  color: string;
  groupId?: string;
}

interface CourseGroup {
  id: string;
  name: string;
  teacher: string;
  location: string;
  color: string;
  course_count: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Organizes courses by their groups
 * @param courses - Array of courses with optional group IDs
 * @param courseGroups - Array of course group definitions
 * @param groupedView - Whether to organize by groups or return all as ungrouped
 * @returns Object with group names as keys and arrays of courses as values
 */
export function organizeCoursesbyGroups(
  courses: CourseWithGroup[], 
  courseGroups: CourseGroup[], 
  groupedView: boolean = true
): { [key: string]: CourseWithGroup[] } {
  if (!groupedView || courseGroups.length === 0) {
    // Return empty object if no courses, otherwise return ungrouped courses
    return courses.length > 0 ? { '未分组课程': courses } : {};
  }

  const grouped: { [key: string]: CourseWithGroup[] } = {};
  const ungrouped: CourseWithGroup[] = [];

  courses.forEach(course => {
    if (course.groupId) {
      const group = courseGroups.find(g => g.id === course.groupId);
      if (group) {
        const groupKey = `${group.name} - ${group.teacher}`;
        if (!grouped[groupKey]) {
          grouped[groupKey] = [];
        }
        grouped[groupKey].push(course);
      } else {
        ungrouped.push(course);
      }
    } else {
      ungrouped.push(course);
    }
  });

  // 按分组名称排序
  const sortedGrouped: { [key: string]: CourseWithGroup[] } = {};
  Object.keys(grouped)
    .sort()
    .forEach(key => {
      sortedGrouped[key] = grouped[key];
    });

  // 如果有未分组的课程，放在最后
  if (ungrouped.length > 0) {
    sortedGrouped['未分组课程'] = ungrouped;
  }

  return sortedGrouped;
}

/**
 * Gets statistics about course grouping
 * @param courses - Array of courses
 * @param courseGroups - Array of course groups
 * @returns Statistics object
 */
export function getGroupingStats(courses: CourseWithGroup[], courseGroups: CourseGroup[]) {
  const totalCourses = courses.length;
  const groupedCourses = courses.filter(c => c.groupId).length;
  const ungroupedCourses = totalCourses - groupedCourses;
  const totalGroups = courseGroups.length;
  const activeGroups = courseGroups.filter(g => 
    courses.some(c => c.groupId === g.id)
  ).length;

  return {
    totalCourses,
    groupedCourses,
    ungroupedCourses,
    totalGroups,
    activeGroups,
    groupingRate: totalCourses > 0 ? (groupedCourses / totalCourses) * 100 : 0
  };
}

/**
 * Finds potential groups for a course based on matching criteria
 * @param course - Course to find groups for
 * @param courseGroups - Available course groups
 * @returns Array of matching groups
 */
export function findMatchingGroups(
  course: Partial<CourseWithGroup>, 
  courseGroups: CourseGroup[]
): CourseGroup[] {
  return courseGroups.filter(group => {
    const nameMatch = course.name && group.name === course.name;
    const teacherMatch = course.teacher && group.teacher === course.teacher;
    const locationMatch = course.location && group.location === course.location;
    
    // At least two criteria must match for a suggestion
    const matchCount = [nameMatch, teacherMatch, locationMatch].filter(Boolean).length;
    return matchCount >= 2;
  });
}

export type { CourseWithGroup, CourseGroup };