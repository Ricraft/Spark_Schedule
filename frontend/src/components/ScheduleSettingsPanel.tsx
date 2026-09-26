import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, CalendarClock, Palette, Database, Settings, 
  Save, RotateCcw, AlertTriangle, Eye, EyeOff, RefreshCw, 
  CheckCircle, XCircle, Info, Download, Upload, Wifi, WifiOff, Clock, Trash2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useSettingsBridge } from '../hooks/useSettingsBridge';
import type { WeekStartDay } from '../utils/weekUtils';

// --- 绫诲瀷瀹氫箟 ---
export interface TimePreset {
  id: string;
  name: string;
  sectionsPerDay: number;
  sectionDuration: number;
  breakDuration: number;
  sectionTimes: { s: string; e: string }[];
}

export interface ScheduleSettings {
  semesterStartDate: string;
  weekStartDay: WeekStartDay;
  currentWeek: number;
  totalWeeks: number;
  holidays: number[];
  startHour: number;
  startMinute: number;
  endHour: number;
  slotHeight: number;
  use24HourFormat: boolean;
  sectionDuration: number;
  breakDuration: number;
  sectionsPerDay: number;
  sectionTimes: { s: string; e: string }[];
  timePresets: TimePreset[]; // 馃敟 鏂板锛氫繚瀛樼殑澶氬鏂规
  activeTimePresetId: string; // 馃敟 鏂板锛氬綋鍓嶅惎鐢ㄧ殑鏂规ID
  showWeekend: boolean;
  courseOpacity: number;
  scheduleOpacity: number;
  showNonCurrentWeekCourses: boolean;
  showCourseWhiteBorder: boolean;
  showGridLines: boolean;
  showTimeIndicator: boolean;
  highlightToday: boolean;
  showTeacher: boolean;
  showLocation: boolean;
  fontSize: 'small' | 'medium' | 'large';
  conflictMode: 'overlap' | 'stack';
  autoSave: boolean;
  backupFreq: 'daily' | 'weekly' | 'manual';
  enableAnimations: boolean;
  autoColorImport: boolean;
  enableCourseGrouping: boolean;
  compactMode: boolean;
  showCourseCode: boolean;
  showCredit: boolean;
  enableNotifications: boolean;
  midnightMode: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  enableKeyboardShortcuts: boolean;
  showMiniCalendar: boolean;
  enableWeatherWidget: boolean;
  defaultViewMode: 'week' | 'month' | 'agenda';
  enableSoundNotifications: boolean;
  notificationSound: 'default' | 'chime' | 'bell' | 'none';
  enableVibration: boolean;
  autoHideEmptyDays: boolean;
  showProgressBar: boolean;
  enableFocusMode: boolean;
  focusModeOpacity: number;
  enableHighContrast: boolean;
  reduceMotion: boolean;
  enableTooltips: boolean;
  tooltipDelay: number;
  maxUndoSteps: number;
  enableAutoBackup: boolean;
  backupRetentionDays: number;
  enableCloudSync: boolean;
  syncProvider: 'google' | 'onedrive' | 'dropbox' | 'none';
  enableOfflineMode: boolean;
  cacheSize: number;
  enableDebugMode: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface PreviewState {
  enabled: boolean;
  isValid: boolean;
  errors: ValidationError[];
}

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (value: string): Date | null => {
  if (!value || typeof value !== 'string') return null;
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
};

export const DEFAULT_SETTINGS: ScheduleSettings = {
  semesterStartDate: formatLocalDate(new Date()),
  weekStartDay: 'monday',
  currentWeek: 1,
  totalWeeks: 20,
  holidays: [],
  startHour: 8,
  startMinute: 0,
  endHour: 22,
  slotHeight: 80,
  use24HourFormat: true,
  sectionDuration: 45,
  breakDuration: 10,
  sectionsPerDay: 12,
  sectionTimes: Array.from({ length: 12 }, (_, i) => {
    const totalMinutes = 8 * 60 + i * (45 + 10);
    const startH = Math.floor(totalMinutes / 60);
    const startM = totalMinutes % 60;
    const endTotalMinutes = totalMinutes + 45;
    const endH = Math.floor(endTotalMinutes / 60);
    const endM = endTotalMinutes % 60;
    return {
      s: `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`,
      e: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`
    };
  }),
  timePresets: [
    {
      id: 'default-standard',
      name: '标准教学作息',
      sectionsPerDay: 12,
      sectionDuration: 45,
      breakDuration: 10,
      sectionTimes: Array.from({ length: 12 }, (_, i) => {
        const totalMinutes = 8 * 60 + i * (45 + 10);
        const startH = Math.floor(totalMinutes / 60);
        const startM = totalMinutes % 60;
        const endTotalMinutes = totalMinutes + 45;
        const endH = Math.floor(endTotalMinutes / 60);
        const endM = endTotalMinutes % 60;
        return {
          s: `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`,
          e: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`
        };
      })
    }
  ],
  activeTimePresetId: 'default-standard',
  showWeekend: true,
  courseOpacity: 0.9,
  scheduleOpacity: 0.2,
  showNonCurrentWeekCourses: false,
  showCourseWhiteBorder: true,
  showGridLines: true,
  showTimeIndicator: true,
  highlightToday: true,
  showTeacher: true,
  showLocation: true,
  fontSize: 'medium',
  conflictMode: 'overlap',
  autoSave: true,
  backupFreq: 'daily',
  enableAnimations: true,
  autoColorImport: true,
  enableCourseGrouping: true,
  compactMode: false,
  showCourseCode: false,
  showCredit: true,
  enableNotifications: true,
  midnightMode: false,
  autoRefresh: false,
  refreshInterval: 5,
  enableKeyboardShortcuts: true,
  showMiniCalendar: true,
  enableWeatherWidget: false,
  defaultViewMode: 'week',
  enableSoundNotifications: true,
  notificationSound: 'default',
  enableVibration: false,
  autoHideEmptyDays: false,
  showProgressBar: true,
  enableFocusMode: false,
  focusModeOpacity: 0.3,
  enableHighContrast: false,
  reduceMotion: false,
  enableTooltips: true,
  tooltipDelay: 500,
  maxUndoSteps: 10,
  enableAutoBackup: true,
  backupRetentionDays: 30,
  enableCloudSync: false,
  syncProvider: 'none',
  enableOfflineMode: true,
  cacheSize: 100,
  enableDebugMode: false,
  logLevel: 'warn'
};

function debounce(func: Function, wait: number) {
  let timeout: any;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

interface ScheduleSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ScheduleSettings;
  onUpdateSettings: (newSettings: ScheduleSettings) => void;
  onPreviewSettings?: (previewSettings: ScheduleSettings) => void;
}

type SettingsTab = 'general' | 'appearance' | 'data' | 'system';

