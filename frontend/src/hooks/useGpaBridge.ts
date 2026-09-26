/**
 * useGpaBridge Hook
 * 
 * GPA 数据管理的前后端桥接 Hook
 * 提供 GPA 记录的增删改查功能，数据持久化到后端
 */

import { useState, useEffect, useCallback } from 'react';
import { usePythonContext } from '../contexts/PythonContext';

export interface GpaRecord {
  id: string;
  year: string;
  term: string;
  value: string;
  semester?: string; // 后端使用的组合键 (year + term)
}

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

export const useGpaBridge = () => {
  const { isReady } = usePythonContext();
  const [records, setRecords] = useState<GpaRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 从后端加载 GPA 记录
   */
  const loadRecords = useCallback(async () => {
    const py = (window as any).pyBridge;
    if (!py?.get_gpa_records) {
      console.warn('⚠️ [GpaBridge] Bridge 未就绪');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('🔄 [GpaBridge] 加载 GPA 记录...');
      
      const result = await withTimeout(py.get_gpa_records(), 5000, 'get_gpa_records');
      const data = JSON.parse(result as string);
      
      if (data.status === 'success') {
        // 转换后端数据格式到前端格式
        const frontendRecords = (data.records || []).map((r: any) => ({
          id: r.id || r.semester || `${r.year}-${r.term}`,
          year: r.year,
          term: r.term,
          value: r.value,
          semester: r.semester || `${r.year}-${r.term}`
        }));
        
        setRecords(frontendRecords);
        console.log('✅ [GpaBridge] 加载成功:', frontendRecords.length, '条记录');
      } else {
        throw new Error(data.message || '加载失败');
      }
    } catch (err: any) {
      console.error('❌ [GpaBridge] 加载失败:', err);
      setError(err.message || '加载 GPA 记录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 保存或更新 GPA 记录
   */
  const saveRecord = useCallback(async (record: Partial<GpaRecord> & { year: string; term: string; value: string }) => {
    const py = (window as any).pyBridge;
    if (!py?.save_gpa_record) {
      throw new Error('Bridge 未就绪');
    }

    try {
      setLoading(true);
      setError(null);
      
      // 构造后端需要的数据格式
      const backendRecord = {
        id: `${record.year}-${record.term}`,
        year: record.year,
        term: record.term,
        value: record.value,
        semester: `${record.year}-${record.term}`
      };
      
      console.log('💾 [GpaBridge] 保存记录:', backendRecord);
      
      const result = await withTimeout(
        py.save_gpa_record(JSON.stringify(backendRecord)), 
        5000, 
        'save_gpa_record'
      );
      const data = JSON.parse(result as string);
      
      if (data.status === 'success') {
        console.log('✅ [GpaBridge] 保存成功');
        // 重新加载数据
        await loadRecords();
        return true;
      } else {
        throw new Error(data.message || '保存失败');
      }
    } catch (err: any) {
      console.error('❌ [GpaBridge] 保存失败:', err);
      setError(err.message || '保存 GPA 记录失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadRecords]);

  /**
   * 删除 GPA 记录
   */
  const deleteRecord = useCallback(async (id: string) => {
    const py = (window as any).pyBridge;
    if (!py?.delete_gpa_record) {
      throw new Error('Bridge 未就绪');
    }

    try {
      setLoading(true);
      setError(null);
      
      // 找到对应的记录
      const record = records.find(r => r.id === id);
      if (!record) {
        throw new Error('记录不存在');
      }
      
      const semester = record.semester || `${record.year}-${record.term}`;
      console.log('🗑️ [GpaBridge] 删除记录:', semester);
      
      const result = await withTimeout(
        py.delete_gpa_record(semester), 
        5000, 
        'delete_gpa_record'
      );
      const data = JSON.parse(result as string);
      
      if (data.status === 'success') {
        console.log('✅ [GpaBridge] 删除成功');
        // 重新加载数据
        await loadRecords();
        return true;
      } else {
        throw new Error(data.message || '删除失败');
      }
    } catch (err: any) {
      console.error('❌ [GpaBridge] 删除失败:', err);
      setError(err.message || '删除 GPA 记录失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [records, loadRecords]);

  /**
   * 初始化加载
   */
  useEffect(() => {
    if (!isReady) return;
    
    console.log('🔄 [GpaBridge] Hook 挂载，加载数据');
    loadRecords();
  }, [isReady, loadRecords]);

  return {
    records,
    loading,
    error,
    loadRecords,
    saveRecord,
    deleteRecord,
    isReady
  };
};
