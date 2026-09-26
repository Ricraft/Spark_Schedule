import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useStudyTime } from '@/hooks/useStudyTime';
import { useSettingsBridge } from '@/hooks/useSettingsBridge';

interface FocusContextType {
  // 状态
  isActive: boolean;
  mode: 'focus' | 'break';
  timeLeft: number;
  isMuted: boolean;
  audioInitialized: boolean;
  
  // 设置
  focusDuration: number;
  breakDuration: number;
  ambientSound: string;
  ambientVolume: number;
  selectedSound: string;
  notificationVolume: number;
  autoPlayNoise: boolean;
  weekGoalHours: number; // 每周目标学习时长
  
  // 方法
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  toggleMute: () => void;
  initializeAudio: () => void;
  skipToNext: () => void; // 跳过当前阶段
  
  // 设置更新方法
  setFocusDuration: (value: number) => void;
  setBreakDuration: (value: number) => void;
  setAmbientSound: (value: string) => void;
  setAmbientVolume: (value: number) => void;
  setSelectedSound: (value: string) => void;
  setNotificationVolume: (value: number) => void;
  setAutoPlayNoise: (value: boolean) => void;
  setWeekGoalHours: (value: number) => void;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

export const FocusProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { settings, updateSettings } = useSettingsBridge();
  
  // 持久化设置 - 优先从后端加载，如果后端没有则使用localStorage
  const [localFocusDuration, setLocalFocusDuration] = useLocalStorage('focus-duration', 25);
  const [localBreakDuration, setLocalBreakDuration] = useLocalStorage('break-duration', 5);
  const [localAmbientSound, setLocalAmbientSound] = useLocalStorage('ambient-sound', 'rain');
  const [localAmbientVolume, setLocalAmbientVolume] = useLocalStorage('ambient-volume', 50);
  const [localSelectedSound, setLocalSelectedSound] = useLocalStorage('notification-sound', 'bell');
  const [localNotificationVolume, setLocalNotificationVolume] = useLocalStorage('notification-volume', 80);
  const [localAutoPlayNoise, setLocalAutoPlayNoise] = useLocalStorage('auto-play-noise', true);
  
  // 使用state来存储当前使用的值，确保能响应settings的变化
  const [focusDuration, setFocusDurationState] = useState(localFocusDuration);
  const [breakDuration, setBreakDurationState] = useState(localBreakDuration);
  const [ambientSound, setAmbientSoundState] = useState(localAmbientSound);
  const [ambientVolume, setAmbientVolumeState] = useState(localAmbientVolume);
  const [selectedSound, setSelectedSoundState] = useState(localSelectedSound);
  const [notificationVolume, setNotificationVolumeState] = useState(localNotificationVolume);
  const [autoPlayNoise, setAutoPlayNoiseState] = useState(localAutoPlayNoise);
  
  // 当后端settings加载完成时，更新所有state
  useEffect(() => {
    if (settings) {
      console.log('🍅 [FocusContext] 从后端加载番茄钟设置:', {
        focus_duration: settings.focus_duration,
        pomodoro_break_duration: settings.pomodoro_break_duration,
        ambient_sound: settings.ambient_sound,
        notification_sound: settings.notification_sound,
        ambient_volume: settings.ambient_volume,
        notification_volume: settings.notification_volume,
        auto_play_noise: settings.auto_play_noise,
        week_goal_hours: settings.week_goal_hours
      });
      
      // 同步后端设置到state和localStorage
      if (settings.focus_duration !== undefined) {
        setFocusDurationState(settings.focus_duration);
        setLocalFocusDuration(settings.focus_duration);
      }
      if (settings.pomodoro_break_duration !== undefined) {
        setBreakDurationState(settings.pomodoro_break_duration);
        setLocalBreakDuration(settings.pomodoro_break_duration);
      }
      if (settings.ambient_sound !== undefined) {
        setAmbientSoundState(settings.ambient_sound);
        setLocalAmbientSound(settings.ambient_sound);
      }
      if (settings.ambient_volume !== undefined) {
        setAmbientVolumeState(settings.ambient_volume);
        setLocalAmbientVolume(settings.ambient_volume);
      }
      if (settings.notification_sound !== undefined) {
        setSelectedSoundState(settings.notification_sound);
        setLocalSelectedSound(settings.notification_sound);
      }
      if (settings.notification_volume !== undefined) {
        setNotificationVolumeState(settings.notification_volume);
        setLocalNotificationVolume(settings.notification_volume);
      }
      if (settings.auto_play_noise !== undefined) {
        setAutoPlayNoiseState(settings.auto_play_noise);
        setLocalAutoPlayNoise(settings.auto_play_noise);
      }
    }
  }, [settings, setLocalFocusDuration, setLocalBreakDuration, setLocalAmbientSound, 
      setLocalAmbientVolume, setLocalSelectedSound, setLocalNotificationVolume, setLocalAutoPlayNoise]);
  
