import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, Settings, Coffee, BrainCircuit, Volume2, VolumeX } from "lucide-react";
import { FocusSettingsPanel } from "@/components/FocusSettingsView";
import { useFocus } from "@/contexts/FocusContext"; 

// =========================================================================
// 🎨 视觉特效组件：强力呼吸圆环 (High-Impact Rings)
// =========================================================================
const BreathRings = ({ active, mode }: { active: boolean; mode: 'focus' | 'break' }) => {
  // 定义增强版动画：范围更大(Scale 4.0)，线条更粗，带光晕
  // 🔒 使用 !important 防止被性能优化覆盖
  const styles = `
    @keyframes ripple-out-strong {
      0% {
        transform: scale(0.9);
        opacity: 0;
        border-width: 8px;
        box-shadow: 0 0 0 rgba(0,0,0,0);
      }
      10% {
        opacity: 1;
        box-shadow: 0 0 20px currentColor; /* 爆发光晕 */
      }
      100% {
        transform: scale(3.5); /* 扩散范围极大 */
        opacity: 0;
        border-width: 0px;
        box-shadow: 0 0 0 transparent;
      }
    }
    @keyframes ripple-in-strong {
      0% {
        transform: scale(3.5);
        opacity: 0;
        border-width: 0px;
      }
      50% {
        opacity: 0.8;
        box-shadow: 0 0 15px currentColor;
      }
      100% {
        transform: scale(0.9);
        opacity: 1;
        border-width: 8px;
        box-shadow: 0 0 30px currentColor;
      }
    }
  `;

  // 颜色定义：使用高饱和度颜色以增强可见性
  const colorClass = mode === 'focus' ? 'text-indigo-500 border-indigo-500' : 'text-emerald-500 border-emerald-500';
  
  // 生成 4 个圆环，增加密度
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <style>{styles}</style>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`absolute rounded-full border border-current ripple-ring ${colorClass}`}
          style={{
            // 初始大小与主表盘一致
            width: '20rem',
            height: '20rem',
            // 动画逻辑
            animation: active
              ? `${mode === 'focus' ? 'ripple-out-strong' : 'ripple-in-strong'} 6s infinite cubic-bezier(0.4, 0, 0.2, 1)`
              : 'none',
            // 错开时间，形成波浪
            animationDelay: `${i * 1.5}s`,
            opacity: 0, // 默认隐藏
          }}
        />
      ))}
    </div>
  );
};

