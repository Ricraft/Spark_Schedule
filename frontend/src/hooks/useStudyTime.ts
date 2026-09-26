import { useState, useEffect } from 'react';
import { useSettingsBridge } from './useSettingsBridge';
import { getDayIndexInWeek, getWeekStartDateKey, normalizeWeekStartDay } from '../utils/weekUtils';

/**
 * 学习时长管理 hook
 * 数据保存到后端，通过 Bridge 同步
 * 同时记录每日学习时长到 localStorage
 */
export const useStudyTime = () => {
  const { settings, updateSettings } = useSettingsBridge();
  const weekStartDay = normalizeWeekStartDay(settings?.week_start_day);
  
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [weekGoalHours, setWeekGoalHours] = useState(20);

  // 从后端加载数据
  useEffect(() => {
    if (settings) {
      setWeekMinutes(settings.week_minutes || 0);
      setWeekGoalHours(settings.week_goal_hours || 20);
      console.log('✅ [useStudyTime] 从后端加载学习时间:', {
        weekMinutes: settings.week_minutes,
        weekGoalHours: settings.week_goal_hours
      });
    }
  }, [settings]);

  // 获取今天是本周的第几天 (0=周一, 6=周日)
  const getTodayIndex = () => {
    return getDayIndexInWeek(new Date(), weekStartDay);
  };

  // 获取本周的日期标识 (用于判断是否需要重置)
  const getWeekKey = () => {
    return getWeekStartDateKey(new Date(), weekStartDay);
  };

  // 添加学习时长（分钟）
  const addMinutes = async (minutes: number) => {
    const newTotal = weekMinutes + minutes;
    setWeekMinutes(newTotal);
    
    try {
      // 保存到后端
      await updateSettings({ 
        week_minutes: newTotal,
        study_time_last_updated: new Date().toISOString()
      });
      console.log(`✅ [useStudyTime] 保存学习时长: ${newTotal} 分钟`);
      
      // 同时更新每日记录到 localStorage
      const todayIndex = getTodayIndex();
      const weekKey = getWeekKey();
      
      try {
        // 读取现有记录
        const recordsKey = 'daily_study_records';
        const weekKeyStorage = 'daily_study_week_key';
        const storedWeekKey = localStorage.getItem(weekKeyStorage);
        
        let dailyRecords: number[] = Array(7).fill(0);
        
        // 如果是同一周，读取现有数据
        if (storedWeekKey === weekKey) {
          const stored = localStorage.getItem(recordsKey);
          if (stored) {
            dailyRecords = JSON.parse(stored);
          }
        } else {
          // 新的一周，重置记录
          console.log('🔄 [useStudyTime] 检测到新的一周，重置每日记录');
          localStorage.setItem(weekKeyStorage, weekKey);
        }
        
        // 更新今天的记录（累加）
        dailyRecords[todayIndex] = (dailyRecords[todayIndex] || 0) + (minutes / 60);
        
        // 保存
        localStorage.setItem(recordsKey, JSON.stringify(dailyRecords));
        console.log(`📊 [useStudyTime] 更新每日记录: 周${['一','二','三','四','五','六','日'][todayIndex]} +${(minutes/60).toFixed(1)}h`);
      } catch (e) {
        console.error('❌ [useStudyTime] 保存每日记录失败:', e);
      }
    } catch (e) {
      console.error('❌ [useStudyTime] 保存学习时长失败:', e);
    }
  };

  // 更新目标学习时长
  const updateGoal = async (goalHours: number) => {
    setWeekGoalHours(goalHours);
    
    try {
      await updateSettings({ week_goal_hours: goalHours });
      console.log(`✅ [useStudyTime] 保存目标学习时长: ${goalHours} 小时`);
    } catch (e) {
      console.error('❌ [useStudyTime] 保存目标学习时长失败:', e);
    }
  };

  // 重置本周数据（每周一自动调用）
  const resetWeek = async () => {
    setWeekMinutes(0);
    try {
      await updateSettings({ 
        week_minutes: 0,
        study_time_last_updated: new Date().toISOString()
      });
      
      // 同时重置每日记录
      localStorage.setItem('daily_study_records', JSON.stringify(Array(7).fill(0)));
      localStorage.setItem('daily_study_week_key', getWeekKey());
      
      console.log('✅ [useStudyTime] 重置本周学习时长和每日记录');
    } catch (e) {
      console.error('❌ [useStudyTime] 重置学习时长失败:', e);
    }
  };

  // 获取每日记录
  const getDailyRecords = (): number[] => {
    try {
      const weekKey = getWeekKey();
      const storedWeekKey = localStorage.getItem('daily_study_week_key');
      
      // 如果不是同一周，返回空记录
      if (storedWeekKey !== weekKey) {
        return Array(7).fill(0);
      }
      
      const stored = localStorage.getItem('daily_study_records');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('❌ [useStudyTime] 读取每日记录失败:', e);
    }
    return Array(7).fill(0);
  };

  return {
    weekMinutes,
    weekHours: parseFloat((weekMinutes / 60).toFixed(2)),
    weekGoalHours,
    updateGoal,
    addMinutes,
    resetWeek,
    getDailyRecords, // 新增：获取每日记录
  };
};