  // 调试日志：显示当前使用的值
  useEffect(() => {
    console.log('🎯 [FocusContext] 当前使用的番茄钟设置:', {
      focusDuration,
      breakDuration,
      ambientSound,
      selectedSound,
      ambientVolume,
      notificationVolume,
      autoPlayNoise,
      来源: settings ? '后端' : 'localStorage'
    });
  }, [focusDuration, breakDuration, ambientSound, selectedSound, ambientVolume, notificationVolume, autoPlayNoise, settings]);
  
  // 运行时状态
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [timeLeft, setTimeLeft] = useState(focusDuration * 60);
  const [isMuted, setIsMuted] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { addMinutes, weekGoalHours, updateGoal } = useStudyTime();

  // 同步时长设置
  useEffect(() => {
    if (!isActive) {
      setTimeLeft(mode === 'focus' ? focusDuration * 60 : breakDuration * 60);
    }
  }, [focusDuration, breakDuration, mode, isActive]);

  // 音频管理
  useEffect(() => {
    if (!audioInitialized || ambientSound === 'none' || !isActive || isMuted || !autoPlayNoise) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return;
    }

    if (audioRef.current && audioRef.current.src.includes(ambientSound)) {
      audioRef.current.volume = ambientVolume / 100;
      audioRef.current.play().catch(e => console.error('Audio play failed:', e));
      return;
    }

    const audioPath = `./assets/sounds/${ambientSound}.mp3`;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    audioRef.current = new Audio(audioPath);
    audioRef.current.loop = true;
    audioRef.current.preload = 'auto';
    audioRef.current.volume = ambientVolume / 100;
    audioRef.current.play().catch(e => console.error('Audio play failed:', e));

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [isActive, ambientSound, isMuted, autoPlayNoise, ambientVolume, audioInitialized]);

  // 计时器完成处理
  const handleTimerComplete = useCallback(() => {
    setIsActive(false);
    
    // 如果是专注模式完成，记录学习时长
    if (mode === 'focus') {
      addMinutes(focusDuration);
      console.log(`✅ 专注时间完成，记录 ${focusDuration} 分钟`);
    }
    
    // 播放提示音
    const notificationAudio = new Audio(`./assets/notifications/${selectedSound}.mp3`);
    notificationAudio.volume = notificationVolume / 100;
    notificationAudio.play().catch(e => console.error('Notification sound failed:', e));

    // 同时触发 Windows 原生通知（通过 PyBridge）
    try {
      const bridge = (window as any).pyBridge;
      const allowNotify = settings?.enable_notifications ?? true;
      if (allowNotify && bridge?.send_desktop_notification) {
        const title = mode === 'focus' ? '番茄钟完成' : '休息结束';
        const message = mode === 'focus'
          ? `专注 ${focusDuration} 分钟已完成，开始休息 ${breakDuration} 分钟。`
          : `休息完成，开始下一轮专注 ${focusDuration} 分钟。`;
        const playSound = (settings?.notification_sound ?? selectedSound) !== 'none';
        bridge.send_desktop_notification(title, message, playSound, 5000);
      }
    } catch (e) {
      console.warn('Desktop notification failed:', e);
    }
    
    // 切换模式
    if (mode === 'focus') {
      setMode('break');
      setTimeLeft(breakDuration * 60);
    } else {
      setMode('focus');
      setTimeLeft(focusDuration * 60);
    }
  }, [mode, breakDuration, focusDuration, selectedSound, notificationVolume, addMinutes, settings]);

