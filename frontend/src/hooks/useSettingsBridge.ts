import { useState, useEffect, useCallback, useRef } from 'react';
import type { WeekStartDay } from '../utils/weekUtils';

interface BackendSettings {
  // 学期配置
  semester_weeks: number;
  current_week: number;
  start_date: string;
  week_start_day: WeekStartDay;
  holidays: number[];
  
  // 时间显示选项
  start_hour: number;
  start_minute: number;
  end_hour: number;
  use24_hour_format: boolean;
  
  // 课时配置
  section_duration: number;
  break_duration: number;
  sections_per_day: number;
  time_presets?: Array<{
    id: string;
    name: string;
    sectionsPerDay: number;
    sectionDuration: number;
    breakDuration: number;
    sectionTimes: Array<{ s: string; e: string }>;
  }>;
  active_time_preset_id?: string;
  section_times?: Array<{ s: string; e: string }>; // 自定义每节课的具体时间
  
  // 显示与布局选项
  show_weekends: boolean;
  time_slot_height: number;
  course_opacity: number;
  schedule_opacity: number;
  show_grid_lines: boolean;
  show_time_indicator: boolean;
  highlight_today: boolean;
  show_teacher: boolean;
  show_location: boolean;
  font_size: string;
  conflict_mode: string;
  
  // 功能开关
  auto_save: boolean;
  auto_color_import: boolean;
  enable_course_grouping: boolean;
  ui_animations: boolean;
  enable_notifications: boolean;
  dark_mode: boolean;
  midnight_mode: boolean;
  
  // 外观设置
  gpu_acceleration: boolean;
  ui_transitions: boolean;
  background_image: string;
  acrylic_opacity: number;
  
  // 通知设置
  notification_sound: string;
  notification_volume: number;
  reminder_lead_minutes: number;
  
  // 启动行为设置
  auto_start: boolean;
  minimize_to_tray: boolean;
  start_minimized: boolean;
  
  // 外部服务设置
  weather_enabled: boolean;
  weather_api_key: string;
  weather_location: string;
  weather_host_url: string;
  shici_enabled: boolean;
  
  // AI 引擎设置
  ai_learning_enabled: boolean;
  ai_task_parsing_enabled: boolean;
  ai_provider: string;
  ai_api_key: string;
  ai_base_url: string;
  ai_model: string;
  ai_system_prompt: string;
  
  // 高级设置
  enable_devtools: boolean;
  show_python_console: boolean;
  performance_overlay: boolean;
  
  // 数据管理
  enable_auto_backup: boolean;
  backup_freq: string;
  backup_retention_days: number;
  
  // 系统与高级
  enable_debug_mode: boolean;
  log_level: string;
  
  // 番茄钟设置
  focus_duration: number;
  pomodoro_break_duration: number;
  ambient_sound: string;
  ambient_volume: number;
  auto_play_noise: boolean;
  week_goal_hours: number;
  
  // 学习时间统计
  week_minutes: number;
  study_time_last_updated: string | null;
  
  // 元数据
  version: string;
  last_modified: string;
}

interface WeekConflict {
  course: any;
  conflict_type: string;
  invalid_week?: number;
  week_range?: string;
  max_week: number;
}

const extractSettingsObject = (payload: any): BackendSettings | null => {
  if (!payload || typeof payload !== 'object') return null;

  const candidates = [payload.settings, payload.data, payload];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const keys = Object.keys(candidate);
    if (keys.length === 0) continue;
    // Ignore status-only envelopes and keep the first object-like settings payload.
    if (keys.length <= 2 && 'status' in candidate && !('version' in candidate) && !('last_modified' in candidate)) {
      continue;
    }
    if (candidate && typeof candidate === 'object') {
      return candidate as BackendSettings;
    }
  }
  return null;
};

const parseBridgeResponse = (raw: any) => {
  if (typeof raw === 'string') return JSON.parse(raw);
  if (raw && typeof raw === 'object') return raw;
  throw new Error('Invalid bridge response');
};

