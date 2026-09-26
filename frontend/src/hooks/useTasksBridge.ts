/**
 * useTasksBridge Hook
 *
 * 任务管理的前后端桥接 Hook
 * 提供任务的增删改查和状态管理功能
 *
 * 采用全局单例 + 事件驱动模式，避免 Bridge 阻塞
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePythonContext } from '../contexts/PythonContext';
import { SafeStorage } from '../utils/safeStorage';

/**
 * 超时包装函数
 * 防止桥接调用无限等待
 */
const withTimeout = <T,>(p: Promise<T>, ms: number, label: string) => {
  let timer: any;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 超时（${ms}ms），可能桥接通道断开`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
};

export interface Task {
  id: string;
  title: string;
  course_id: string;
  course_name: string;
  status: 'todo' | 'doing' | 'done';
  priority: 'normal' | 'high' | 'urgent';
  is_exam: boolean;
  deadline: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  description: string;
  tags: string[];
  order: number;
}

export interface TaskStatistics {
  total: number;
  todo: number;
  doing: number;
  done: number;
  overdue: number;
  exams: number;
  completion_rate: number;
}

// 🔥 全局单例：缓存任务数据
let globalTasks: Task[] = [];
let globalStatistics: TaskStatistics | null = null;

export const useTasksBridge = () => {
  const { isReady } = usePythonContext();
  
  // 🚀 优先读取缓存数据，立即显示
  const [tasks, setTasks] = useState<Task[]>(() => {
    const cached = SafeStorage.getItem<Task[]>('wakeup_tasks', []);
    if (cached.length > 0) {
      globalTasks = cached;
      return cached;
    }
    return globalTasks;
  });
  
  const [statistics, setStatistics] = useState<TaskStatistics | null>(globalStatistics);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // 🔥 幂等保护：防止重复触发
  const inflightRef = useRef(false);
  const lastOpRef = useRef<string | null>(null);
  const didInitRef = useRef(false);
  
  // 🔥 进度控制 refs
  const MIN_DURATION = 450; // 进度条至少显示 450ms
  const MAX_FAKE = 88;      // 假进度最多推到 88%
  const startRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const opIdRef = useRef<string | null>(null);

  /**
   * 数据处理器：更新任务数据并缓存
   */
  const processAndSetTasks = useCallback((newTasks: Task[]) => {
    console.log('🔄 [TasksBridge] 处理任务数据，数量:', newTasks.length);

    globalTasks = newTasks;
    setTasks(newTasks);

    // 🔒 使用安全存储保存到 localStorage
    const saved = SafeStorage.setItem('wakeup_tasks', newTasks);
    if (saved) {
      console.log('💾 [TasksBridge] 已保存到 localStorage');
    } else {
      console.warn('⚠️ [TasksBridge] 保存缓存失败（可能 quota 超限）');
    }
  }, []);

  /**
   * 🔥 启动加载进度（假进度推进器）
   */
  const startProgress = useCallback((opId: string) => {
    inflightRef.current = true;
    opIdRef.current = opId;
    startRef.current = Date.now();
    
    setLoading(true);
    setLoadingProgress(1);
    
    // 清理旧的定时器
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }
    
    let p = 1;
    timerRef.current = window.setInterval(() => {
      // 越靠近 MAX_FAKE 越慢
      const step = Math.max(1, Math.round((MAX_FAKE - p) / 12));
      p = Math.min(MAX_FAKE, p + step);
      setLoadingProgress(prev => Math.max(prev, p)); // 只增不减
    }, 40);
  }, [MAX_FAKE]);

  /**
   * 🔥 应用后端进度（只增不减）
   */
  const applyBackendProgress = useCallback((opId: string, percent: number) => {
    if (opId !== opIdRef.current) return;
    const v = Math.max(0, Math.min(100, Number(percent)));
    setLoadingProgress(prev => Math.max(prev, v)); // 只增不减
  }, []);

  /**
   * 🔥 完成加载进度（保证最小显示时间）
   */
  const finishProgress = useCallback((opId: string) => {
    if (opId !== opIdRef.current) return;
    
    const elapsed = Date.now() - startRef.current;
    const delay = Math.max(0, MIN_DURATION - elapsed);
    
    window.setTimeout(() => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setLoadingProgress(100);
      
      // 给 100% 留一点时间显示
      window.setTimeout(() => {
        setLoading(false);
        inflightRef.current = false;
        opIdRef.current = null;
      }, 150);
    }, delay);
  }, [MIN_DURATION]);

  /**
   * 🔥 失败时清理进度
   */
  const failProgress = useCallback((opId: string) => {
    if (opId !== opIdRef.current) return;
    
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setLoading(false);
    inflightRef.current = false;
    opIdRef.current = null;
  }, []);

  /**
   * 获取所有任务（后台静默加载）
   * 🔥 完整的幂等保护 + 平滑进度条实现
   */
  const fetchTasks = useCallback(async () => {
    const py = (window as any).pyBridge;
    if (!py?.get_all_tasks) {
      console.warn('⚠️ [TasksBridge] Bridge 未就绪');
      return;
    }

    // 🔥 幂等保护：使用 CAS (Compare-And-Swap) 模式
    if (inflightRef.current) {
      console.log('⏭️ [TasksBridge] 已有请求在飞行中，跳过');
      return;
    }

    // 🔒 原子性设置标志
    inflightRef.current = true;

    try {
      console.log('🔄 [TasksBridge] 后台加载任务...');

      // 调用 get_all_tasks
      const result = await withTimeout(py.get_all_tasks(), 8000, 'get_all_tasks');
      const data = JSON.parse(result as string);

      if (data.status === 'pending' && data.operation_id) {
        // 异步模式：启动进度条
        const opId = data.operation_id;
        lastOpRef.current = opId;
        console.log('⏳ [TasksBridge] 任务加载已发起（异步），operation_id:', opId);

        // 🔥 启动进度
        startProgress(opId);

      } else if (data.status === 'success') {
        // 同步模式：直接处理数据
        processAndSetTasks(data.tasks || []);
        console.log('✅ [TasksBridge] 同步加载成功:', data.tasks?.length || 0);

        // 兼容同步返回：显示快速进度
        setLoading(true);
        setLoadingProgress(100);
        setTimeout(() => {
          setLoading(false);
          inflightRef.current = false;
        }, 150);

      } else {
        console.warn('⚠️ [TasksBridge] 后台加载失败:', data.message);
        inflightRef.current = false;
      }

    } catch (err: any) {
      console.error('❌ [TasksBridge] 后台加载失败:', err);
      inflightRef.current = false;
    }
  }, [processAndSetTasks, startProgress]);

  /**
   * 获取任务统计信息（后台静默加载）
   */
  const fetchStatistics = useCallback(async () => {
    const py = (window as any).pyBridge;
    if (!py?.get_task_statistics) return;

    try {
      console.log('🔄 [TasksBridge] 后台加载统计信息...');
      const result = await withTimeout(py.get_task_statistics(), 8000, 'get_task_statistics');
      const data = JSON.parse(result as string);
      
      if (data.status === 'success') {
        globalStatistics = data.statistics;
        setStatistics(data.statistics);
        console.log('✅ [TasksBridge] 后台加载统计信息成功:', data.statistics);
      }
    } catch (err: any) {
      console.error('❌ [TasksBridge] 后台加载统计信息失败:', err);
      // 不设置 error，保持现有数据显示
    }
  }, []);

  /**
   * 根据状态获取任务
   */
  const fetchTasksByStatus = useCallback(async (status: 'todo' | 'doing' | 'done') => {
    const py = (window as any).pyBridge;
    if (!py?.get_tasks_by_status) return [];

    try {
      const result = await py.get_tasks_by_status(status);
      const data = JSON.parse(result as string);
      
      if (data.status === 'success') {
        return data.tasks || [];
      }
      return [];
    } catch (err: any) {
      console.error('❌ [TasksBridge] 获取任务失败:', err);
      return [];
    }
  }, []);

  /**
   * 获取考试任务
   */
  const fetchExamTasks = useCallback(async () => {
    const py = (window as any).pyBridge;
    if (!py?.get_exam_tasks) return [];

    try {
      const result = await py.get_exam_tasks();
      const data = JSON.parse(result as string);
      
      if (data.status === 'success') {
        return data.tasks || [];
      }
      return [];
    } catch (err: any) {
      console.error('❌ [TasksBridge] 获取考试任务失败:', err);
      return [];
    }
  }, []);

  /**
   * 添加任务
   */
  const addTask = useCallback(async (taskData: Partial<Task>) => {
    const py = (window as any).pyBridge;
    if (!py?.add_task) {
      throw new Error('Bridge 未就绪');
    }

    try {
      const result = await withTimeout(py.add_task(JSON.stringify(taskData)), 8000, 'add_task');
      const data = JSON.parse(result as string);
      
      if (data.status === 'success') {
        console.log('✅ [TasksBridge] 添加任务成功');
        // 🔥 优化: 直接更新本地状态,不重新加载
        const newTask = data.task;
        const updatedTasks = [...globalTasks, newTask];
        processAndSetTasks(updatedTasks);
        
        // 触发全局事件(但不刷新,只通知其他组件)
        window.dispatchEvent(new CustomEvent('taskDataUpdated', {
          detail: { action: 'local_update', tasks: updatedTasks }
        }));
        return newTask;
      } else {
        throw new Error(data.message || '添加任务失败');
      }
    } catch (err: any) {
      console.error('❌ [TasksBridge] 添加任务失败:', err);
      setError(err.message || '添加任务失败');
      throw err;
    }
  }, [processAndSetTasks]);

  /**
   * 更新任务
   */
  const updateTask = useCallback(async (taskId: string, taskData: Partial<Task>) => {
    const py = (window as any).pyBridge;
    if (!py?.update_task) {
      throw new Error('Bridge 未就绪');
    }

    try {
      const result = await withTimeout(py.update_task(taskId, JSON.stringify(taskData)), 8000, 'update_task');
      const data = JSON.parse(result as string);
      
      if (data.status === 'success') {
        console.log('✅ [TasksBridge] 更新任务成功');
        // 🔥 优化: 直接更新本地状态
        const updatedTask = data.task;
        const updatedTasks = globalTasks.map(t => t.id === taskId ? updatedTask : t);
        processAndSetTasks(updatedTasks);
        
        // 触发全局事件(本地更新)
        window.dispatchEvent(new CustomEvent('taskDataUpdated', {
          detail: { action: 'local_update', tasks: updatedTasks }
        }));
        return updatedTask;
      } else {
        throw new Error(data.message || '更新任务失败');
      }
    } catch (err: any) {
      console.error('❌ [TasksBridge] 更新任务失败:', err);
      setError(err.message || '更新任务失败');
      throw err;
    }
  }, [processAndSetTasks]);

  /**
   * 删除任务
   */
  const deleteTask = useCallback(async (taskId: string) => {
    const py = (window as any).pyBridge;
    if (!py?.delete_task) {
      throw new Error('Bridge 未就绪');
    }

    try {
      const result = await withTimeout(py.delete_task(taskId), 8000, 'delete_task');
      const data = JSON.parse(result as string);
      
      if (data.status === 'success') {
        console.log('✅ [TasksBridge] 删除任务成功');
        // 🔥 优化: 直接从本地状态删除
        const updatedTasks = globalTasks.filter(t => t.id !== taskId);
        processAndSetTasks(updatedTasks);
        
        // 触发全局事件(本地更新)
        window.dispatchEvent(new CustomEvent('taskDataUpdated', {
          detail: { action: 'local_update', tasks: updatedTasks }
        }));
      } else {
        throw new Error(data.message || '删除任务失败');
      }
    } catch (err: any) {
      console.error('❌ [TasksBridge] 删除任务失败:', err);
      setError(err.message || '删除任务失败');
      throw err;
    }
  }, [processAndSetTasks]);

  /**
   * 更新任务状态
   */
  const updateTaskStatus = useCallback(async (taskId: string, newStatus: 'todo' | 'doing' | 'done') => {
    const py = (window as any).pyBridge;
    if (!py?.update_task_status) {
      throw new Error('Bridge 未就绪');
    }

    try {
      const result = await withTimeout(py.update_task_status(taskId, newStatus), 8000, 'update_task_status');
      const data = JSON.parse(result as string);
      
      if (data.status === 'success') {
        console.log('✅ [TasksBridge] 更新任务状态成功');
        // 🔥 优化: 直接更新本地状态
        const updatedTask = data.task;
        const updatedTasks = globalTasks.map(t => t.id === taskId ? updatedTask : t);
        processAndSetTasks(updatedTasks);
        
        // 触发全局事件(本地更新)
        window.dispatchEvent(new CustomEvent('taskDataUpdated', {
          detail: { action: 'local_update', tasks: updatedTasks }
        }));
        return updatedTask;
      } else {
        throw new Error(data.message || '更新任务状态失败');
      }
    } catch (err: any) {
      console.error('❌ [TasksBridge] 更新任务状态失败:', err);
      throw err;
    }
  }, [processAndSetTasks]);

  /**
   * 🔥 信号绑定（确保只绑定一次）
   */
  const boundRef = useRef(false);
  useEffect(() => {
    const py = (window as any).pyBridge;
    if (!py) return;
    if (boundRef.current) return;

    boundRef.current = true;
    console.log('🔌 [TasksBridge] 绑定异步操作信号');

    // 🔒 保存信号处理器引用，用于清理
    const progressHandler = (opId: string, percent: number) => {
      console.log(`📈 [TasksBridge] 收到后端进度: ${opId} ${percent}%`);
      applyBackendProgress(opId, percent);
    };

    const completedHandler = (opId: string, payload: string) => {
      console.log(`✅ [TasksBridge] 收到完成信号: ${opId}`);
      try {
        const data = JSON.parse(payload);
        if (data.status === 'success' && data.tasks) {
          processAndSetTasks(data.tasks);
          console.log('✅ [TasksBridge] 异步加载成功:', data.tasks.length);
        }
        finishProgress(opId);
      } catch (e) {
        console.error('❌ [TasksBridge] 解析完成信号失败:', e);
        failProgress(opId);
      }
    };

    const failedHandler = (opId: string, errorMsg: string) => {
      console.error(`❌ [TasksBridge] 收到失败信号: ${opId} - ${errorMsg}`);
      failProgress(opId);
    };

    // 绑定信号
    if (py.asyncOperationProgress?.connect) {
      py.asyncOperationProgress.connect(progressHandler);
    }

    if (py.asyncOperationCompleted?.connect) {
      py.asyncOperationCompleted.connect(completedHandler);
    }

    if (py.asyncOperationFailed?.connect) {
      py.asyncOperationFailed.connect(failedHandler);
    }

    // 🔒 清理函数：断开信号连接
    return () => {
      console.log('🔌 [TasksBridge] 清理信号连接');
      try {
        if (py.asyncOperationProgress?.disconnect) {
          py.asyncOperationProgress.disconnect(progressHandler);
        }
        if (py.asyncOperationCompleted?.disconnect) {
          py.asyncOperationCompleted.disconnect(completedHandler);
        }
        if (py.asyncOperationFailed?.disconnect) {
          py.asyncOperationFailed.disconnect(failedHandler);
        }
      } catch (e) {
        console.warn('⚠️ [TasksBridge] 信号断开失败:', e);
      }
    };
  }, [processAndSetTasks, applyBackendProgress, finishProgress, failProgress]);

  /**
   * 初始化加载
   * 🔥 使用 didInitRef 防止重复挂载导致的重复调用
   */
  useEffect(() => {
    if (!isReady) return;
    if (didInitRef.current) return; // ✅ 只跑一次
    
    didInitRef.current = true;
    console.log('🔄 [TasksBridge] Hook 挂载，准备后台加载');
    
    // 延迟 500ms 后台加载，避免与其他组件竞争 Bridge
    const timer = setTimeout(() => {
      console.log('🚀 [TasksBridge] 开始后台加载任务数据');
      Promise.all([fetchTasks(), fetchStatistics()]).catch(err => {
        console.error('❌ [TasksBridge] 后台加载失败:', err);
      });
    }, 500);
    
    return () => clearTimeout(timer);
  }, [isReady, fetchTasks, fetchStatistics]);
  
  /**
   * 监听全局任务更新事件
   * 🔒 使用 useCallback 包装 handleTaskUpdate，防止闭包陈旧
   */
  const handleTaskUpdate = useCallback((event: any) => {
    const detail = event?.detail || {};
    console.log('📡 [TasksBridge] 收到任务更新事件:', detail);

    if (detail.action === 'refresh') {
      // 刷新任务数据(从后端重新加载)
      fetchTasks();
      fetchStatistics();
    } else if (detail.action === 'local_update' && detail.tasks) {
      // 🔥 本地更新(直接使用提供的数据,不重新加载)
      processAndSetTasks(detail.tasks);
      // 同时更新统计信息
      fetchStatistics();
    } else if (detail.tasks) {
      // 兼容旧格式: 直接更新任务数据
      processAndSetTasks(detail.tasks);
    }
  }, [fetchTasks, fetchStatistics, processAndSetTasks]);

  useEffect(() => {
    window.addEventListener('taskDataUpdated', handleTaskUpdate as EventListener);

    return () => {
      window.removeEventListener('taskDataUpdated', handleTaskUpdate as EventListener);
      // 清理进度条定时器
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [handleTaskUpdate]);

  return {
    // 数据
    tasks,
    statistics,
    loading,
    error,
    loadingProgress,  // 🔥 导出进度值供 UI 使用
    
    // 方法
    fetchTasks,
    fetchStatistics,
    fetchTasksByStatus,
    fetchExamTasks,
    addTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    
    // 状态
    isReady
  };
};