  // 计时器逻辑
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      handleTimerComplete();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { 
      if (timerRef.current) clearInterval(timerRef.current); 
    };
  }, [isActive, timeLeft, handleTimerComplete]);

  // 设置更新方法 - 同时更新本地、state和后端
  const setFocusDuration = useCallback((value: number) => {
    setFocusDurationState(value);
    setLocalFocusDuration(value);
    updateSettings({ focus_duration: value });
  }, [updateSettings, setLocalFocusDuration]);

  const setBreakDuration = useCallback((value: number) => {
    setBreakDurationState(value);
    setLocalBreakDuration(value);
    updateSettings({ pomodoro_break_duration: value });
  }, [updateSettings, setLocalBreakDuration]);

  const setAmbientSound = useCallback((value: string) => {
    console.log(`🎵 [FocusContext] 保存白噪音设置: ${value}`);
    setAmbientSoundState(value);
    setLocalAmbientSound(value);
    updateSettings({ ambient_sound: value });
  }, [updateSettings, setLocalAmbientSound]);

  const setAmbientVolume = useCallback((value: number) => {
    console.log(`🔊 [FocusContext] 保存白噪音音量: ${value}`);
    setAmbientVolumeState(value);
    setLocalAmbientVolume(value);
    updateSettings({ ambient_volume: value });
  }, [updateSettings, setLocalAmbientVolume]);

  const setSelectedSound = useCallback((value: string) => {
    console.log(`🔔 [FocusContext] 保存完成音效: ${value}`);
    setSelectedSoundState(value);
    setLocalSelectedSound(value);
    updateSettings({ notification_sound: value });
  }, [updateSettings, setLocalSelectedSound]);

  const setNotificationVolume = useCallback((value: number) => {
    console.log(`🔊 [FocusContext] 保存完成音效音量: ${value}`);
    setNotificationVolumeState(value);
    setLocalNotificationVolume(value);
    updateSettings({ notification_volume: value });
  }, [updateSettings, setLocalNotificationVolume]);

  const setAutoPlayNoise = useCallback((value: boolean) => {
    setAutoPlayNoiseState(value);
    setLocalAutoPlayNoise(value);
    updateSettings({ auto_play_noise: value });
  }, [updateSettings, setLocalAutoPlayNoise]);

  const setWeekGoalHours = useCallback((hours: number) => {
    updateGoal(hours);
    updateSettings({ week_goal_hours: hours });
  }, [updateGoal, updateSettings]);

  // 方法
  const startTimer = useCallback(() => {
    setIsActive(true);
  }, []);

  const pauseTimer = useCallback(() => {
    setIsActive(false);
  }, []);

  const resetTimer = useCallback(() => {
    setIsActive(false);
    setTimeLeft(mode === 'focus' ? focusDuration * 60 : breakDuration * 60);
  }, [mode, focusDuration, breakDuration]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const initializeAudio = useCallback(() => {
    setAudioInitialized(true);
  }, []);

  const skipToNext = useCallback(() => {
    handleTimerComplete();
  }, [handleTimerComplete]);

  const value: FocusContextType = {
    isActive,
    mode,
    timeLeft,
    isMuted,
    audioInitialized,
    focusDuration,
    breakDuration,
    ambientSound,
    ambientVolume,
    selectedSound,
    notificationVolume,
    autoPlayNoise,
    weekGoalHours,
    startTimer,
    pauseTimer,
    resetTimer,
    toggleMute,
    initializeAudio,
    skipToNext,
    setFocusDuration,
    setBreakDuration,
    setAmbientSound,
    setAmbientVolume,
    setSelectedSound,
    setNotificationVolume,
    setAutoPlayNoise,
    setWeekGoalHours,
  };

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
};

export const useFocus = () => {
  const context = useContext(FocusContext);
  if (context === undefined) {
    throw new Error('useFocus must be used within a FocusProvider');
  }
  return context;
};
