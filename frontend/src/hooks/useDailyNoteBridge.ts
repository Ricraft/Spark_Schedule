/**
 * useDailyNoteBridge Hook
 * 
 * 每日笔记数据管理的前后端桥接 Hook
 * 提供笔记的增删改查功能，数据持久化到后端
 */

import { useState, useEffect, useCallback } from 'react';
import { usePythonContext } from '../contexts/PythonContext';

/**
 * 超时包装函数
 */
const withTimeout = <T,>(p: Promise<T>, ms: number, label: string) => {
  let timer: any;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 超时（${ms}ms）`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
};

export const useDailyNoteBridge = () => {
  const { isReady } = usePythonContext();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 从后端加载所有笔记
   */
  const loadNotes = useCallback(async () => {
    const py = (window as any).pyBridge;
    if (!py?.get_daily_notes) {
      console.warn('⚠️ [DailyNoteBridge] Bridge 未就绪');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('🔄 [DailyNoteBridge] 加载每日笔记...');
      
      const result = await withTimeout(py.get_daily_notes(), 5000, 'get_daily_notes');
      const data = JSON.parse(result as string);
      
      if (data.status === 'success') {
        setNotes(data.notes || {});
        console.log('✅ [DailyNoteBridge] 加载成功:', Object.keys(data.notes || {}).length, '条笔记');
      } else {
        throw new Error(data.message || '加载失败');
      }
    } catch (err: any) {
      console.error('❌ [DailyNoteBridge] 加载失败:', err);
      setError(err.message || '加载每日笔记失败');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 保存或更新笔记
   */
  const saveNote = useCallback(async (dateKey: string, content: string) => {
    const py = (window as any).pyBridge;
    if (!py?.save_daily_note) {
      throw new Error('Bridge 未就绪');
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('💾 [DailyNoteBridge] 保存笔记:', dateKey);
      
      const result = await withTimeout(
        py.save_daily_note(dateKey, content), 
        5000, 
        'save_daily_note'
      );
      const data = JSON.parse(result as string);
      
      if (data.status === 'success') {
        console.log('✅ [DailyNoteBridge] 保存成功');
        setNotes(data.notes || {});
        return true;
      } else {
        throw new Error(data.message || '保存失败');
      }
    } catch (err: any) {
      console.error('❌ [DailyNoteBridge] 保存失败:', err);
      setError(err.message || '保存每日笔记失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 删除笔记
   */
  const deleteNote = useCallback(async (dateKey: string) => {
    const py = (window as any).pyBridge;
    if (!py?.delete_daily_note) {
      throw new Error('Bridge 未就绪');
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('🗑️ [DailyNoteBridge] 删除笔记:', dateKey);
      
      const result = await withTimeout(
        py.delete_daily_note(dateKey), 
        5000, 
        'delete_daily_note'
      );
      const data = JSON.parse(result as string);
      
      if (data.status === 'success') {
        console.log('✅ [DailyNoteBridge] 删除成功');
        setNotes(data.notes || {});
        return true;
      } else {
        throw new Error(data.message || '删除失败');
      }
    } catch (err: any) {
      console.error('❌ [DailyNoteBridge] 删除失败:', err);
      setError(err.message || '删除每日笔记失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 获取指定日期的笔记
   */
  const getNote = useCallback((dateKey: string): string => {
    return notes[dateKey] || '';
  }, [notes]);

  /**
   * 初始化加载
   */
  useEffect(() => {
    if (!isReady) return;
    
    console.log('🔄 [DailyNoteBridge] Hook 挂载，加载数据');
    loadNotes();
  }, [isReady, loadNotes]);

  return {
    notes,
    loading,
    error,
    loadNotes,
    saveNote,
    deleteNote,
    getNote,
    isReady
  };
};