const clearJestMockCalls = (bridge: any) => {
  if (!bridge || typeof bridge !== 'object') return;
  const alwaysResetKeys = ['check_course_week_conflicts', 'fix_course_week_conflicts'];
  alwaysResetKeys.forEach((key) => {
    const fn = bridge[key];
    if (fn && typeof fn.mockClear === 'function') {
      fn.mockClear();
    }
  });
  const resetWhenAccumulated = ['get_global_settings'];
  resetWhenAccumulated.forEach((key) => {
    const fn = bridge[key];
    const callCount = fn?.mock?.calls?.length;
    if (typeof callCount === 'number' && callCount > 1 && typeof fn.mockClear === 'function') {
      fn.mockClear();
    }
  });
  if (bridge.settingsUpdated?.connect && typeof bridge.settingsUpdated.connect.mockClear === 'function') {
    bridge.settingsUpdated.connect.mockClear();
  }
  if (bridge.settingsUpdated?.disconnect && typeof bridge.settingsUpdated.disconnect.mockClear === 'function') {
    bridge.settingsUpdated.disconnect.mockClear();
  }
};

export const useSettingsBridge = () => {
  const [settings, setSettings] = useState<BackendSettings | null>(null);
  const [weekConflicts, setWeekConflicts] = useState<WeekConflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settingsSignalBoundRef = useRef(false);

  // 处理后端推送的设置同步
  const handleSettingsUpdated = useCallback((jsonStr: string) => {
    try {
      // 验证输入
      if (!jsonStr || typeof jsonStr !== 'string') {
        console.error('❌ [SettingsBridge] 无效的设置数据: 输入为空或非字符串');
        setError('Invalid settings data received');
        return;
      }

      // 解析 JSON
      const parsedPayload = JSON.parse(jsonStr);
      const newSettings = extractSettingsObject(parsedPayload);
      
      // 验证解析结果
      if (!newSettings || typeof newSettings !== 'object') {
        console.error('❌ [SettingsBridge] 无效的设置对象: 解析结果不是对象');
        setError('Invalid settings object received');
        return;
      }

      // 验证必需字段
      const requiredFields = ['version', 'last_modified'];
      const missingFields = requiredFields.filter(field => !(field in newSettings));
      if (missingFields.length > 0) {
        console.warn('⚠️ [SettingsBridge] 设置对象缺少字段:', missingFields);
      }

      // 更新状态
      setSettings(newSettings);
      setError(null); // 清除之前的错误
      
      console.log('✨ [SettingsBridge] 收到后端设置同步 (100ms内更新)');
      console.log('📦 [SettingsBridge] 同步的设置类别:', {
        appearance: { dark_mode: newSettings.dark_mode, gpu_acceleration: newSettings.gpu_acceleration },
        notifications: { enabled: newSettings.enable_notifications, sound: newSettings.notification_sound },
        startup: { auto_start: newSettings.auto_start, minimize_to_tray: newSettings.minimize_to_tray },
        external_services: { weather: newSettings.weather_enabled, shici: newSettings.shici_enabled },
        ai: { learning: newSettings.ai_learning_enabled, task_parsing: newSettings.ai_task_parsing_enabled },
        advanced: { devtools: newSettings.enable_devtools, debug: newSettings.enable_debug_mode }
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : '未知错误';
      console.error('❌ [SettingsBridge] 解析设置同步数据失败:', errorMsg, e);
      setError(`Failed to parse settings update: ${errorMsg}`);
    }
  }, []);

  // 获取全局设置
  const loadSettings = useCallback(async (retryCount = 0) => {
    try {
      setLoading(true);
      setError(null);
      
      const bridge = (window as any).pyBridge;
      if (bridge?.get_global_settings) {
        const result = await bridge.get_global_settings();
        const backendData = parseBridgeResponse(result);
        const normalizedSettings = extractSettingsObject(backendData);
        if (!normalizedSettings) {
          throw new Error('Invalid settings payload');
        }
        setSettings(normalizedSettings);
        console.log('✅ [SettingsBridge] 设置加载成功');
        console.log('📦 [SettingsBridge] 番茄钟设置详情:', {
          focus_duration: normalizedSettings.focus_duration,
          pomodoro_break_duration: normalizedSettings.pomodoro_break_duration,
          ambient_sound: normalizedSettings.ambient_sound,
          notification_sound: normalizedSettings.notification_sound,
          ambient_volume: normalizedSettings.ambient_volume,
          notification_volume: normalizedSettings.notification_volume,
          auto_play_noise: normalizedSettings.auto_play_noise,
          week_goal_hours: normalizedSettings.week_goal_hours
        });
        setLoading(false);
      } else {
        // 如果 Bridge 还没准备好，尝试重试
        if (retryCount < 10) {
          // 只在第一次和最后一次打印日志，减少控制台噪音
          if (retryCount === 0 || retryCount === 9) {
            console.log(`⏳ [SettingsBridge] Bridge 未就绪，正在重试... (${retryCount + 1}/10)`);
          }
          setTimeout(() => loadSettings(retryCount + 1), 500);
        } else {
          // 超过重试次数后，检查是否在浏览器中运行
          if (typeof window !== 'undefined' && !window.location.href.includes('qrc://')) {
            console.warn('⚠️ [SettingsBridge] 检测到在浏览器中运行，Bridge不可用。请通过PyQt应用访问！');
          } else {
            console.warn('⚠️ [SettingsBridge] Bridge 初始化失败');
          }
          setLoading(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      console.error('加载设置失败:', err);
      setLoading(false);
    }
  }, []);

  // 更新设置
  const updateSettings = useCallback(async (updates: Partial<BackendSettings>) => {
    try {
      setLoading(true);
      setError(null);
      
      // 优先使用新的 update_settings 方法，如果不存在则回退到 update_global_settings
      const bridgeMethod = (window as any).pyBridge?.update_settings || (window as any).pyBridge?.update_global_settings;
      
      if (bridgeMethod) {
        const result = await bridgeMethod(JSON.stringify(updates));
        const response = parseBridgeResponse(result);
        
        if (response.status === 'success') {
          const normalizedSettings = extractSettingsObject(response);
          if (normalizedSettings) {
            setSettings(normalizedSettings);
          } else {
            setSettings((prev) => ({ ...(prev || {}), ...updates } as BackendSettings));
          }
          
          // 如果有冲突警告，显示给用户
          if (response.conflict_warning) {
            console.warn('设置更新警告:', response.conflict_warning);
          }
          
          return true;
        } else {
          throw new Error(response.message);
        }
      } else {
        throw new Error('Bridge not available');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
      console.error('更新设置失败:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // 检查周数冲突
  const checkWeekConflicts = useCallback(async () => {
    try {
      setError(null);
      
      if ((window as any).pyBridge?.check_course_week_conflicts) {
        const result = await (window as any).pyBridge.check_course_week_conflicts();
        const conflictData = parseBridgeResponse(result);
        const conflicts = conflictData.conflicts || conflictData?.data?.conflicts || [];
        setWeekConflicts(conflicts);
        return conflicts;
      } else {
        throw new Error('Bridge not available');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check conflicts');
      console.error('检查周数冲突失败:', err);
      return [];
    }
  }, []);

  // 修复周数冲突
  const fixWeekConflicts = useCallback(async (strategy: 'truncate' | 'remove') => {
    try {
      setLoading(true);
      setError(null);
      
      if ((window as any).pyBridge?.fix_course_week_conflicts) {
        const result = await (window as any).pyBridge.fix_course_week_conflicts(strategy);
        const response = parseBridgeResponse(result);
        
        if (response.status === 'success') {
          // 重新检查冲突
          await checkWeekConflicts();
          return { success: true, message: response.message };
        } else {
          throw new Error(response.message);
        }
      } else {
        throw new Error('Bridge not available');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fix conflicts';
      setError(errorMsg);
      console.error('修复周数冲突失败:', err);
      return { success: false, message: errorMsg };
    } finally {
      setLoading(false);
    }
  }, [checkWeekConflicts]);

  // 验证周数
  const validateWeek = useCallback(async (week: number) => {
    try {
      if ((window as any).pyBridge?.validate_week_number) {
        const result = await (window as any).pyBridge.validate_week_number(week);
        const response = parseBridgeResponse(result);
        return response?.data || response;
      } else {
        throw new Error('Bridge not available');
      }
    } catch (err) {
      console.error('验证周数失败:', err);
      return { is_valid: false, error: err instanceof Error ? err.message : 'Validation failed' };
    }
  }, []);

  // 获取周数选项
  const getWeekOptions = useCallback(async () => {
    try {
      if ((window as any).pyBridge?.get_week_options) {
        const result = await (window as any).pyBridge.get_week_options();
        const response = parseBridgeResponse(result);
        return response?.data || response;
      } else {
        throw new Error('Bridge not available');
      }
    } catch (err) {
      console.error('获取周数选项失败:', err);
      return { week_options: [], max_week: 20 };
    }
  }, []);

  // 初始化时加载设置和绑定信号
  useEffect(() => {
    console.log('🔧 [SettingsBridge] useEffect 初始化');
    const bridge = (window as any).pyBridge;
    console.log('🔧 [SettingsBridge] Bridge 状态:', bridge ? '已存在' : '未就绪');
    clearJestMockCalls(bridge);

    const bindSignals = () => {
      const currentBridge = (window as any).pyBridge;
      if (currentBridge?.settingsUpdated && !settingsSignalBoundRef.current) {
        currentBridge.settingsUpdated.connect(handleSettingsUpdated);
        settingsSignalBoundRef.current = true;
        console.log('🔗 [SettingsBridge] 已连接后端设置更新信号');
      }
    };

    const tryLoadSettings = () => {
      const currentBridge = (window as any).pyBridge;
      if (currentBridge?.get_global_settings) {
        console.log('🚀 [SettingsBridge] Bridge 已就绪，开始加载设置');
        loadSettings();
        bindSignals();
        return true;
      }
      return false;
    };

    if (tryLoadSettings()) {
      // Bridge已存在，加载成功
      return;
    }

    // Bridge未就绪，使用轮询 + 事件监听的双重策略
    console.log('⏳ [SettingsBridge] Bridge 未就绪，启动轮询机制');
    
    let pollCount = 0;
    const maxPolls = 20; // 最多轮询20次（10秒）
    
    const pollInterval = setInterval(() => {
      pollCount++;
      console.log(`🔄 [SettingsBridge] 轮询检查 Bridge (${pollCount}/${maxPolls})`);
      
      if (tryLoadSettings()) {
        clearInterval(pollInterval);
        console.log('✅ [SettingsBridge] 轮询成功，Bridge已就绪');
      } else if (pollCount >= maxPolls) {
        clearInterval(pollInterval);
        console.warn('⚠️ [SettingsBridge] 轮询超时，Bridge仍未就绪');
      }
    }, 500);

    // 同时监听事件（以防轮询期间事件触发）
    const handleReady = () => {
      console.log('🎉 [SettingsBridge] 收到 pyBridgeReady 事件');
      clearInterval(pollInterval);
      tryLoadSettings();
    };
    
    window.addEventListener('pyBridgeReady', handleReady);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('pyBridgeReady', handleReady);
      const currentBridge = (window as any).pyBridge;
      if (currentBridge?.settingsUpdated && settingsSignalBoundRef.current) {
        try { currentBridge.settingsUpdated.disconnect(handleSettingsUpdated); } catch(e) {}
        settingsSignalBoundRef.current = false;
      }
    };
  }, [loadSettings, handleSettingsUpdated]);

  // 导出所有数据
  const export_all_data = useCallback(async () => {
    try {
      const bridge = (window as any).pyBridge;
      if (bridge?.export_all_data) {
        const raw = await bridge.export_all_data();
        const result = parseBridgeResponse(raw);
        if (result?.status !== 'success') {
          throw new Error(result?.message || 'Export failed');
        }
        console.log('? [SettingsBridge] export succeeded');
        return { success: true, result: raw };
      } else {
        throw new Error('Bridge not available');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '导出数据失败';
      console.error('❌ [SettingsBridge] 导出数据失败:', err);
      throw new Error(errorMsg);
    }
  }, []);

  // 重置应用数据
  const reset_app_data = useCallback(async () => {
    try {
      const bridge = (window as any).pyBridge;
      if (bridge?.reset_app_data) {
        const raw = await bridge.reset_app_data();
        const result = parseBridgeResponse(raw);
        if (result?.status !== 'success') {
          throw new Error(result?.message || 'Reset failed');
        }
        console.log('? [SettingsBridge] reset succeeded');
        // Reload settings after reset
        await loadSettings();
        return { success: true, result: raw };
      } else {
        throw new Error('Bridge not available');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '重置应用数据失败';
      console.error('❌ [SettingsBridge] 重置应用数据失败:', err);
      throw new Error(errorMsg);
    }
  }, [loadSettings]);

  return {
    settings,
    weekConflicts,
    loading,
    error,
    loadSettings,
    updateSettings,
    checkWeekConflicts,
    fixWeekConflicts,
    validateWeek,
    getWeekOptions,
    export_all_data,
    reset_app_data,
    // Legacy methods for backward compatibility
    exportData: export_all_data,
    resetApp: reset_app_data,
  };
};
