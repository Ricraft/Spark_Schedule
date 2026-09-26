import { useState, useEffect, useCallback } from 'react';

/**
 * 每日学习记录管理 Hook
 * 用于统计页面显示每天的学习时长
 */
export const useDailyStudyRecords = () => {
  const [dailyRecords, setDailyRecords] = useState<number[]>(Array(7).fill(0));

  // 从 localStorage 加载记录
  useEffect(() => {
    try {
      const stored = localStorage.getItem('daily_study_records');
      const weekStart = localStorage.getItem('week_start_date');
      const today = new Date();
      const currentWeekStart = getWeekStartDate(today);

      // 如果是新的一周，重置记录
      if (weekStart !== currentWeekStart) {
        console.log('🔄 [DailyStudyRecords] 新的一周开始，重置记录');
        localStorage.setItem('week_start_date', currentWeekStart);
        localStorage.setItem('daily_study_records', JSON.stringify(Array(7).fill(0)));
        setDailyRecords(Array(7).fill(0));
      } else if (stored) {
        const records = JSON.parse(stored);
        if (Array.isArray(records) && records.length === 7) {
          setDailyRecords(records);
        }
      }
    } catch (e) {
      console.error('❌ [DailyStudyRecords] 加载失败:', e);
    }
  }, []);

  // 添加今天的学习时长（小时）
  const addTodayHours = useCallback((hours: number) => {
    const today = new Date().getDay(); // 0=周日, 1=周一
    const dayIndex = today === 0 ? 6 : today - 1; // 转换为 0=周一, 6=周日

    setDailyRecords(prev => {
      const newRecords = [...prev];
      newRecords[dayIndex] = parseFloat((newRecords[dayIndex] + hours).toFixed(2));
      
      try {
        localStorage.setItem('daily_study_records', JSON.stringify(newRecords));
        console.log(`✅ [DailyStudyRecords] 记录今天学习时长: ${hours}h, 总计: ${newRecords[dayIndex]}h`);
      } catch (e) {
        console.error('❌ [DailyStudyRecords] 保存失败:', e);
      }
      
      return newRecords;
    });
  }, []);

  // 获取本周总时长
  const weekTotal = dailyRecords.reduce((sum, hours) => sum + hours, 0);

  return {
    dailyRecords,
    weekTotal,
    addTodayHours
  };
};

// 获取本周一的日期字符串 (YYYY-MM-DD)
function getWeekStartDate(date: Date): string {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // 周日算上周，周一为0
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}
