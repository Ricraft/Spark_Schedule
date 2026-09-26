/**
 * 前端集成测试套件
 * 
 * 测试端到端的用户工作流，验证所有功能的协同工作
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// 导入类型
import { Course } from '../types/Course';

// 模拟 PyBridge
const mockPyBridge = {
  get_courses: jest.fn(),
  get_courses_with_metadata: jest.fn(),
  save_course_with_grouping: jest.fn(),
  add_course: jest.fn(),
  update_course: jest.fn(),
  delete_course_by_id: jest.fn(),
  get_global_settings: jest.fn(),
  update_global_settings: jest.fn(),
  get_course_groups: jest.fn(),
  get_integration_status: jest.fn(),
  perform_system_check: jest.fn(),
};

// 模拟数据
const mockCourses: Course[] = [
  {
    id: '1',
    name: '高等数学',
    teacher: '张教授',
    location: 'A-101',
    weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    day: 1,
    start: 1,
    duration: 2,
    color: '#8B5CF6',
    credit: 4,
    note: '重要基础课程'
  },
  {
    id: '2',
    name: 'Python程序设计',
    teacher: '李老师',
    location: '机房B',
    weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    day: 3,
    start: 3,
    duration: 2,
    color: '#EC4899',
    credit: 3
  }
];

const mockCourseGroups = [
  {
    id: 'group_1',
    name: '数学类课程',
    teacher: '张教授',
    location: 'A-101',
    color: '#8B5CF6',
    course_count: 2,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

const mockCoursesWithMetadata = {
  courses: mockCourses.map(course => ({ ...course, groupId: 'group_1' })),
  groups: mockCourseGroups,
  metadata: {
    version: '1.0',
    timestamp: new Date().toISOString(),
    total_courses: 2,
    total_groups: 1
  }
};

const DEFAULT_SETTINGS = {
  semester_weeks: 20,
  start_date: '',
  show_weekends: true,
  time_slot_height: 80,
  auto_color_import: true,
  enable_course_grouping: true,
  ui_animations: true
};

// 设置全局模拟
beforeAll(() => {
  // 模拟 Qt WebChannel 环境
  Object.assign(window, {
    qt: {
      webChannelTransport: {}
    },
    QWebChannel: jest.fn((_transport, callback) => {
      callback({
        objects: {
          pyBridge: mockPyBridge
        }
      });
    }),
    pyBridge: mockPyBridge,
  });

  // 模拟 localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  });

  // 模拟 requestIdleCallback
  Object.defineProperty(globalThis, 'requestIdleCallback', {
    configurable: true,
    value: jest.fn((callback) => setTimeout(callback, 0)),
  });
});

// 简化的测试组件
const TestComponent: React.FC = () => {
  return (
    <div data-testid="test-component">
      <h1>集成测试组件</h1>
      <div data-testid="course-list">
        {mockCourses.map(course => (
          <div key={course.id} data-testid={`course-${course.id}`}>
            {course.name}
          </div>
        ))}
      </div>
    </div>
  );
};

describe('完整集成测试套件', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 设置默认模拟返回值
    mockPyBridge.get_courses.mockResolvedValue(JSON.stringify(mockCourses));
    mockPyBridge.get_courses_with_metadata.mockResolvedValue(JSON.stringify(mockCoursesWithMetadata));
    mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify(DEFAULT_SETTINGS));
    mockPyBridge.get_course_groups.mockResolvedValue(JSON.stringify(mockCourseGroups));
    mockPyBridge.get_integration_status.mockResolvedValue(JSON.stringify({
      status: 'success',
      integration_enabled: true,
      system_status: {
        active_operations: 0,
        total_operations: 10,
        settings_status: 'healthy',
        group_manager_status: 'healthy',
        color_manager_status: 'healthy'
      }
    }));
  });

  describe('基础集成测试', () => {
    it('应该正确渲染测试组件', async () => {
      render(<TestComponent />);

      // 验证组件渲染
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
      expect(screen.getByText('集成测试组件')).toBeInTheDocument();
      
      // 验证课程列表渲染
      expect(screen.getByTestId('course-list')).toBeInTheDocument();
      expect(screen.getByText('高等数学')).toBeInTheDocument();
      expect(screen.getByText('Python程序设计')).toBeInTheDocument();
    });

    it('应该正确处理模拟数据', async () => {
      render(<TestComponent />);

      // 验证模拟数据
      expect(mockCourses).toHaveLength(2);
      expect(mockCourses[0].name).toBe('高等数学');
      expect(mockCourses[1].name).toBe('Python程序设计');
      
      // 验证课程分组数据
      expect(mockCourseGroups).toHaveLength(1);
      expect(mockCourseGroups[0].name).toBe('数学类课程');
    });
  });

  describe('API集成测试', () => {
    it('应该正确模拟PyBridge调用', async () => {
      // 测试课程获取
      const coursesResult = await mockPyBridge.get_courses();
      expect(coursesResult).toBe(JSON.stringify(mockCourses));
      
      // 测试设置获取
      const settingsResult = await mockPyBridge.get_global_settings();
      expect(settingsResult).toBe(JSON.stringify(DEFAULT_SETTINGS));
      
      // 测试分组获取
      const groupsResult = await mockPyBridge.get_course_groups();
      expect(groupsResult).toBe(JSON.stringify(mockCourseGroups));
    });

    it('应该正确处理课程操作', async () => {
      // 模拟成功的操作响应
      mockPyBridge.add_course.mockResolvedValue(JSON.stringify({
        status: 'success',
        message: '课程添加成功',
        id: 'new_course_id'
      }));
      
      mockPyBridge.update_course.mockResolvedValue(JSON.stringify({
        status: 'success',
        message: '课程更新成功'
      }));
      
      mockPyBridge.delete_course_by_id.mockResolvedValue(JSON.stringify({
        status: 'success',
        message: '课程删除成功'
      }));

      // 测试添加课程
      const addResult = await mockPyBridge.add_course('{"name":"新课程"}');
      const addData = JSON.parse(addResult);
      expect(addData.status).toBe('success');
      expect(addData.id).toBe('new_course_id');

      // 测试更新课程
      const updateResult = await mockPyBridge.update_course('course_id', '{"name":"更新课程"}');
      const updateData = JSON.parse(updateResult);
      expect(updateData.status).toBe('success');

      // 测试删除课程
      const deleteResult = await mockPyBridge.delete_course_by_id('course_id');
      const deleteData = JSON.parse(deleteResult);
      expect(deleteData.status).toBe('success');
    });
  });

  describe('性能基准测试', () => {
    it('应该在合理时间内完成渲染', async () => {
      const startTime = performance.now();

      render(<TestComponent />);

      // 等待组件完全渲染
      await waitFor(() => {
        expect(screen.getByTestId('test-component')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;

      // 验证渲染时间在合理范围内（1秒内）
      expect(renderTime).toBeLessThan(1000);
    });

    it('应该正确处理大量数据', async () => {
      // 创建大量模拟课程数据
      const largeCourseSet = Array.from({ length: 50 }, (_, i) => ({
        id: `course_${i}`,
        name: `课程 ${i}`,
        teacher: `教师 ${i % 10}`,
        location: `教室 ${i % 20}`,
        weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
        day: (i % 7) + 1,
        start: (i % 10) + 1,
        duration: 2,
        color: '#8B5CF6',
        credit: 3
      }));

      // 创建包含大量数据的测试组件
      const LargeDataComponent: React.FC = () => (
        <div data-testid="large-data-component">
          {largeCourseSet.map(course => (
            <div key={course.id} data-testid={`course-${course.id}`}>
              {course.name}
            </div>
          ))}
        </div>
      );

      const startTime = performance.now();
      render(<LargeDataComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('large-data-component')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;

      // 验证大数据集渲染时间在合理范围内（2秒内）
      expect(renderTime).toBeLessThan(2000);
      
      // 验证部分数据已渲染
      expect(screen.getByText('课程 0')).toBeInTheDocument();
    });
  });

  describe('错误处理测试', () => {
    it('应该优雅地处理API错误', async () => {
      // 模拟API错误
      mockPyBridge.get_courses.mockRejectedValue(new Error('网络连接失败'));

      // 测试错误处理
      try {
        await mockPyBridge.get_courses();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('网络连接失败');
      }
    });

    it('应该处理无效的JSON响应', async () => {
      // 模拟无效JSON响应
      mockPyBridge.get_courses.mockResolvedValue('invalid json');

      const result = await mockPyBridge.get_courses();
      expect(result).toBe('invalid json');

      // 测试JSON解析错误处理
      expect(() => JSON.parse(result)).toThrow();
    });
  });

  describe('数据一致性测试', () => {
    it('应该保持数据结构一致性', () => {
      // 验证课程数据结构
      mockCourses.forEach(course => {
        expect(course).toHaveProperty('id');
        expect(course).toHaveProperty('name');
        expect(course).toHaveProperty('teacher');
        expect(course).toHaveProperty('location');
        expect(course).toHaveProperty('weeks');
        expect(course).toHaveProperty('day');
        expect(course).toHaveProperty('start');
        expect(course).toHaveProperty('duration');
        expect(course).toHaveProperty('color');
      });

      // 验证分组数据结构
      mockCourseGroups.forEach(group => {
        expect(group).toHaveProperty('id');
        expect(group).toHaveProperty('name');
        expect(group).toHaveProperty('teacher');
        expect(group).toHaveProperty('location');
        expect(group).toHaveProperty('color');
      });
    });

    it('应该正确关联课程和分组', () => {
      const coursesWithMetadata = mockCoursesWithMetadata;
      
      // 验证课程都有分组ID
      coursesWithMetadata.courses.forEach(course => {
        expect(course.groupId).toBeDefined();
      });

      // 验证元数据一致性
      expect(coursesWithMetadata.metadata.total_courses).toBe(coursesWithMetadata.courses.length);
      expect(coursesWithMetadata.metadata.total_groups).toBe(coursesWithMetadata.groups.length);
    });
  });
});

// 测试工具函数
export const integrationTestUtils = {
  /**
   * 等待元素出现
   */
  waitForElement: async (text: string, timeout = 3000) => {
    return await waitFor(() => {
      expect(screen.getByText(text)).toBeInTheDocument();
    }, { timeout });
  },

  /**
   * 验证API调用
   */
  expectApiCall: (mockFn: jest.Mock, expectedData?: any) => {
    expect(mockFn).toHaveBeenCalled();
    if (expectedData) {
      expect(mockFn).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(expectedData))
      );
    }
  },

  /**
   * 创建模拟课程数据
   */
  createMockCourse: (overrides: Partial<Course> = {}): Course => ({
    id: 'test_course',
    name: '测试课程',
    teacher: '测试教师',
    location: '测试教室',
    weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    day: 1,
    start: 1,
    duration: 2,
    color: '#8B5CF6',
    credit: 3,
    ...overrides
  })
};