// =========================================================================
// ⏱️ 主页面组件
// =========================================================================
const Focus = () => {
  // 从 Context 获取所有状态和方法
  const {
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
  } = useFocus();
  
  // 本地 UI 状态
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    // 首次点击时初始化音频上下文（解决浏览器自动播放限制）
    if (!audioInitialized && !isActive) {
      console.log('🎬 Initializing audio on user interaction');
      initializeAudio();
    }
    
    if (isActive) {
      pauseTimer();
    } else {
      startTimer();
    }
  };

  const handleReset = () => {
    resetTimer();
  };
  
  const handleSkip = () => {
    // 跳过当前阶段，直接切换到下一个阶段
    skipToNext();
  };

  // 动态主题样式
  const themeColor = mode === 'focus' ? 'text-foreground' : 'text-emerald-500';
  // 背景光晕 (专注时紫色，休息时绿色)
  const ambientLight = mode === 'focus' ? 'bg-primary' : 'bg-emerald-500';

  return (
    <AppLayout title="番茄钟">
      
      {/* 1. 设置面板 (侧边面板模式) */}
      {isSettingsOpen && (
        <FocusSettingsPanel 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)}
          focusTime={focusDuration}
          setFocusTime={setFocusDuration}
          shortBreak={breakDuration}
          setShortBreak={setBreakDuration}
          ambientSound={ambientSound}
          setAmbientSound={setAmbientSound}
          ambientVolume={ambientVolume}
          setAmbientVolume={setAmbientVolume}
          selectedSound={selectedSound}
          setSelectedSound={setSelectedSound}
          volume={notificationVolume}
          setVolume={setNotificationVolume}
          autoPlayNoise={autoPlayNoise}
          setAutoPlayNoise={setAutoPlayNoise}
          weekGoalHours={weekGoalHours}
          setWeekGoalHours={setWeekGoalHours}
        />
      )}

      <div className="flex flex-col items-center justify-center h-full space-y-12 py-10 relative overflow-hidden">
        
        {/* 顶部胶囊标签 */}
        <div className={`relative z-20 flex items-center gap-2 text-xs font-black uppercase tracking-widest px-6 py-2.5 rounded-full bg-card/70 backdrop-blur-xl shadow-sm border border-border/50 transition-all duration-500 ${mode === 'focus' ? 'text-primary midnight:text-emerald-400' : 'text-emerald-500'}`}>
           {mode === 'focus' ? <BrainCircuit size={16} /> : <Coffee size={16} />}
           {mode === 'focus' ? 'Focus Mode' : 'Rest & Recharge'}
        </div>

        {/* 2. 核心计时器容器 */}
        <div className="relative group z-10">
          
          {/* A. 强力背景光晕 (Ambient Light) */}
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[100px] opacity-20 transition-colors duration-1000 ${ambientLight}`}></div>

          {/* B. 视觉特效层 */}
          <BreathRings active={isActive} mode={mode} />
          
          {/* C. 主表盘 (Main Dial) */}
          <div className="w-80 h-80 rounded-full border-8 border-border/20 flex items-center justify-center bg-card/60 backdrop-blur-2xl shadow-2xl relative z-10 hover:scale-[1.02] transition-transform duration-500 midnight:border-emerald-500/10">
            <div className="text-center">
               <div className={`text-7xl font-mono font-black tracking-tighter tabular-nums transition-colors duration-500 drop-shadow-sm ${themeColor}`}>
                 {formatTime(timeLeft)}
               </div>
               
               <div className="text-muted-foreground mt-3 font-bold flex flex-col items-center gap-1 min-h-[3rem] text-sm uppercase tracking-widest">
                 {isActive ? (
                   <span className="animate-pulse-slow flex items-center gap-2">
                     <span className={`w-2 h-2 rounded-full ${ambientLight}`} />
                     {mode === 'focus' ? 'Focusing...' : 'Breathing...'}
                   </span>
                 ) : (
                   <span className="opacity-60">Ready</span>
                 )}
               </div>

               {/* 悬浮设置入口 */}
               <button 
                 onClick={() => setIsSettingsOpen(true)}
                 className="mt-6 p-3 rounded-2xl bg-accent/50 border border-border/50 hover:bg-card text-muted-foreground hover:text-primary transition-all hover:scale-110 hover:shadow-lg active:scale-95 midnight:hover:text-emerald-400"
               >
                 <Settings size={20} />
               </button>
            </div>
          </div>
        </div>

        {/* 3. 底部控制栏 */}
        <div className="flex gap-6 items-center relative z-20">
           <Button 
             onClick={handleReset}
             size="icon" 
             className="w-16 h-16 rounded-[1.5rem] border-2 border-border/50 bg-card/60 hover:bg-card/90 hover:border-border backdrop-blur-xl shadow-lg hover:-translate-y-1 transition-all group midnight:border-emerald-500/10"
           >
             <RotateCcw className="w-6 h-6 text-muted-foreground group-hover:text-foreground group-hover:-rotate-90 transition-transform" />
           </Button>

           {/* 静音/取消静音按钮 */}
           <Button 
             onClick={toggleMute}
             size="icon" 
             className={`w-16 h-16 rounded-[1.5rem] border-2 backdrop-blur-xl shadow-lg hover:-translate-y-1 transition-all group midnight:border-emerald-500/10
               ${isMuted 
                 ? 'border-red-200 bg-red-500/10 hover:bg-red-500/20 hover:border-red-300' 
                 : 'border-border/50 bg-card/60 hover:bg-card/90 hover:border-border'}`}
             title={isMuted ? '取消静音' : '静音白噪音'}
           >
             {isMuted ? (
               <VolumeX className="w-6 h-6 text-red-500 group-hover:scale-110 transition-transform" />
             ) : (
               <Volume2 className="w-6 h-6 text-muted-foreground group-hover:scale-110 transition-transform" />
             )}
           </Button>
           
           <Button 
             onClick={handlePlayPause}
             size="icon" 
             className={`w-24 h-24 rounded-[2rem] shadow-2xl hover:scale-105 hover:-translate-y-2 active:scale-95 transition-all flex items-center justify-center border-4 border-white/30 backdrop-blur-sm
               ${mode === 'focus' ? 'bg-primary hover:opacity-90 shadow-primary/40 midnight:bg-emerald-600' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/40'}`}
           >
             {isActive ? (
               <Pause className="w-10 h-10 text-primary-foreground fill-current" />
             ) : (
               <Play className="w-10 h-10 text-primary-foreground fill-current ml-1" />
             )}
           </Button>
           
           <Button 
             onClick={handleSkip}
             size="icon" 
             className="w-16 h-16 rounded-[1.5rem] border-2 border-border/50 bg-card/60 hover:bg-card/90 hover:border-border backdrop-blur-xl shadow-lg hover:-translate-y-1 transition-all group midnight:border-emerald-500/10"
             title={mode === 'focus' ? '跳过专注' : '结束休息'}
           >
             {mode === 'focus' ? <Coffee className="w-6 h-6 text-muted-foreground group-hover:text-amber-600 group-hover:scale-110 transition-transform" /> : <BrainCircuit className="w-6 h-6 text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-transform midnight:group-hover:text-emerald-400" />}
           </Button>
        </div>

      </div>
    </AppLayout>
  );
};

export default Focus;