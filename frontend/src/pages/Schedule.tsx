import AppLayout from "../components/AppLayout";
import { Button } from "../components/ui/button";
import { 
  ChevronLeft, ChevronRight, Settings, PlusCircle, 
  Download, FileDown, FileSpreadsheet, Globe, Code,
  FilePlus, Trash2, MapPin, User
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "../components/ui/dropdown-menu";
import { CourseManagerPanel } from "../components/CourseManagerPanel";
import { ScheduleSettingsPanel, ScheduleSettings, DEFAULT_SETTINGS } from "../components/ScheduleSettingsPanel";
import ImportSchedulerModal from "../components/ImportSchedulerModal";
import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
// 1. 寮曞叆缁熶竴鐨?Bridge Hook锛岃€屼笉鏄師濮嬬殑 usePython
import { useScheduleBridge } from "../hooks/useScheduleBridge";
import { useSettingsBridge } from "../hooks/useSettingsBridge";
import { Course } from "../types/Course";
import { CourseWithGroup, CourseGroup } from "../utils/courseGrouping";
import { type WeekStartDay } from "../utils/weekUtils";

// 2. 甯冨眬甯搁噺瀹氫箟 (鏀逛负鍔ㄦ€侊紝鐢?settings 鎺у埗)
const HEADER_HEIGHT = 50;

const WEEKDAY_SHORT = ['日', '一', '二', '三', '四', '五', '六'];
const DAY_MS = 24 * 60 * 60 * 1000;

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

const clampWeek = (week: number, totalWeeks?: number): number => {
  const normalizedWeek = Number.isFinite(week) ? Math.max(1, Math.trunc(week)) : 1;
  if (Number.isFinite(totalWeeks) && Number(totalWeeks) > 0) {
    return Math.min(normalizedWeek, Math.trunc(Number(totalWeeks)));
  }
  return normalizedWeek;
};

// 棰滆婚櫎 mapping for dark/midnight themes
const getColorClasses = (color: string) => {
  const colorMap: { [key: string]: string } = {
    '#8B5CF6': 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-200/30 midnight:border-emerald-500/20',
    '#EC4899': 'bg-pink-500/20 text-pink-600 dark:text-pink-300 border-pink-200/30 midnight:border-emerald-500/20',
    '#3B82F6': 'bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-200/30 midnight:border-emerald-500/20',
    '#10B981': 'bg-green-500/20 text-green-600 dark:text-green-300 border-green-200/30 midnight:border-emerald-500/20',
    '#F59E0B': 'bg-orange-500/20 text-orange-600 dark:text-orange-300 border-orange-200/30 midnight:border-emerald-500/20',
    '#6366F1': 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-indigo-200/30 midnight:border-emerald-500/20',
    '#EF4444': 'bg-red-500/20 text-red-600 dark:text-red-300 border-red-200/30 midnight:border-emerald-500/20',
    '#14B8A6': 'bg-teal-500/20 text-teal-600 dark:text-teal-300 border-teal-200/30 midnight:border-emerald-500/20',
  };
  return colorMap[color] || 'bg-gray-500/20 text-gray-600 dark:text-gray-300 border-gray-200/30';
};


const Schedule = () => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [settings, setSettings] = useState<ScheduleSettings>(DEFAULT_SETTINGS);
  const [forceUpdateKey, setForceUpdateKey] = useState(0); // 娣诲姞寮哄埗鏇存柊閿?
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // 鍒犻櫎纭鐘舵€?
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [courseIdToDelete, setCourseIdToDelete] = useState<string | null>(null);
  
  // 3. 浣跨敤鏍稿績 Hook 绠＄悊鏁版嵁
  const { 
    courses, 
    courseGroups, 
    loading, 
    loadingProgress,
    refresh, 
    saveCourse, 
    removeCourse, 
    currentWeek, 
    setCurrentWeek,
    getCurrentWeek,
    bridge
  } = useScheduleBridge();

  const { settings: backendSettings } = useSettingsBridge();

  // 褰撳悗绔缃姞杞藉畬鎴愭椂锛屽悓姝ュ埌鏈湴璁剧疆
  useEffect(() => {
    if (backendSettings) {
      const backendWeek = Number(backendSettings.current_week || 1);
      const maxWeek = Number(backendSettings.semester_weeks || 1);
      const normalizedBackendWeek = clampWeek(backendWeek, maxWeek);
      const parsedSemesterStartDate = parseLocalDate(String(backendSettings.start_date || ''));
      const derivedWeekStartDay = parsedSemesterStartDate
        ? (['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][parsedSemesterStartDate.getDay()] as WeekStartDay)
        : ((backendSettings.week_start_day as WeekStartDay) || 'monday');
      const backendTimePresets = Array.isArray((backendSettings as any).time_presets) && (backendSettings as any).time_presets.length > 0
        ? (backendSettings as any).time_presets.map((preset: any) => ({
            ...preset,
            sectionTimes: Array.isArray(preset?.sectionTimes)
              ? preset.sectionTimes.map((slot: any) => ({ ...slot }))
              : []
          }))
        : DEFAULT_SETTINGS.timePresets;
      const backendActiveTimePresetId = String(
        (backendSettings as any).active_time_preset_id || backendTimePresets[0]?.id || DEFAULT_SETTINGS.activeTimePresetId
      );
      const backendSectionTimes = Array.isArray(backendSettings.section_times) && backendSettings.section_times.length > 0
        ? backendSettings.section_times.map((slot: any) => ({ ...slot }))
        : ((backendTimePresets.find((preset: any) => preset.id === backendActiveTimePresetId)?.sectionTimes || DEFAULT_SETTINGS.sectionTimes)
            .map((slot: any) => ({ ...slot })));

      setSettings({
        ...DEFAULT_SETTINGS,
        totalWeeks: backendSettings.semester_weeks ?? DEFAULT_SETTINGS.totalWeeks,
        currentWeek: normalizedBackendWeek,
        semesterStartDate: backendSettings.start_date || DEFAULT_SETTINGS.semesterStartDate,
        weekStartDay: derivedWeekStartDay,
        holidays: backendSettings.holidays ?? DEFAULT_SETTINGS.holidays,
        showWeekend: backendSettings.show_weekends ?? DEFAULT_SETTINGS.showWeekend,
        slotHeight: backendSettings.time_slot_height ?? DEFAULT_SETTINGS.slotHeight,
        enableAnimations: backendSettings.ui_animations ?? DEFAULT_SETTINGS.enableAnimations,
        startHour: backendSettings.start_hour ?? DEFAULT_SETTINGS.startHour,
        startMinute: backendSettings.start_minute ?? DEFAULT_SETTINGS.startMinute,
        endHour: backendSettings.end_hour ?? DEFAULT_SETTINGS.endHour,
        use24HourFormat: backendSettings.use24_hour_format ?? true,
        sectionDuration: backendSettings.section_duration ?? DEFAULT_SETTINGS.sectionDuration,
        breakDuration: backendSettings.break_duration ?? DEFAULT_SETTINGS.breakDuration,
        sectionsPerDay: backendSettings.sections_per_day ?? DEFAULT_SETTINGS.sectionsPerDay,
        sectionTimes: backendSectionTimes,
        timePresets: backendTimePresets,
        activeTimePresetId: backendActiveTimePresetId,
        courseOpacity: backendSettings.course_opacity ?? DEFAULT_SETTINGS.courseOpacity,
        scheduleOpacity: (backendSettings as any).schedule_opacity ?? DEFAULT_SETTINGS.scheduleOpacity,
        showNonCurrentWeekCourses: (backendSettings as any).show_non_current_week_courses ?? DEFAULT_SETTINGS.showNonCurrentWeekCourses,
        showCourseWhiteBorder: (backendSettings as any).show_course_white_border ?? DEFAULT_SETTINGS.showCourseWhiteBorder,
        showGridLines: backendSettings.show_grid_lines ?? true,
        showTimeIndicator: backendSettings.show_time_indicator ?? true,
        highlightToday: backendSettings.highlight_today ?? true,
        showTeacher: backendSettings.show_teacher ?? true,
        showLocation: backendSettings.show_location ?? true,
        fontSize: (backendSettings.font_size as any) ?? DEFAULT_SETTINGS.fontSize,
        conflictMode: (backendSettings.conflict_mode as any) ?? DEFAULT_SETTINGS.conflictMode,
        autoSave: backendSettings.auto_save ?? DEFAULT_SETTINGS.autoSave,
        autoColorImport: backendSettings.auto_color_import ?? DEFAULT_SETTINGS.autoColorImport,
        enableCourseGrouping: backendSettings.enable_course_grouping ?? DEFAULT_SETTINGS.enableCourseGrouping,
        enableNotifications: backendSettings.enable_notifications ?? DEFAULT_SETTINGS.enableNotifications,
        midnightMode: backendSettings.midnight_mode ?? false,
        enableAutoBackup: backendSettings.enable_auto_backup ?? DEFAULT_SETTINGS.enableAutoBackup,
        backupFreq: (backendSettings.backup_freq as any) ?? DEFAULT_SETTINGS.backupFreq,
        backupRetentionDays: backendSettings.backup_retention_days ?? DEFAULT_SETTINGS.backupRetentionDays,
        enableDebugMode: backendSettings.enable_debug_mode ?? DEFAULT_SETTINGS.enableDebugMode,
        logLevel: (backendSettings.log_level as any) ?? DEFAULT_SETTINGS.logLevel
      });

      setCurrentWeek(normalizedBackendWeek);
    }
  }, [backendSettings, setCurrentWeek]);

  // 鏇存柊褰撳墠鏃堕棿 (鐢ㄤ簬鏃堕棿鎸囩ず鍣?
  useEffect(() => {
    if (settings.showTimeIndicator) {
      const timer = setInterval(() => setCurrentTime(new Date()), 60000);
      return () => clearInterval(timer);
    }
  }, [settings.showTimeIndicator]);

  // 应用深邃模式（由 useRealtimeSettings 统一处理，这里移除重复逻辑）
  // useEffect(() => {
  //   if (settings.midnightMode) {
  //     document.documentElement.classList.add('dark');
  //   } else {
  //     document.documentElement.classList.remove('dark');
  //   }
  // }, [settings.midnightMode]);

  const maxWeeks = settings.totalWeeks;
  const SLOT_HEIGHT = settings.slotHeight;
  const scheduleSurfaceOpacityRaw = Number(settings.scheduleOpacity ?? DEFAULT_SETTINGS.scheduleOpacity);
  const scheduleSurfaceOpacity = Number.isFinite(scheduleSurfaceOpacityRaw)
    ? Math.max(0.1, Math.min(1, scheduleSurfaceOpacityRaw))
    : DEFAULT_SETTINGS.scheduleOpacity;

  const currentWeekStartDate = useMemo(() => {
    if (!settings.semesterStartDate) return null;
    const semesterStart = parseLocalDate(settings.semesterStartDate);
    if (!semesterStart) return null;
    semesterStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(semesterStart);
    weekStart.setDate(semesterStart.getDate() + (currentWeek - 1) * 7);
    return weekStart;
  }, [settings.semesterStartDate, currentWeek]);

  const fullWeekDays = useMemo(() => {
    if (!currentWeekStartDate) return [];
    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(currentWeekStartDate);
      date.setDate(currentWeekStartDate.getDate() + index);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
        date,
        weekdayText: WEEKDAY_SHORT[date.getDay()],
        dayNumber: date.getDate(),
        monthNumber: date.getMonth() + 1,
      };
    });
  }, [currentWeekStartDate]);

  const visibleWeekDays = useMemo(() => {
    if (!settings.showWeekend) {
      return fullWeekDays.filter((day) => day.date.getDay() !== 0 && day.date.getDay() !== 6);
    }
    return fullWeekDays;
  }, [fullWeekDays, settings.showWeekend]);

  const headerMonthLabel = useMemo(() => {
    if (visibleWeekDays.length === 0) return '';
    const months = Array.from(new Set(visibleWeekDays.map((item) => item.monthNumber)));
    if (months.length === 1) return `${months[0]}月`;
    return `${months[0]}-${months[months.length - 1]}月`;
  }, [visibleWeekDays]);

  const displayDays = useMemo(() => {
    if (visibleWeekDays.length > 0) return visibleWeekDays.length;
    return settings.showWeekend ? 7 : 5;
  }, [visibleWeekDays, settings.showWeekend]);

  const COL_WIDTH_PERCENT = useMemo(() => {
    return 100 / (displayDays + 1); // 1鍒楃敤浜庢椂闂磋酱
  }, [displayDays]);

  const visibleJsDayOrder = useMemo(
    () => visibleWeekDays.map((day) => day.date.getDay()),
    [visibleWeekDays]
  );

  const courseDayToColumnIndex = useCallback((courseDay: number) => {
    const parsedCourseDay = Number(courseDay);
    if (!Number.isFinite(parsedCourseDay)) return null;

    let courseJsDay: number;
    if (parsedCourseDay === 0 || parsedCourseDay === 7) {
      courseJsDay = 0;
    } else if (parsedCourseDay >= 1 && parsedCourseDay <= 6) {
      courseJsDay = parsedCourseDay;
    } else {
      return null;
    }

    const index = visibleJsDayOrder.indexOf(courseJsDay);
    return index >= 0 ? index : null;
  }, [visibleJsDayOrder]);

  const isSameDate = useCallback((a: Date, b: Date) => {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }, []);

  // 璁＄畻鏃堕棿杞存爣绛?
  const timeSlots = useMemo(() => {
    const slots = [];
    const useManualTimes = settings.sectionTimes && settings.sectionTimes.length > 0;

    for (let i = 0; i < settings.sectionsPerDay; i++) {
        let startTimeStr = "";
        let endTimeStr = "";

        if (useManualTimes && settings.sectionTimes[i]) {
            startTimeStr = settings.sectionTimes[i].s;
            endTimeStr = settings.sectionTimes[i].e;
        } else {
            // 鍥為€€鍒拌嚜鍔ㄨ绠楅€昏緫
            let currentTotalMinutes = settings.startHour * 60 + settings.startMinute + i * (settings.sectionDuration + settings.breakDuration);
            const startH = Math.floor(currentTotalMinutes / 60);
            const startM = currentTotalMinutes % 60;
            const endTotalMinutes = currentTotalMinutes + settings.sectionDuration;
            const endH = Math.floor(endTotalMinutes / 60);
            const endM = endTotalMinutes % 60;
            startTimeStr = `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;
            endTimeStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
        }

        const formatDisplayTime = (timeStr: string) => {
            if (!timeStr) return "";
            const [h, m] = timeStr.split(':').map(Number);
            const displayH = settings.use24HourFormat ? h : (h > 12 ? h - 12 : (h === 0 ? 12 : h));
            const suffix = settings.use24HourFormat ? '' : (h >= 12 ? ' PM' : ' AM');
            return `${displayH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}${suffix}`;
        };

        const formattedStart = formatDisplayTime(startTimeStr);
        const formattedEnd = formatDisplayTime(endTimeStr);
        
        slots.push({ 
            id: i + 1, 
            time: formattedStart,
            endTime: formattedEnd,
            range: `${formattedStart}-${formattedEnd}`,
            rawStart: startTimeStr
        });
    }
    return slots;
  }, [settings.sectionTimes, settings.sectionsPerDay, settings.startHour, settings.startMinute, settings.sectionDuration, settings.breakDuration, settings.use24HourFormat]);

  // 璁＄畻褰撳墠鏃堕棿鎸囩ず鍣ㄤ綅缃?(蹇呴』鍦?timeSlots 鍜?SLOT_HEIGHT 涔嬪悗)
  const timeIndicatorPos = useMemo(() => {
    if (!settings.showTimeIndicator || !settings.highlightToday || !currentWeekStartDate) {
      return null;
    }

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const dayIndex = visibleWeekDays.findIndex((dayInfo) => isSameDate(dayInfo.date, today));
    if (dayIndex < 0) {
      return null;
    }

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;
    

    // 鏌ユ壘褰撳墠鏃堕棿鎵€鍦ㄧ殑鑺傛鎴栨渶杩戠殑鑺傛
    let sectionIndex = -1;
    let sectionStartMinutes = 0;
    let sectionEndMinutes = 0;

    // 棣栧厛灏濊瘯鎵惧埌褰撳墠鏃堕棿鎵€鍦ㄧ殑鑺傛
    for (let i = 0; i < timeSlots.length; i++) {
      const slot = timeSlots[i];
      const [startH, startM] = slot.rawStart.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = startMinutes + settings.sectionDuration;

      if (currentTotalMinutes >= startMinutes && currentTotalMinutes <= endMinutes) {
        sectionIndex = i;
        sectionStartMinutes = startMinutes;
        sectionEndMinutes = endMinutes;
        break;
      }
    }

    // 濡傛灉涓嶅湪浠讳綍鑺傛鍐咃紝妫€鏌ユ槸鍚﹀湪璇鹃棿鎴栦笂璇炬椂闂磋寖鍥村唴
    if (sectionIndex === -1) {
      // 妫€鏌ユ槸鍚﹀湪绗竴鑺傝涔嬪墠鎴栨渶鍚庝竴鑺傝涔嬪悗
      const firstSlot = timeSlots[0];
      const lastSlot = timeSlots[timeSlots.length - 1];
      
      if (firstSlot && lastSlot) {
        const [firstH, firstM] = firstSlot.rawStart.split(':').map(Number);
        const firstStartMinutes = firstH * 60 + firstM;
        
        const [lastH, lastM] = lastSlot.rawStart.split(':').map(Number);
        const lastEndMinutes = lastH * 60 + lastM + settings.sectionDuration;
        
        if (currentTotalMinutes < firstStartMinutes) {
          return null;
        }
        
        if (currentTotalMinutes > lastEndMinutes) {
          return null;
        }
        
        // 鍦ㄨ闂存椂闂达紝鎵惧埌鏈€杩戠殑涓嬩竴鑺傝
        for (let i = 0; i < timeSlots.length - 1; i++) {
          const slot = timeSlots[i];
          const nextSlot = timeSlots[i + 1];
          
          const [startH, startM] = slot.rawStart.split(':').map(Number);
          const endMinutes = startH * 60 + startM + settings.sectionDuration;
          
          const [nextH, nextM] = nextSlot.rawStart.split(':').map(Number);
          const nextStartMinutes = nextH * 60 + nextM;
          
          // 濡傛灉鍦ㄨ闂?
          if (currentTotalMinutes > endMinutes && currentTotalMinutes < nextStartMinutes) {
            // 鏄剧ず鍦ㄤ笅涓€鑺傝鐨勫紑濮嬩綅缃?
            sectionIndex = i + 1;
            sectionStartMinutes = nextStartMinutes;
            sectionEndMinutes = nextStartMinutes;
            break;
          }
        }
      }
    }

    // 濡傛灉杩樻槸娌℃壘鍒帮紝涓嶆樉绀?
    if (sectionIndex === -1) {
      return null;
    }

    // 璁＄畻鍦ㄨ鑺傛鍐呯殑鐩稿浣嶇疆
    let topPx;
    if (sectionStartMinutes === sectionEndMinutes) {
      // 璇鹃棿鏃堕棿锛屾樉绀哄湪鑺傛寮€濮嬩綅缃?
      topPx = sectionIndex * SLOT_HEIGHT;
    } else {
      // 涓婅鏃堕棿锛岃绠楃簿纭綅缃?
      const progressInSection = (currentTotalMinutes - sectionStartMinutes) / (sectionEndMinutes - sectionStartMinutes);
      topPx = sectionIndex * SLOT_HEIGHT + progressInSection * SLOT_HEIGHT;
    }


    return {
      dayIndex,
      top: topPx
    };
  }, [currentTime, currentWeekStartDate, isSameDate, settings.showTimeIndicator, settings.highlightToday, settings.sectionDuration, timeSlots, SLOT_HEIGHT, visibleWeekDays]);

  // 鍒濆鍖栧姞杞?- 杩涘叆椤甸潰鏃跺己鍒跺埛鏂颁竴娆?
  useEffect(() => {
    const initializeData = async () => {
      
      // 馃殌 杩涘叆 /schedule 鏃舵案杩滄媺涓€娆℃渶鏂版暟鎹紝闃叉鍒囨崲鍥炴潵绌虹櫧
      refresh(false);
      
      // 馃殌 鑾峰彇褰撳墠鍛ㄦ暟
      try {
        await getCurrentWeek();
      } catch (error) {
      }
      
    };
    
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 绉婚櫎鎵€鏈変緷璧栵紝鍙湪缁勪欢鎸傝浇鏃舵墽琛屼竴娆?
  // 鐩戝惉鏂囦欢瀵煎叆瀹屾垚浜嬩欢锛岃嚜鍔ㄥ叧闂鍏ラ潰鏉?
  useEffect(() => {
    const handleFileImportComplete = (e: CustomEvent) => {
      const detail = e.detail || {};
      const action = detail.action;
      
      // 褰撴敹鍒?refresh_request 涓斿鍏ラ潰鏉挎槸鎵撳紑鐘舵€佹椂锛岃嚜鍔ㄥ叧闂?
      if (action === 'refresh_request' && isImportModalOpen) {
        setTimeout(() => {
          setIsImportModalOpen(false);
        }, 1500); // 寤惰繜1.5绉掑叧闂紝璁╃敤鎴风湅鍒版垚鍔熸彁绀?
      }
    };
    
    window.addEventListener('scheduleDataUpdated', handleFileImportComplete as EventListener);
    
    return () => {
      window.removeEventListener('scheduleDataUpdated', handleFileImportComplete as EventListener);
    };
  }, [isImportModalOpen]);

  // 4. 绠€鍖栨暟鎹祦锛岀Щ闄や笉蹇呰鐨勮浆鎹㈠眰
  const uiCourses: CourseWithGroup[] = useMemo(() => {
    return courses.map(c => ({
      ...c,
      groupId: (c as any).groupId
    }));
  }, [courses]);

  // 鑾峰彇褰撳墠鍛ㄧ殑璇剧▼ - 鎬ц兘浼樺寲鐗堟湰
  const weekCourses = useMemo(() => {
    const filtered = uiCourses.filter(course => {
      const targetWeeks = Array.isArray(course.weeks) ? course.weeks : [];
      return targetWeeks.length > 0 && targetWeeks.includes(currentWeek);
    });
    
    return filtered;
  }, [uiCourses, currentWeek]);

  const coursesToRender = useMemo(
    () =>
      uiCourses
        .filter((course) => {
          const targetWeeks = Array.isArray(course.weeks) ? course.weeks : [];
          if (targetWeeks.length === 0) return false;
          if (targetWeeks.includes(currentWeek)) return true;
          return settings.showNonCurrentWeekCourses;
        })
        .map((course) => {
          const targetWeeks = Array.isArray(course.weeks) ? course.weeks : [];
          return {
            ...course,
            isCurrentWeek: targetWeeks.includes(currentWeek),
          };
        })
        .sort((a, b) => Number(b.isCurrentWeek) - Number(a.isCurrentWeek)),
    [uiCourses, currentWeek, settings.showNonCurrentWeekCourses]
  );

  // --- 鏂板锛氭棩鏈熶笌寮€瀛﹁繘搴﹁绠?---
  const semesterInfo = useMemo(() => {
    if (!settings.semesterStartDate) return null;

    try {
      const startDate = parseLocalDate(settings.semesterStartDate);
      if (!startDate) return null;

      // 1. 计算当前查看周的具体日期范围（严格按学期起点每7天一周）
      startDate.setHours(0, 0, 0, 0);
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() + (currentWeek - 1) * 7);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
      const dateRangeStr = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;

      // 2. 璁＄畻璺濈寮€瀛︾殑鍛ㄦ暟锛堥拡瀵逛粖澶╋級
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startCompare = new Date(startDate);
      startCompare.setHours(0, 0, 0, 0);

      let countdownStr = "";
      if (today < startCompare) {
        const diffTime = startCompare.getTime() - today.getTime();
        const diffWeeks = Math.ceil(diffTime / (7 * 24 * 60 * 60 * 1000));
        countdownStr = `距离开学还有 ${diffWeeks} 周`;
      }

      return {
        dateRangeStr,
        countdownStr,
        isBeforeSemester: today < startCompare
      };
    } catch (e) {
      return null;
    }
  }, [settings.semesterStartDate, currentWeek]);

  // 澶勭悊淇濆瓨
  const handleSaveCourse = async (courseData: Course) => {
    try {
      await saveCourse(courseData);
      setIsPanelOpen(false);
      setEditingCourse(null);
      // 鉁?涓嶉渶瑕佸埛鏂帮紝saveCourse宸茬粡鏇存柊浜哢I
    } catch (error) {
      console.error("保存失败", error);
    }
  };

  // 澶勭悊鍒犻櫎
  const handleDeleteCourse = (courseId: string) => {
    setCourseIdToDelete(courseId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (courseIdToDelete) {
      try {
        await removeCourse(courseIdToDelete);
        setIsPanelOpen(false);
        setEditingCourse(null);
        setIsDeleteDialogOpen(false);
        setCourseIdToDelete(null);
      } catch (error) {
        console.error("删除失败", error);
      }
    }
  };

  const applyScheduleSettings = useCallback((nextSettings: ScheduleSettings) => {
    const normalizedWeek = clampWeek(nextSettings.currentWeek, nextSettings.totalWeeks);
    setSettings({
      ...nextSettings,
      currentWeek: normalizedWeek,
    });
    setCurrentWeek(normalizedWeek);
  }, [setCurrentWeek]);

  // 娓叉煋鍗曚釜璇剧▼鍗＄墖
  const renderCourseCard = (course: CourseWithGroup & { isCurrentWeek?: boolean }, style: React.CSSProperties) => {
    // 瀛椾綋澶у皬鏄犲皠
    const fontSizes = {
      small: { title: 'text-[10px]', detail: 'text-[8px]' },
      medium: { title: 'text-[11px]', detail: 'text-[9px]' },
      large: { title: 'text-[13px]', detail: 'text-[11px]' }
    };
    
    const currentFontSize = fontSizes[settings.fontSize] || fontSizes.medium;

    // 灏嗗崄鍏繘鍒堕鑹茶浆鎹负 rgba锛屽簲鐢ㄩ€忔槑搴?
    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const isCurrentWeekCourse = course.isCurrentWeek !== false;
    const cardOpacity = isCurrentWeekCourse
      ? settings.courseOpacity
      : Math.min(settings.courseOpacity * 0.35, 0.35);

    return (
      <div
        key={course.id}
        onClick={(e) => {
            e.stopPropagation();
            setEditingCourse(course);
            setIsPanelOpen(true);
        }}
        className="absolute m-0.5 rounded-xl p-2 border shadow-md cursor-pointer 
          hover:shadow-xl hover:scale-[1.02] hover:z-30 transition-all duration-200
          flex flex-col justify-start overflow-hidden text-white group select-none"
        style={{
          ...style,
          backgroundColor: hexToRgba(course.color, cardOpacity),
          borderColor: settings.showCourseWhiteBorder
            ? (isCurrentWeekCourse ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)')
            : 'transparent',
          boxSizing: 'border-box',
          zIndex: isCurrentWeekCourse ? 20 : 12
        }}
      >
        <h4 className={`font-black ${currentFontSize.title} leading-tight mb-1 line-clamp-2 drop-shadow-sm`}>{course.name}</h4>
        {settings.showLocation && (
          <div className={`${currentFontSize.detail} opacity-90 line-clamp-1 flex items-center gap-1`}>
            <MapPin size={10} strokeWidth={2.2} className="shrink-0 opacity-90" />
            <span className="truncate">{course.location}</span>
          </div>
        )}
        {settings.showTeacher && (
          <div className={`${currentFontSize.detail} opacity-80 line-clamp-1 flex items-center gap-1`}>
            <User size={10} strokeWidth={2.2} className="shrink-0 opacity-85" />
            <span className="truncate">{course.teacher}</span>
          </div>
        )}
      </div>
    );
  };

  if (loading && courses.length === 0) {
    return (
      <AppLayout title="主课表">
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
          <p className="text-muted-foreground text-sm">正在加载课表... {Math.max(1, Math.min(100, Math.round(loadingProgress)))}%</p>
          <div className="w-56 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-150"
              style={{ width: `${Math.max(1, Math.min(100, Math.round(loadingProgress)))}%` }}
            />
          </div>
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout title="主课表">
      {/* The page uses the shared body wallpaper/theme instead of a hard-coded image. */}
      <div className="flex flex-col h-full overflow-hidden transition-colors duration-300">
        {/* Toolbar - 娣诲姞姣涚幓鐠冩晥鏋滐紝鍥涘懆鍦嗚 */}
        <div className="flex justify-between items-center mb-6 px-2 shrink-0 bg-card/40 dark:bg-zinc-900/40 backdrop-blur-md p-4 rounded-2xl border border-border/20 midnight:border-emerald-500/20">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-foreground tracking-tight animate-in slide-in-from-left-4 duration-500">
                  第 <span className="text-primary midnight:text-emerald-500 mx-1">{currentWeek}</span> 周</h2>
                {semesterInfo?.countdownStr && (
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-in zoom-in duration-500 delay-300 ${
                    weekCourses.length === 0 
                      ? 'bg-amber-100 text-amber-600 shadow-sm ring-1 ring-amber-200 dark:bg-amber-800/20 dark:text-amber-300 dark:ring-amber-700' 
                      : 'bg-accent/50 text-muted-foreground'
                  }`}>
                    {semesterInfo.countdownStr}
                  </span>
                )}
              </div>
              {semesterInfo?.dateRangeStr && (
                <span className="text-xs font-bold text-muted-foreground ml-0.5 animate-in fade-in duration-700 delay-500 uppercase tracking-widest">
                  {semesterInfo.dateRangeStr}
                </span>
              )}
            </div>

            <div className="flex bg-card/80 dark:bg-zinc-800/80 backdrop-blur-xl rounded-[1.25rem] p-1.5 shadow-sm border border-border/60 animate-in slide-in-from-left-4 duration-500 delay-100">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  const newWeek = Math.max(1, currentWeek - 1);
                  setCurrentWeek(newWeek);
                  setSettings((prev) => ({ ...prev, currentWeek: newWeek }));
                }} 
                className="h-9 w-9 rounded-xl hover:bg-card hover:scale-110 active:scale-95 transition-all duration-300 shadow-sm"
              >
                <ChevronLeft size={18} className="text-foreground/70" />
              </Button>
              <div className="w-px h-5 bg-border self-center mx-1" />
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  const newWeek = Math.min(maxWeeks, currentWeek + 1);
                  setCurrentWeek(newWeek);
                  setSettings((prev) => ({ ...prev, currentWeek: newWeek }));
                }}
                className="h-9 w-9 rounded-xl hover:bg-card hover:scale-110 active:scale-95 transition-all duration-300 shadow-sm"
              >
                <ChevronRight size={18} className="text-foreground/70" />
              </Button>
            </div>
          </div>

          <div className="flex gap-3 animate-in slide-in-from-right-4 duration-500 delay-200">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setIsSettingsOpen(true)}
              className="h-11 w-11 rounded-[1.25rem] bg-card/60 backdrop-blur-xl border border-border/50 hover:bg-card hover:scale-105 hover:-translate-y-1 active:scale-95 shadow-sm hover:shadow-md transition-all duration-300"
            >
              <Settings size={20} className="text-foreground/70" />
            </Button>

            <Button 
              onClick={() => { setEditingCourse(null); setIsPanelOpen(true); }} 
              className="h-11 bg-primary midnight:bg-emerald-600 hover:opacity-90 text-primary-foreground rounded-[1.25rem] shadow-lg shadow-primary/20 hover:scale-105 hover:-translate-y-1 active:scale-95 transition-all duration-300 font-black px-6 gap-2"
            >
              <PlusCircle size={18} strokeWidth={2.5} /> 添加课程
            </Button>
          </div>
        </div>

        {/* 2. 鏍稿績璇捐〃鍖哄煙 - 鏀逛负鏇撮€忔槑鐨勮儗鏅?*/}
        <div
          className="flex-1 overflow-hidden bg-card/20 backdrop-blur-sm rounded-[2.5rem] border border-border/30 flex flex-col relative transition-all duration-500 midnight:bg-black/20 midnight:border-emerald-500/10"
          style={{ backgroundColor: `color-mix(in srgb, var(--card) ${scheduleSurfaceOpacity * 100}%, transparent)` }}
        >
            
            {/* 琛ㄥご (Header) - 淇濈暀涓€瀹氱殑妯＄硦搴︿互淇濊瘉鏂囧瓧鍙鎬?*/}
            <div className="flex border-b border-slate-300/70 dark:border-zinc-700/80 midnight:border-emerald-500/30 bg-card/40 backdrop-blur-md z-20" style={{ height: HEADER_HEIGHT }}>
                <div className={`flex-shrink-0 flex items-center justify-center font-bold text-muted-foreground border-r border-slate-300/70 dark:border-zinc-700/80 midnight:border-emerald-500/30 ${settings.fontSize === 'small' ? 'text-[10px]' : settings.fontSize === 'large' ? 'text-sm' : 'text-xs'}`} style={{ width: `${COL_WIDTH_PERCENT}%` }}>
                    {headerMonthLabel || '月份'}
                </div>
                {visibleWeekDays.map((dayInfo) => {
                    const today = new Date();
                    const isToday = settings.highlightToday &&
                      today.getFullYear() === dayInfo.date.getFullYear() &&
                      today.getMonth() === dayInfo.date.getMonth() &&
                      today.getDate() === dayInfo.date.getDate();

                    const dayNumFontSize = settings.fontSize === 'small' ? 'text-xs' : settings.fontSize === 'large' ? 'text-base' : 'text-sm';

                    return (
                        <div key={dayInfo.key} className={`flex-shrink-0 flex items-center justify-center border-r border-slate-300/70 dark:border-zinc-700/80 midnight:border-emerald-500/30 last:border-0 ${isToday ? 'bg-primary/10 midnight:bg-emerald-500/10' : ''}`} style={{ width: `${COL_WIDTH_PERCENT}%` }}>
                            <div className="flex flex-col items-center leading-none gap-1">
                                <span className={`text-[10px] font-black ${isToday ? 'text-primary midnight:text-emerald-400' : 'text-foreground/60'}`}>{dayInfo.weekdayText}</span>
                                <span className={`${dayNumFontSize} font-bold ${isToday ? 'text-primary midnight:text-emerald-400' : 'text-foreground/80'}`}>{dayInfo.dayNumber}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 婊氬姩鍖哄煙 */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative custom-scrollbar">
                {/* 鑳屾櫙缃戞牸灞?- 鍑忔贰缃戞牸绾块鑹蹭互闃插共鎵拌儗鏅浘 */}
                <div className="absolute inset-0 w-full pointer-events-none z-0" style={{ height: timeSlots.length * SLOT_HEIGHT }}>
                    {timeSlots.map((slot) => (
                        <div 
                            key={slot.id} 
                            className={`w-full flex ${settings.showGridLines ? 'border-b border-slate-300/70 dark:border-zinc-700/80 midnight:border-emerald-500/30' : ''}`}
                            style={{ height: SLOT_HEIGHT, boxSizing: 'border-box' }}
                        >
                            {/* 宸︿晶鏃堕棿鏍?- 澧炲己鑳屾櫙瀵规瘮搴?*/}
                            <div className={`flex-shrink-0 bg-card/30 dark:bg-zinc-900/30 backdrop-blur-sm flex flex-col items-center justify-center gap-1 ${settings.showGridLines ? 'border-r border-slate-300/70 dark:border-zinc-700/80 midnight:border-emerald-500/30' : ''}`} style={{ width: `${COL_WIDTH_PERCENT}%` }}>
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/50 text-[10px] font-black text-muted-foreground shadow-sm border border-border/40">
                                    {slot.id}
                                </div>
                                <div className="px-1.5 py-0.5 rounded-md bg-primary/10 midnight:bg-emerald-500/10 border border-primary/20 midnight:border-emerald-500/20 shadow-sm">
                                    <span className={`${settings.fontSize === 'small' ? 'text-[8px]' : settings.fontSize === 'large' ? 'text-[11px]' : 'text-[10px]'} font-bold text-primary midnight:text-emerald-400 whitespace-nowrap tracking-tighter`}>
                                        {slot.range}
                                    </span>
                                </div>
                            </div>
                            {/* 缃戞牸绾?- 浠呭湪寮€鍚椂鏄剧ず锛屽噺娣￠鑹?*/}
                            {settings.showGridLines && Array.from({length: displayDays}).map((_, i) => (
                                <div key={i} className="flex-shrink-0 border-r border-slate-300/60 dark:border-zinc-700/70 midnight:border-emerald-500/25 last:border-0 h-full" style={{ width: `${COL_WIDTH_PERCENT}%` }}></div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* 璇剧▼娓叉煋灞?(Course Layer) - 纭繚鍦ㄩ《灞備笖鍙氦浜?*/}
                <div className="absolute top-0 left-0 w-full z-10" style={{ height: timeSlots.length * SLOT_HEIGHT }}>
                    {coursesToRender.map(course => {
                        const columnIndex = courseDayToColumnIndex(course.day);
                        if (columnIndex === null) return null;

                        const leftPercent = (columnIndex + 1) * COL_WIDTH_PERCENT;
                        const topPx = (course.start - 1) * SLOT_HEIGHT;
                        const heightPx = course.duration * SLOT_HEIGHT;

                        return renderCourseCard(course, {
                            left: `${leftPercent}%`,
                            top: `${topPx}px`,
                            width: `${COL_WIDTH_PERCENT}%`,
                            height: `${heightPx}px`,
                        });
                    })}

                    {/* 褰撳墠鏃堕棿鎸囩ず鍣?*/}
                    {timeIndicatorPos && settings.highlightToday && settings.showTimeIndicator && (
                      <div 
                        className="absolute z-30 pointer-events-none"
                        style={{
                          top: `${timeIndicatorPos.top}px`,
                          left: `${(timeIndicatorPos.dayIndex + 1) * COL_WIDTH_PERCENT}%`,
                          width: `${COL_WIDTH_PERCENT}%`,
                        }}
                      >
                        <div className="relative h-0.5 bg-red-500 dark:bg-red-400">
                          <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500 dark:bg-red-400 border border-white dark:border-zinc-800" />
                          <div className="absolute -right-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500 dark:bg-red-400 border border-white dark:border-zinc-800" />
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 dark:bg-red-400 text-white text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            {currentTime.getHours().toString().padStart(2, '0')}:{currentTime.getMinutes().toString().padStart(2, '0')}
                          </div>
                        </div>
                      </div>
                    )}
                </div>
            </div>
        </div>
      </div>
      
      {/* 璇剧▼绠＄悊闈㈡澘 */}
      <CourseManagerPanel 
        isOpen={isPanelOpen} 
        onClose={() => {
            setIsPanelOpen(false);
            setEditingCourse(null);
        }}
        initialData={editingCourse}
        onSave={handleSaveCourse}
        onDelete={handleDeleteCourse}
        onRefresh={undefined}
        courseGroups={courseGroups}
      />

      <ScheduleSettingsPanel 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={applyScheduleSettings}
        onPreviewSettings={applyScheduleSettings}
      />

      {/* 瀵煎叆寮圭獥 */}
      <ImportSchedulerModal 
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          // 鉁?涓嶉渶瑕佸埛鏂帮紝瀵煎叆杩囩▼宸查€氳繃 scheduleDataUpdated 浜嬩欢鑷姩鏇存柊
        }}
      />

      {/* 鍒犻櫎纭寮圭獥 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl border-white/50 bg-white/80 backdrop-blur-3xl shadow-2xl dark:border-zinc-700/50 dark:bg-zinc-800/80">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <div className="w-1.5 h-6 bg-red-500 rounded-full" />
              确认删除课程
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 dark:text-slate-400 font-medium">
              你确定要从课表中删除这门课程吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="rounded-xl border-slate-200 dark:border-zinc-700 font-bold hover:bg-slate-50 dark:hover:bg-zinc-700">
              取消
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold shadow-lg shadow-red-200 dark:shadow-red-900/30"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Schedule;