export const ScheduleSettingsPanel = ({ 
  isOpen, onClose, settings, onUpdateSettings, onPreviewSettings 
}: ScheduleSettingsPanelProps) => {
  const CLOSE_ANIMATION_MS = 700;
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [localSettings, setLocalSettings] = useState<ScheduleSettings>(settings);
  const [previewState, setPreviewState] = useState<PreviewState>({ enabled: true, isValid: true, errors: [] });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isManualSaving, setIsManualSaving] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);

  const {
    settings: backendSettings, weekConflicts, loading: bridgeLoading,
    updateSettings, fixWeekConflicts, checkWeekConflicts
  } = useSettingsBridge();

  const validateSettings = useCallback((s: ScheduleSettings): ValidationError[] => {
    const errors: ValidationError[] = [];
    const parseHm = (hm: string): number | null => {
      if (!hm || typeof hm !== 'string' || !hm.includes(':')) return null;
      const [h, m] = hm.split(':').map((part) => Number.parseInt(part, 10));
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      return h * 60 + m;
    };

    if (s.totalWeeks < 1 || s.totalWeeks > 52) {
      errors.push({ field: '学期周数', message: '需在 1-52 周之间', severity: 'error' });
    }
    if (s.currentWeek < 1 || s.currentWeek > s.totalWeeks) {
      errors.push({ field: '当前周数', message: '超出范围', severity: 'error' });
    }
    if (s.startHour >= s.endHour) {
      errors.push({ field: '时间范围', message: '结束时间必须晚于开始时间', severity: 'error' });
    }
    if (s.sectionsPerDay < 1 || s.sectionsPerDay > 20) {
      errors.push({ field: '每日节数', message: '需在 1-20 节之间', severity: 'error' });
    }
    if (s.scheduleOpacity < 0.1 || s.scheduleOpacity > 1) {
      errors.push({ field: '课程表透明度', message: '需在 10%-100% 之间', severity: 'error' });
    }

    const sectionTimes = Array.isArray(s.sectionTimes) ? s.sectionTimes : [];
    const maxCheck = Math.min(sectionTimes.length, Math.max(1, Number.parseInt(String(s.sectionsPerDay || 1), 10)));
    for (let i = 0; i < maxCheck; i++) {
      const slot = sectionTimes[i];
      const start = parseHm(slot?.s || '');
      const end = parseHm(slot?.e || '');
      if (start === null || end === null || start >= end) {
        errors.push({
          field: `第${i + 1}节时间`,
          message: '开始时间必须早于结束时间',
          severity: 'error'
        });
        break;
      }
    }

    return errors;
  }, []);

  const mapSettingsToBackend = useCallback((s: ScheduleSettings) => {
    return {
      semester_weeks: s.totalWeeks,
      current_week: s.currentWeek,
      start_date: s.semesterStartDate,
      week_start_day: s.weekStartDay,
      holidays: s.holidays,
      start_hour: s.startHour,
      start_minute: s.startMinute,
      end_hour: s.endHour,
      use24_hour_format: s.use24HourFormat,
      section_duration: s.sectionDuration,
      break_duration: s.breakDuration,
      sections_per_day: s.sectionsPerDay,
      section_times: (s.sectionTimes || []).map((slot) => ({ ...slot })),
      time_presets: (s.timePresets || []).map((preset) => ({
        ...preset,
        sectionTimes: (preset.sectionTimes || []).map((slot) => ({ ...slot })),
      })),
      active_time_preset_id: s.activeTimePresetId,
      show_weekends: s.showWeekend,
      time_slot_height: s.slotHeight,
      course_opacity: s.courseOpacity,
      schedule_opacity: s.scheduleOpacity,
      show_non_current_week_courses: s.showNonCurrentWeekCourses,
      show_course_white_border: s.showCourseWhiteBorder,
      show_grid_lines: s.showGridLines,
      show_time_indicator: s.showTimeIndicator,
      highlight_today: s.highlightToday,
      show_teacher: s.showTeacher,
      show_location: s.showLocation,
      font_size: s.fontSize,
      conflict_mode: s.conflictMode,
      auto_save: s.autoSave,
      auto_color_import: s.autoColorImport,
      enable_course_grouping: s.enableCourseGrouping,
      ui_animations: s.enableAnimations,
      enable_notifications: s.enableNotifications,
      midnight_mode: s.midnightMode,
      enable_auto_backup: s.enableAutoBackup,
      backup_freq: s.backupFreq,
      backup_retention_days: s.backupRetentionDays,
      enable_debug_mode: s.enableDebugMode,
      log_level: s.logLevel
    };
  }, []);

  const syncToBackend = useCallback(
    debounce(async (s: ScheduleSettings) => {
      await updateSettings(mapSettingsToBackend(s));
    }, 800),
    [updateSettings, mapSettingsToBackend]
  );

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setLocalSettings(settings);
      setHasUnsavedChanges(false);
      if (checkWeekConflicts) checkWeekConflicts();
    }
  }, [isOpen, settings, checkWeekConflicts]);

  useEffect(() => {
    if (isOpen) return;
    const timer = window.setTimeout(() => setShouldRender(false), CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const handleBatchChange = useCallback((changes: Partial<ScheduleSettings>) => {
    const toInt = (value: unknown, fallback: number) => {
      const parsed = Number.parseInt(String(value), 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const toMinutes = (value: string | undefined): number | null => {
      if (!value || typeof value !== 'string' || !value.includes(':')) return null;
      const [h, m] = value.split(':').map((part) => Number.parseInt(part, 10));
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      return h * 60 + m;
    };
    const toTime = (totalMinutes: number): string => {
      const normalized = Math.max(0, totalMinutes);
      const h = Math.floor(normalized / 60) % 24;
      const m = normalized % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    let newSettings: ScheduleSettings = { ...localSettings, ...changes };

    if (
      Object.prototype.hasOwnProperty.call(changes, 'semesterStartDate') &&
      !Object.prototype.hasOwnProperty.call(changes, 'weekStartDay')
    ) {
      const parsedDate = parseLocalDate(String(newSettings.semesterStartDate || ''));
      if (parsedDate) {
        const days: WeekStartDay[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        newSettings.weekStartDay = days[parsedDate.getDay()];
      }
    }

    const sectionsPerDayChanged = Object.prototype.hasOwnProperty.call(changes, 'sectionsPerDay');
    const durationChanged = Object.prototype.hasOwnProperty.call(changes, 'sectionDuration');
    const breakChanged = Object.prototype.hasOwnProperty.call(changes, 'breakDuration');
    const sectionMetaChanged = sectionsPerDayChanged || durationChanged || breakChanged;
    const sectionTimesOverridden = Object.prototype.hasOwnProperty.call(changes, 'sectionTimes');

    if (sectionMetaChanged && !sectionTimesOverridden) {
      const targetCount = Math.max(1, Math.min(20, toInt(newSettings.sectionsPerDay, localSettings.sectionsPerDay || 1)));
      const duration = Math.max(1, toInt(newSettings.sectionDuration, localSettings.sectionDuration || 45));
      const breakDur = Math.max(0, toInt(newSettings.breakDuration, localSettings.breakDuration || 10));
      const currentTimes = [...(localSettings.sectionTimes || [])].map((slot) => ({ ...slot }));
      const defaultStartMinutes = Math.max(0, (newSettings.startHour || 8) * 60 + (newSettings.startMinute || 0));

      // Any meta change (sections/duration/break) should re-derive all section times.
      // Keep the first section start time when available; otherwise use global start time.
      let startMinutes = toMinutes(currentTimes[0]?.s) ?? defaultStartMinutes;
      const rebuilt: { s: string; e: string }[] = [];
      for (let i = 0; i < targetCount; i++) {
        const endMinutes = startMinutes + duration;
        rebuilt.push({ s: toTime(startMinutes), e: toTime(endMinutes) });
        startMinutes = endMinutes + breakDur;
      }
      newSettings.sectionTimes = rebuilt;

      newSettings.sectionsPerDay = targetCount;
      newSettings.sectionDuration = duration;
      newSettings.breakDuration = breakDur;
    } else if (Array.isArray(newSettings.sectionTimes)) {
      newSettings.sectionTimes = newSettings.sectionTimes.map((slot) => ({ ...slot }));
    }

    if (Array.isArray(newSettings.timePresets) && newSettings.activeTimePresetId) {
      newSettings.timePresets = newSettings.timePresets.map((preset) => (
        preset.id === newSettings.activeTimePresetId
          ? {
              ...preset,
              sectionsPerDay: newSettings.sectionsPerDay,
              sectionDuration: newSettings.sectionDuration,
              breakDuration: newSettings.breakDuration,
              sectionTimes: (newSettings.sectionTimes || []).map((slot) => ({ ...slot })),
            }
          : preset
      ));
    }

    setLocalSettings(newSettings);
    setHasUnsavedChanges(true);

    if (previewState.enabled && onPreviewSettings) {
      onPreviewSettings(newSettings);
      syncToBackend(newSettings);
    }

    const errors = validateSettings(newSettings);
    setPreviewState((prev) => ({
      ...prev,
      isValid: errors.filter((e) => e.severity === 'error').length === 0,
      errors
    }));
  }, [localSettings, previewState.enabled, onPreviewSettings, syncToBackend, validateSettings]);

  const handleChange = useCallback((key: keyof ScheduleSettings, value: any) => {
    handleBatchChange({ [key]: value } as Partial<ScheduleSettings>);
  }, [handleBatchChange]);

  const handleSave = async () => {
    try {
      setIsManualSaving(true);
      const success = await updateSettings(mapSettingsToBackend(localSettings));
      if (success) {
        onUpdateSettings(localSettings);
        setHasUnsavedChanges(false);
        onClose();
      }
    } finally {
      setIsManualSaving(false);
    }
  };

  const handleExportSettings = useCallback(() => {
    try {
      const blob = new Blob([JSON.stringify(localSettings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `schedule-settings-${formatLocalDate(new Date())}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出设置失败:', error);
    }
  }, [localSettings]);

  const handleImportSettings = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const importedSettings = JSON.parse(content);
        if (importedSettings && typeof importedSettings === 'object') {
          handleBatchChange(importedSettings);
        }
      } catch (error) {
        console.error('导入设置失败:', error);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [handleBatchChange]);

  const handleReset = () => {
    if (confirm('确定要重置为默认设置吗？')) {
      setLocalSettings(DEFAULT_SETTINGS);
      setHasUnsavedChanges(true);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges && !confirm('有未保存修改，确定关闭？')) return;
    onClose();
  };

  const settingsCategories = [
    { id: 'general', name: '基础设定', description: '学期、周次与作息', icon: <CalendarClock size={20} /> },
    { id: 'appearance', name: '界面外观', description: '视觉与课程卡样式', icon: <Palette size={20} /> },
    { id: 'data', name: '数据管理', description: '导入导出与备份', icon: <Database size={20} /> },
    { id: 'system', name: '系统高级', description: '性能与调试开关', icon: <Settings size={20} /> }
  ];

  if (!shouldRender) return null;

  return (
    <>
      <style>{`
        @keyframes ssp-shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .ssp-animate-shine {
          animation: ssp-shine 2s infinite;
        }
        @keyframes ssp-pulse-subtle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(1.01); }
        }
        .ssp-animate-pulse-subtle {
          animation: ssp-pulse-subtle 3s infinite ease-in-out;
        }
        @keyframes ssp-bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .ssp-animate-bounce-slow {
          animation: ssp-bounce-slow 2s infinite ease-in-out;
        }
        @keyframes ssp-pulse-slow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(0.98); }
        }
        .ssp-animate-pulse-slow {
          animation: ssp-pulse-slow 4s infinite ease-in-out;
        }
        @keyframes ssp-all-width {
          from { width: 0; }
          to { width: 48px; }
        }
        .ssp-animate-all-width {
          animation: ssp-all-width 1s ease-out forwards;
        }
      `}</style>
      <div className={`fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={handleClose} />
      {/* ... rest of the component remains ... */}
      <div className={`fixed top-0 right-0 h-full w-[850px] z-[70] flex shadow-[-20px_0_50px_rgba(0,0,0,0.15)] transition-all duration-700 cubic-bezier(0.2, 0.8, 0.2, 1) ${isOpen ? 'translate-x-0' : 'translate-x-full'} bg-white/90 backdrop-blur-3xl border-l border-white/50 ring-1 ring-white/60`}>
        <div className="w-[260px] flex flex-col bg-slate-50/40 border-r border-slate-200/40 pt-12 px-5 space-y-2">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3 mb-8 px-2">
            <div className="w-2 h-7 bg-indigo-600 rounded-full" /> 全局设置
          </h2>
          <div className="space-y-1.5 flex-1">
            {settingsCategories.map(cat => (
              <NavButton key={cat.id} active={activeTab === cat.id} onClick={() => setActiveTab(cat.id as SettingsTab)} icon={cat.icon} label={cat.name} desc={cat.description} />
            ))}
          </div>
          <div className="p-5 bg-white/40 rounded-3xl border border-white/60 space-y-4 shadow-sm mb-6 text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
            <StatusRow label="实时预览" active={previewState.enabled} color="bg-green-500" />
            <StatusRow label="配置校验" active={previewState.isValid} color="bg-blue-500" />
          </div>
        </div>
        <div className="flex-1 flex flex-col h-full bg-white/20 relative">
          <div className="absolute top-8 right-8 z-10 flex items-center gap-4">
            <div className="flex bg-slate-100/80 backdrop-blur-md p-1 rounded-2xl border border-slate-200/50 shadow-sm">
              <button
                title={previewState.enabled ? '关闭实时预览' : '开启实时预览'}
                aria-label={previewState.enabled ? '关闭实时预览' : '开启实时预览'}
                onClick={() => setPreviewState(p => ({ ...p, enabled: !p.enabled }))}
                className={`p-2.5 rounded-xl transition-all ${previewState.enabled ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
              >
                {previewState.enabled ? <Eye size={20} strokeWidth={2.5} /> : <EyeOff size={20} strokeWidth={2.5} />}
              </button>
              <button title="重置设置" aria-label="重置设置" onClick={handleReset} className="p-2.5 text-slate-400 hover:text-red-500 transition-all rounded-xl"><RotateCcw size={20} strokeWidth={2.5} /></button>
            </div>
            <button title="关闭设置" aria-label="关闭设置" onClick={handleClose} className="p-2.5 bg-slate-100/80 backdrop-blur-md hover:bg-slate-200/80 rounded-2xl transition-all border border-slate-200/50 shadow-sm text-slate-500"><X size={20} strokeWidth={2.5} /></button>
          </div>
          <div className="flex-1 p-12 pt-20 overflow-y-auto custom-scrollbar space-y-10">
            {activeTab === 'general' && <GeneralSettingsView localSettings={localSettings} handleChange={handleChange} handleBatchChange={handleBatchChange} weekConflicts={weekConflicts} handleFixConflicts={fixWeekConflicts} loading={bridgeLoading} />}
            {activeTab === 'appearance' && <AppearanceSettingsView localSettings={localSettings} handleChange={handleChange} />}
            {activeTab === 'data' && <DataSettingsView localSettings={localSettings} handleChange={handleChange} handleExport={handleExportSettings} handleImport={handleImportSettings} />}
            {activeTab === 'system' && <SystemSettingsView localSettings={localSettings} handleChange={handleChange} />}
          </div>
          <div className="sticky bottom-0 p-8 bg-gradient-to-t from-white via-white/95 to-transparent flex justify-between items-center backdrop-blur-md border-t border-slate-100/50">
            <div className="flex items-center gap-6">
              {hasUnsavedChanges && (
                <div className="flex items-center gap-2 text-amber-600 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-xs font-bold tracking-wide uppercase">待保存修改</span>
                </div>
              )}
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">V {backendSettings?.version || '1.0.0'}</div>
            </div>
            <div className="flex gap-4">
              <button onClick={handleClose} className="px-8 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all active:scale-95">取消</button>
              <button onClick={handleSave} disabled={!previewState.isValid || isManualSaving} className={`px-10 py-4 rounded-2xl font-black shadow-2xl transition-all flex items-center gap-3 transform active:scale-95 relative overflow-hidden ${previewState.isValid && !isManualSaving ? `bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 ${hasUnsavedChanges && isOpen ? 'ring-4 ring-indigo-500/20 ssp-animate-pulse-subtle' : ''}` : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                {isManualSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} strokeWidth={2.5} />}
                <span>保存全局配置</span>
                {hasUnsavedChanges && !isManualSaving && (
                  <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full pointer-events-none ${isOpen ? 'ssp-animate-shine' : ''}`} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// --- Sub-components ---

// A. 鐜颁唬鍖栨棩鍘嗛€夋嫨缁勪欢 (鐢ㄤ簬璁剧疆瀛︽湡绗竴澶?
const SemesterCalendarPicker = ({ value, onSelect }: { value: string, onSelect: (date: string) => void }) => {
  const [currentView, setCurrentView] = useState(() => {
    const parsed = value ? parseLocalDate(value) : null;
    return parsed ?? new Date();
  });

  useEffect(() => {
    if (!value) return;
    const parsed = parseLocalDate(value);
    if (parsed) {
      setCurrentView(parsed);
    }
  }, [value]);
  
  const daysInMonth = new Date(currentView.getFullYear(), currentView.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentView.getFullYear(), currentView.getMonth(), 1).getDay();
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

  const prevMonth = () => setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() - 1, 1));
  const nextMonth = () => setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() + 1, 1));

  const isSelected = (day: number) => {
    const d = new Date(currentView.getFullYear(), currentView.getMonth(), day);
    return formatLocalDate(d) === value;
  };

  return (
    <div className="bg-slate-50/50 rounded-[2rem] p-6 border border-slate-200/50">
      <div className="flex justify-between items-center mb-6">
        <div className="text-lg font-black text-slate-800">{currentView.getFullYear()}年 {monthNames[currentView.getMonth()]}</div>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronLeft size={16} /></button>
          <button onClick={nextMonth} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronRight size={16} /></button>
        </div>
      </div>
        <div className="grid grid-cols-7 gap-2">
          {['日', '一', '二', '三', '四', '五', '六'].map(d => (
          <div key={d} className="text-[10px] font-black text-slate-400 text-center py-2">{d}</div>
        ))}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const selected = isSelected(day);
          return (
            <button 
              key={day} 
              onClick={() => {
                const d = new Date(currentView.getFullYear(), currentView.getMonth(), day);
                onSelect(formatLocalDate(d));
              }}
              className={`aspect-square rounded-xl text-xs font-bold transition-all flex items-center justify-center
                ${selected ? 'bg-indigo-600 text-white shadow-lg scale-110' : 'hover:bg-white text-slate-600'}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// B. 自定义作息时间（按旧版本 UI 迁移）
const CustomTimeTableEditor = ({ localSettings, handleChange, handleBatchChange }: any) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogSlots, setDialogSlots] = useState<{ s: string; e: string }[]>([]);
  const [dialogError, setDialogError] = useState('');

  const sectionCount = Math.max(1, Number.parseInt(String(localSettings.sectionsPerDay || 1), 10));
  const sectionDuration = Math.max(1, Number.parseInt(String(localSettings.sectionDuration || 45), 10));
  const breakDuration = Math.max(0, Number.parseInt(String(localSettings.breakDuration || 10), 10));
  const defaultStart = Math.max(0, (Number(localSettings.startHour || 8) * 60) + Number(localSettings.startMinute || 0));

  const toMinutes = (value: string): number | null => {
    if (!value || typeof value !== 'string' || !value.includes(':')) return null;
    const [h, m] = value.split(':').map((part) => Number.parseInt(part, 10));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };

  const toTime = (totalMinutes: number): string => {
    const normalized = Math.max(0, totalMinutes);
    const h = Math.floor(normalized / 60) % 24;
    const m = normalized % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const buildDefaultSlots = (firstStartMinutes: number) => {
    let current = Math.max(0, firstStartMinutes);
    const slots: { s: string; e: string }[] = [];
    for (let i = 0; i < sectionCount; i++) {
      const end = current + sectionDuration;
      slots.push({ s: toTime(current), e: toTime(end) });
      current = end + breakDuration;
    }
    return slots;
  };

  const normalizeSlot = (slot: { s?: string; e?: string } | undefined) => {
    const start = toMinutes(slot?.s || '');
    const end = toMinutes(slot?.e || '');
    if (start === null || end === null || start >= end) return null;
    return { s: toTime(start), e: toTime(end) };
  };

  const buildSlotsFromSettings = () => {
    const source = Array.isArray(localSettings.sectionTimes) ? localSettings.sectionTimes : [];
    const fallback = buildDefaultSlots(defaultStart || 8 * 60);
    const result: { s: string; e: string }[] = [];

    for (let i = 0; i < sectionCount; i++) {
      const normalized = normalizeSlot(source[i]);
      if (normalized) {
        result.push(normalized);
        continue;
      }

      if (i === 0) {
        result.push(fallback[0]);
        continue;
      }

      const prevEnd = toMinutes(result[i - 1].e) ?? toMinutes(fallback[i - 1].e) ?? defaultStart;
      const start = prevEnd + breakDuration;
      const end = start + sectionDuration;
      result.push({ s: toTime(start), e: toTime(end) });
    }

    return result;
  };

  const patchActivePreset = (nextSlots: { s: string; e: string }[]) => {
    const presets: TimePreset[] = Array.isArray(localSettings.timePresets) ? localSettings.timePresets : [];
    if (!localSettings.activeTimePresetId || presets.length === 0) {
      return {};
    }
    const nextPresets = presets.map((preset) => (
      preset.id === localSettings.activeTimePresetId
        ? {
            ...preset,
            sectionsPerDay: localSettings.sectionsPerDay,
            sectionDuration: localSettings.sectionDuration,
            breakDuration: localSettings.breakDuration,
            sectionTimes: nextSlots.map((slot) => ({ ...slot })),
          }
        : preset
    ));
    return { timePresets: nextPresets };
  };

  const shiftSlot = (slot: { s: string; e: string }, delta: number) => {
    const start = toMinutes(slot.s);
    const end = toMinutes(slot.e);
    if (start === null || end === null) return slot;
    return { s: toTime(start + delta), e: toTime(end + delta) };
  };

  const rollFollowing = (slots: { s: string; e: string }[], fromIndex: number, delta: number) => {
    if (!delta) return slots;
    return slots.map((slot, idx) => (idx > fromIndex ? shiftSlot(slot, delta) : slot));
  };

  const openDialog = () => {
    setDialogSlots(buildSlotsFromSettings());
    setDialogError('');
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setDialogError('');
  };

  const handleTimeChange = (index: number, field: 's' | 'e', value: string) => {
    const parsedValue = toMinutes(value);
    if (parsedValue === null) {
      setDialogError('时间格式不正确');
      return;
    }

    const current = dialogSlots.map((slot) => ({ ...slot }));
    const row = current[index];
    const rowStart = toMinutes(row?.s || '');
    const rowEnd = toMinutes(row?.e || '');

    if (rowStart === null || rowEnd === null || rowStart >= rowEnd) {
      setDialogError('当前节次时间数据异常，请先重置后再编辑');
      return;
    }

    let next = current;

    if (field === 's') {
      const duration = Math.max(1, rowEnd - rowStart);
      const nextStart = parsedValue;
      const nextEnd = nextStart + duration;
      const delta = nextEnd - rowEnd;

      next[index] = { s: toTime(nextStart), e: toTime(nextEnd) };
      next = rollFollowing(next, index, delta);
    } else {
      if (parsedValue <= rowStart) {
        setDialogError(`第 ${index + 1} 节结束时间必须晚于开始时间`);
        return;
      }
      const delta = parsedValue - rowEnd;
      next[index] = { ...next[index], e: toTime(parsedValue) };
      next = rollFollowing(next, index, delta);
    }

    setDialogSlots(next);
    setDialogError('');
  };

  const handleResetDefault = () => {
    setDialogSlots(buildDefaultSlots(8 * 60));
    setDialogError('');
  };

  const applySlots = (nextSlots: { s: string; e: string }[]) => {
    const cloned = nextSlots.map((slot) => ({ ...slot }));
    const presetPatch = patchActivePreset(cloned);
    if (handleBatchChange) {
      handleBatchChange({
        sectionTimes: cloned,
        ...(presetPatch as Record<string, unknown>),
      });
    } else {
      handleChange('sectionTimes', cloned);
      if ((presetPatch as any).timePresets) {
        handleChange('timePresets', (presetPatch as any).timePresets);
      }
    }
  };

  const handleSaveDialog = () => {
    if (!dialogSlots.length) {
      setDialogError('暂无可保存的时间配置');
      return;
    }

    for (let i = 0; i < dialogSlots.length; i++) {
      const start = toMinutes(dialogSlots[i].s);
      const end = toMinutes(dialogSlots[i].e);
      if (start === null || end === null || start >= end) {
        setDialogError(`第 ${i + 1} 节时间无效，请调整后再保存`);
        return;
      }

      if (i > 0) {
        const prevEnd = toMinutes(dialogSlots[i - 1].e);
        if (prevEnd === null || start < prevEnd) {
          setDialogError(`第 ${i + 1} 节开始时间早于上一节结束时间，请调整`);
          return;
        }
      }
    }

    applySlots(dialogSlots);
    closeDialog();
  };

  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">详细作息时间表</label>
      <button
        type="button"
        onClick={openDialog}
        className="w-full bg-white/80 border-2 border-slate-100/60 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:bg-white transition-all flex items-center justify-center gap-2"
      >
        <Clock size={14} />
        编辑详细作息时间表...
      </button>
      <p className="text-[10px] text-slate-400 px-1">
        可直接修改任意一节的开始/结束时间，后续节次会自动顺延滚动。
      </p>

      {isDialogOpen && (
        <div className="fixed inset-0 z-[120] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-[1.75rem] border border-slate-200/80 shadow-2xl p-6">
            <h4 className="text-xl font-black text-slate-800">编辑作息时间</h4>
            <p className="text-xs text-slate-500 mt-1 font-medium">修改任意节次后，后续节次会自动滚动，避免时间错位。</p>

            <div className="mt-3 flex gap-2 text-[11px]">
              <span className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold">单节时长: {sectionDuration} 分钟</span>
              <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 font-bold">课间: {breakDuration} 分钟</span>
            </div>

            <div className="mt-5 border border-slate-200 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[72px_1fr_1fr] bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500">
                <div className="px-3 py-2 text-center">节次</div>
                <div className="px-3 py-2 text-center">开始时间</div>
                <div className="px-3 py-2 text-center">结束时间</div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {dialogSlots.map((slot, index) => (
                  <div key={`dialog-slot-${index}`} className="grid grid-cols-[72px_1fr_1fr] border-b border-slate-100 last:border-b-0 items-center">
                    <div className="px-3 py-2 text-center text-xs font-bold text-slate-600">第 {index + 1} 节</div>
                    <div className="px-3 py-2">
                      <input
                        type="time"
                        value={slot.s}
                        onChange={(e) => handleTimeChange(index, 's', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="px-3 py-2">
                      <input
                        type="time"
                        value={slot.e}
                        onChange={(e) => handleTimeChange(index, 'e', e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {dialogError && (
              <p className="mt-3 text-sm text-rose-600 font-bold">{dialogError}</p>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={handleResetDefault}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-all"
              >
                ↺ 恢复默认
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={closeDialog}
                className="px-5 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-all"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveDialog}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatusRow = ({ label, active, color }: { label: string; active: boolean; color: string }) => (
  <div className="flex items-center justify-between mb-3 last:mb-0 transition-all duration-300 hover:opacity-100 opacity-70">
    <span className="text-[10px] font-bold text-slate-500 tracking-tight">{label}</span>
    <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${active ? `${color} shadow-[0_0_8px_rgba(79,70,229,0.4)] scale-125 animate-pulse` : 'bg-slate-200'}`} />
  </div>
);

const NavButton = ({ active, onClick, icon, label, desc }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all duration-500 group relative ${active ? 'bg-white shadow-[0_15px_30px_-5px_rgba(79,70,229,0.12)] ring-1 ring-slate-200/50 scale-[1.03]' : 'hover:bg-white/60 hover:translate-x-2'}`}>
    <div className={`p-3 rounded-xl transition-all duration-500 transform ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 rotate-[-5deg]' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 group-hover:rotate-0'}`}>{icon}</div>
    <div className="flex-1">
      <div className={`text-sm font-black transition-colors duration-300 ${active ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-700'}`}>{label}</div>
      <div className="text-[10px] text-slate-400 font-bold leading-tight mt-0.5 uppercase tracking-tighter opacity-80">{desc}</div>
    </div>
    {active && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-indigo-600 rounded-full animate-in fade-in slide-in-from-left duration-500" />}
  </button>
);

const SectionHeader = ({ title, desc }: { title: string; desc: string }) => (
  <div className="animate-in slide-in-from-left-8 fade-in duration-700 mb-8">
    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{title}</h3>
    <div className="flex items-center gap-2 mt-2">
      <div className="w-12 h-1 bg-indigo-600 rounded-full ssp-animate-all-width duration-1000 ease-out" style={{ width: '48px' }} />
      <p className="text-slate-400 text-sm font-medium">{desc}</p>
    </div>
  </div>
);

const SettingCard = ({ label, icon, children }: any) => (
  <div className="bg-white/60 p-6 rounded-[2rem] border border-white/60 shadow-sm flex flex-col gap-4 group hover:bg-white/90 hover:shadow-xl hover:shadow-indigo-500/5 hover:translate-y-[-4px] transition-all duration-500 ease-out">
    <div className="flex items-center gap-2 px-1 transform transition-transform group-hover:translate-x-1">
      {icon && <div className="text-indigo-500 opacity-60 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110">{icon}</div>}
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">{label}</label>
    </div>
    <div className="transition-all duration-300">{children}</div>
  </div>
);

const ToggleItem = ({ label, desc, checked, onChange }: any) => (
  <div className="flex items-center justify-between p-6 hover:bg-indigo-50/30 transition-all duration-300 group rounded-2xl mx-2 my-1">
    <div className="space-y-1 transform transition-transform group-hover:translate-x-1">
      <div className="font-black text-slate-800 text-sm tracking-tight group-hover:text-indigo-600 transition-colors">{label}</div>
      <div className="text-[11px] text-slate-400 font-medium group-hover:text-slate-500 transition-colors">{desc}</div>
    </div>
    <button onClick={() => onChange(!checked)} className={`w-14 h-7 rounded-full p-1.5 transition-all duration-500 relative flex items-center shadow-inner ${checked ? 'bg-indigo-600' : 'bg-slate-200'}`}>
      <div className={`w-4 h-4 bg-white rounded-full shadow-lg transform transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${checked ? 'translate-x-7 scale-110' : 'translate-x-0'}`} />
    </button>
  </div>
);

// --- Views ---

const GeneralSettingsView = React.memo(({ localSettings, handleChange, handleBatchChange, weekConflicts, handleFixConflicts }: any) => (
  <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
    <SectionHeader title="基础设定" desc="学期周期与时间方案管理" />

    <div className="grid grid-cols-[1.3fr,1fr] gap-8">
      <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-700 delay-150">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2">
          <CalendarClock size={12} /> 第一周的第一天（学期起点）
        </label>
        <SemesterCalendarPicker
          value={localSettings.semesterStartDate}
          onSelect={(date: string) => {
            const parsedDate = parseLocalDate(date);
            if (!parsedDate) return;
            const days: WeekStartDay[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const weekStartDay = days[parsedDate.getDay()];
            if (handleBatchChange) {
              handleBatchChange({ semesterStartDate: date, weekStartDay });
            } else {
              handleChange('semesterStartDate', date);
              handleChange('weekStartDay', weekStartDay);
            }
          }}
        />
        <p className="text-[10px] text-slate-400 font-medium px-2 italic">
          提示：该日期即第 1 周第 1 天，之后每 7 天自动进入下一周。
        </p>
      </div>

      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-700 delay-300">
        <SettingCard label="学期总周数 (1-52)" icon={<Database size={14} />}>
          <input
            type="number"
            min="1"
            max="52"
            className="w-full bg-white/80 border-2 border-slate-100/50 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all hover:bg-white"
            value={localSettings.totalWeeks}
            onChange={(e) => handleChange('totalWeeks', parseInt(e.target.value || '1', 10))}
          />
        </SettingCard>
      </div>
    </div>

    <div className="bg-white/50 p-8 rounded-[2rem] border border-white/60 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-450 hover:shadow-xl hover:shadow-indigo-500/5 transition-all">
      <div className="flex justify-between items-end">
        <div>
          <h4 className="font-bold text-slate-800 text-lg">当前教学周</h4>
          <p className="text-slate-400 text-xs mt-1">设置当前所处的教学周数</p>
        </div>
        <span className={`text-4xl font-black text-indigo-600 ${localSettings.currentWeek > 0 ? 'ssp-animate-pulse-slow' : ''}`}>
          {localSettings.currentWeek}
        </span>
      </div>
      <input
        type="range"
        min="1"
        max={localSettings.totalWeeks}
        value={localSettings.currentWeek}
        onChange={(e) => handleChange('currentWeek', parseInt(e.target.value, 10))}
        className="w-full accent-indigo-600 h-2 bg-slate-100 rounded-full cursor-pointer hover:h-3 transition-all duration-300"
      />
    </div>

    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-600">
      <div className="grid grid-cols-3 gap-4">
        <SettingCard label="每日课程节数" icon={<Clock size={14} />}>
          <input
            type="number"
            min="1"
            max="20"
            className="w-full bg-white/80 border-2 border-slate-100/50 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
            value={localSettings.sectionsPerDay}
            onChange={(e) => handleChange('sectionsPerDay', parseInt(e.target.value || '1', 10))}
          />
        </SettingCard>
        <SettingCard label="单节时长 (min)" icon={<Clock size={14} />}>
          <input
            type="number"
            min="20"
            max="120"
            className="w-full bg-white/80 border-2 border-slate-100/50 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
            value={localSettings.sectionDuration}
            onChange={(e) => handleChange('sectionDuration', parseInt(e.target.value || '45', 10))}
          />
        </SettingCard>
        <SettingCard label="课间时长 (min)" icon={<Clock size={14} />}>
          <input
            type="number"
            min="0"
            max="60"
            className="w-full bg-white/80 border-2 border-slate-100/50 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
            value={localSettings.breakDuration}
            onChange={(e) => handleChange('breakDuration', parseInt(e.target.value || '10', 10))}
          />
        </SettingCard>
      </div>
      <p className="text-[10px] text-slate-400 font-medium px-2">
        提示：修改“节数/时长”会自动推算每节时间。
      </p>
      <CustomTimeTableEditor localSettings={localSettings} handleChange={handleChange} handleBatchChange={handleBatchChange} />
    </div>

    <div className="space-y-4">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">节假周设置（点击切换）</label>
      <div className="grid grid-cols-10 gap-2.5 p-2">
        {Array.from({ length: localSettings.totalWeeks }).map((_, i) => {
          const week = i + 1;
          const isHoliday = localSettings.holidays.includes(week);
          return (
            <button
              key={week}
              onClick={() => {
                const next = isHoliday
                  ? localSettings.holidays.filter((w: number) => w !== week)
                  : [...localSettings.holidays, week].sort((a, b) => a - b);
                handleChange('holidays', next);
              }}
              className={`aspect-square rounded-xl text-xs font-bold transition-all duration-300 ${isHoliday ? 'bg-red-500 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
            >
              {week}
            </button>
          );
        })}
      </div>
    </div>

    {weekConflicts?.length > 0 && (
      <div className="bg-amber-50/80 border border-amber-200/50 rounded-[2rem] p-8 space-y-5 animate-in zoom-in-95 duration-500">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h4 className="font-bold text-amber-900 text-lg">周数冲突</h4>
            <p className="text-sm text-amber-700/80">有课程超出了学期范围。</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => handleFixConflicts('truncate')} className="flex-1 py-3 bg-white text-amber-700 rounded-2xl text-sm font-bold border border-amber-200">
            自动截断
          </button>
          <button onClick={() => handleFixConflicts('remove')} className="flex-1 py-3 bg-red-500 text-white rounded-2xl text-sm font-bold">
            删除冲突
          </button>
        </div>
      </div>
    )}
  </div>
));
const AppearanceSettingsView = React.memo(({ localSettings, handleChange }: any) => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
    <SectionHeader title="界面外观" desc="视觉呈现与细节控制" />

    <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
      <SettingCard label="节次高度 (40-200px)">
        <input
          type="range"
          min="40"
          max="200"
          step="5"
          value={localSettings.slotHeight}
          onChange={(e) => handleChange('slotHeight', parseInt(e.target.value, 10))}
          className="w-full accent-indigo-600 h-2 bg-slate-100 rounded-full cursor-pointer hover:h-3 transition-all"
        />
        <span className="text-xs font-black text-indigo-600">{localSettings.slotHeight}px</span>
      </SettingCard>

      <SettingCard label="课程块透明度 (10%-100%)">
        <input
          type="range"
          min="0.1"
          max="1.0"
          step="0.05"
          value={localSettings.courseOpacity}
          onChange={(e) => handleChange('courseOpacity', parseFloat(e.target.value))}
          className="w-full accent-indigo-600 h-2 bg-slate-100 rounded-full cursor-pointer hover:h-3 transition-all"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs font-black text-indigo-600">{Math.round(localSettings.courseOpacity * 100)}%</span>
          <input
            type="number"
            min="10"
            max="100"
            step="1"
            value={Math.round(localSettings.courseOpacity * 100)}
            onChange={(e) => {
              const parsed = parseInt(e.target.value || '10', 10);
              const percent = Math.max(10, Math.min(100, Number.isFinite(parsed) ? parsed : 10));
              handleChange('courseOpacity', Number((percent / 100).toFixed(2)));
            }}
            className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
          />
        </div>
      </SettingCard>

      <SettingCard label="课程表透明度 (10%-100%)">
        <input
          type="range"
          min="0.1"
          max="1.0"
          step="0.05"
          value={localSettings.scheduleOpacity}
          onChange={(e) => handleChange('scheduleOpacity', parseFloat(e.target.value))}
          className="w-full accent-indigo-600 h-2 bg-slate-100 rounded-full cursor-pointer hover:h-3 transition-all"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs font-black text-indigo-600">{Math.round(localSettings.scheduleOpacity * 100)}%</span>
          <input
            type="number"
            min="10"
            max="100"
            step="1"
            value={Math.round(localSettings.scheduleOpacity * 100)}
            onChange={(e) => {
              const parsed = parseInt(e.target.value || '10', 10);
              const percent = Math.max(10, Math.min(100, Number.isFinite(parsed) ? parsed : 10));
              handleChange('scheduleOpacity', Number((percent / 100).toFixed(2)));
            }}
            className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
          />
        </div>
      </SettingCard>
    </div>

    <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
      <SettingCard label="字体显示大小">
        <div className="flex bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/30">
          {[
            { id: 'small', label: '紧凑', icon: 'A', size: 'text-xs' },
            { id: 'medium', label: '标准', icon: 'A', size: 'text-base' },
            { id: 'large', label: '宽松', icon: 'A', size: 'text-xl' }
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleChange('fontSize', opt.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition-all duration-500
                ${localSettings.fontSize === opt.id
                  ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5 scale-105 z-10'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'}`}
            >
              <span className={`font-black mb-1 ${opt.size}`}>{opt.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-tighter">{opt.label}</span>
            </button>
          ))}
        </div>
      </SettingCard>

      <SettingCard label="冲突处理模式">
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/20">
          <button
            onClick={() => handleChange('conflictMode', 'overlap')}
            className={`flex-1 py-3 text-xs font-black rounded-xl transition-all duration-300 ${localSettings.conflictMode === 'overlap' ? 'bg-white shadow-md text-indigo-600 scale-105' : 'text-slate-500 hover:bg-white/40'}`}
          >
            重叠
          </button>
          <button
            onClick={() => handleChange('conflictMode', 'stack')}
            className={`flex-1 py-3 text-xs font-black rounded-xl transition-all duration-300 ${localSettings.conflictMode === 'stack' ? 'bg-white shadow-md text-indigo-600 scale-105' : 'text-slate-500 hover:bg-white/40'}`}
          >
            堆叠
          </button>
        </div>
      </SettingCard>
    </div>

    <div className="bg-white/50 rounded-[2rem] border border-white/60 overflow-hidden shadow-sm divide-y divide-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-450">
      <ToggleItem label="显示周末" desc="在主视图中显示周六、日" checked={localSettings.showWeekend} onChange={(v: boolean) => handleChange('showWeekend', v)} />
      <ToggleItem label="显示网格线" desc="在背景中显示时间分割线" checked={localSettings.showGridLines} onChange={(v: boolean) => handleChange('showGridLines', v)} />
      <ToggleItem label="显示非本周课程" desc="非本周课程将以更淡的透明度显示，作为参考" checked={localSettings.showNonCurrentWeekCourses} onChange={(v: boolean) => handleChange('showNonCurrentWeekCourses', v)} />
      <ToggleItem label="课程块白色边框" desc="为课程卡片增加高光描边，提升视觉层次感" checked={localSettings.showCourseWhiteBorder} onChange={(v: boolean) => handleChange('showCourseWhiteBorder', v)} />
      <ToggleItem label="时间指示器" desc="显示指示当前时刻的运动红线" checked={localSettings.showTimeIndicator} onChange={(v: boolean) => handleChange('showTimeIndicator', v)} />
      <ToggleItem label="高亮今天" desc="为当前日期背景应用柔和高亮色" checked={localSettings.highlightToday} onChange={(v: boolean) => handleChange('highlightToday', v)} />
      <ToggleItem label="显示授课老师" desc="在课程卡片底部显示老师信息" checked={localSettings.showTeacher} onChange={(v: boolean) => handleChange('showTeacher', v)} />
      <ToggleItem label="显示上课地点" desc="在课程卡片底部显示地点信息" checked={localSettings.showLocation} onChange={(v: boolean) => handleChange('showLocation', v)} />
      <ToggleItem label="启用系统通知" desc="课程开始前发送精准桌面提醒" checked={localSettings.enableNotifications} onChange={(v: boolean) => handleChange('enableNotifications', v)} />
    </div>
  </div>
));
const DataSettingsView = React.memo(({ localSettings, handleChange, handleExport, handleImport }: any) => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
    <SectionHeader title="数据管理" desc="备份、导出与保存安全" />

    <div className="bg-white/50 rounded-[2rem] border border-white/60 overflow-hidden shadow-sm divide-y divide-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
      <ToggleItem label="自动保存" desc="每一项修改都会自动同步" checked={localSettings.autoSave} onChange={(v: boolean) => handleChange('autoSave', v)} />
      <ToggleItem label="自动备份" desc="启用定期本地数据备份" checked={localSettings.enableAutoBackup} onChange={(v: boolean) => handleChange('enableAutoBackup', v)} />
    </div>

    {localSettings.enableAutoBackup && (
      <div className="grid grid-cols-2 gap-6 animate-in zoom-in-95 duration-500 delay-300">
        <SettingCard label="备份频率">
          <select
            className="w-full bg-white border-2 border-slate-100/50 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all hover:bg-slate-50"
            value={localSettings.backupFreq}
            onChange={(e) => handleChange('backupFreq', e.target.value)}
          >
            <option value="daily">每日 (最安全)</option>
            <option value="weekly">每周</option>
            <option value="manual">仅手动</option>
          </select>
        </SettingCard>
        <SettingCard label="备份保留天数 (1-365)">
          <input
            type="number"
            min="1"
            max="365"
            className="w-full bg-white border-2 border-slate-100/50 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all hover:bg-slate-50"
            value={localSettings.backupRetentionDays}
            onChange={(e) => handleChange('backupRetentionDays', parseInt(e.target.value || '30', 10))}
          />
        </SettingCard>
      </div>
    )}

    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2.5rem] p-10 text-white shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 delay-450 group">
      <div className="relative z-10 transform transition-transform group-hover:scale-[1.01]">
        <h4 className="text-2xl font-black mb-6 flex items-center gap-3">
          <Database className="ssp-animate-bounce-slow" /> 数据管理核心
        </h4>
        <div className="flex gap-4">
          <button onClick={handleExport} className="flex-1 py-4 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-2xl font-black transition-all flex items-center justify-center gap-2 border border-white/10 active:scale-95">
            <Download size={18} />导出完整配置
          </button>
          <label className="flex-1 py-4 bg-white text-indigo-600 hover:bg-indigo-50 rounded-2xl font-black transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-lg shadow-indigo-900/20">
            <Upload size={18} />导入外部备份
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>
      <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full ssp-animate-shine pointer-events-none" />
    </div>
  </div>
));
const SystemSettingsView = React.memo(({ localSettings, handleChange }: any) => (
  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
    <SectionHeader title="系统高级" desc="性能优化与开发者选项" />

    <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
      <SettingCard label="时间显示格式">
        <div className="flex bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/20">
          <button
            onClick={() => handleChange('use24HourFormat', false)}
            className={`flex-1 py-3 text-xs font-black rounded-xl transition-all duration-300 ${!localSettings.use24HourFormat ? 'bg-white shadow-md text-indigo-600 scale-105' : 'text-slate-500 hover:bg-white/40'}`}
          >
            12小时制
          </button>
          <button
            onClick={() => handleChange('use24HourFormat', true)}
            className={`flex-1 py-3 text-xs font-black rounded-xl transition-all duration-300 ${localSettings.use24HourFormat ? 'bg-white shadow-md text-indigo-600 scale-105' : 'text-slate-500 hover:bg-white/40'}`}
          >
            24小时制
          </button>
        </div>
      </SettingCard>

      <SettingCard label="系统日志详细程度">
        <select
          className="w-full bg-white border-2 border-slate-100/50 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all hover:bg-slate-50"
          value={localSettings.logLevel}
          onChange={(e) => handleChange('logLevel', e.target.value)}
        >
          <option value="error">仅错误 (推荐)</option>
          <option value="warn">警告与错误</option>
          <option value="info">常规信息</option>
          <option value="debug">完整调试</option>
        </select>
      </SettingCard>
    </div>

    <div className="bg-white/50 rounded-[2rem] border border-white/60 overflow-hidden shadow-sm divide-y divide-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
      <ToggleItem label="开发者调试模式" desc="在控制台输出详细运行轨迹与性能数据" checked={localSettings.enableDebugMode} onChange={(v: boolean) => handleChange('enableDebugMode', v)} />
      <ToggleItem label="高刷流畅动画" desc="启用 60FPS+ 的物理拟真过渡效果" checked={localSettings.enableAnimations} onChange={(v: boolean) => handleChange('enableAnimations', v)} />
      <ToggleItem label="静默自动同步" desc="每一项修改都会立即自动同步到多端设备" checked={localSettings.autoSave} onChange={(v: boolean) => handleChange('autoSave', v)} />
    </div>
  </div>
));





