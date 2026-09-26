import { useState, useEffect, useCallback, useMemo } from 'react';
export interface TaskData {
  id: string;
  title: string;
  courseId: string;
  deadline: string;
  isExam: boolean;
  priority: string;
  description: string;
  status: string;
}

export const useTaskBridge = () => {
  const [tasks, setTasks] = useState<TaskData[]>(() => {
    try {
      const cached = localStorage.getItem('wakeup_tasks');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [loading, setLoading] = useState(false);
  const bridge = (window as any).pyBridge;

  const refreshTasks = useCallback(async (showLoading = false) => {
    if (!bridge) return;
    if (showLoading) setLoading(true);
    
    try {
      const json = await bridge.get_tasks();
      const data = JSON.parse(json);
      if (Array.isArray(data)) {
        // Map backend snake_case to frontend camelCase if needed
        // TaskManager already handles some mapping, but let's be safe
        const processed = data.map(item => ({
          id: item.id,
          title: item.title,
          courseId: item.course_id,
          deadline: item.deadline,
          isExam: item.is_exam,
          priority: item.priority,
          description: item.description,
          status: item.status
        }));
        setTasks(processed);
        localStorage.setItem('wakeup_tasks', JSON.stringify(processed));
      }
    } catch (e) {
      console.error('❌ Failed to fetch tasks:', e);
    } finally {
      setLoading(false);
    }
  }, [bridge]);

  useEffect(() => {
    if (bridge) {
      refreshTasks();
      
      // Listen for data state changes to auto-refresh
      const handleStateChange = (state: string) => {
        if (state === 'task_updated' || state === 'task_deleted') {
          refreshTasks();
        }
      };
      
      if (bridge.dataStateChanged?.connect) {
        bridge.dataStateChanged.connect(handleStateChange);
        return () => {
          try { bridge.dataStateChanged.disconnect(handleStateChange); } catch(e) {}
        };
      }
    }
  }, [bridge, refreshTasks]);

  const saveTask = useCallback(async (task: TaskData) => {
    if (!bridge) return;
    try {
      await bridge.save_task(JSON.stringify(task));
    } catch (e) {
      console.error('❌ Failed to save task:', e);
    }
  }, [bridge]);

  const deleteTask = useCallback(async (id: string) => {
    if (!bridge) return;
    try {
      await bridge.delete_task_by_id(id);
    } catch (e) {
      console.error('❌ Failed to delete task:', e);
    }
  }, [bridge]);

  return {
    tasks,
    loading,
    refreshTasks,
    saveTask,
    deleteTask
  };
};
