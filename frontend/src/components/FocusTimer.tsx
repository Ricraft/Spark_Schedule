import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, RotateCcw, 
  Coffee, BrainCircuit, Settings2, 
  Minus, Plus, CheckCircle2, X
} from 'lucide-react';

// 类型定义
type TimerMode = 'focus' | 'break';

interface FocusTimerPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FocusTimerPanel = ({ isOpen, onClose }: FocusTimerPanelProps) => {
  // --- 核心设置状态 ---
  const [focusDuration, setFocusDuration] = useState(25); // 分钟
  const [breakDuration] = useState(5);  // 分钟
  const [targetCycles, setTargetCycles] = useState(4);    // 目标循环次数

  // --- 运行时状态 ---
  const [timeLeft, setTimeLeft] = useState(focusDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<TimerMode>('focus');
  const [completedCycles, setCompletedCycles] = useState(0);
  
  const timerRef = useRef<number | null>(null);

  // 初始化时间
  useEffect(() => {
    if (!isActive) {
      setTimeLeft(mode === 'focus' ? focusDuration * 60 : breakDuration * 60);
    }
  }, [focusDuration, breakDuration, mode, isActive]);

  // 自动循环逻辑
  const handleTimerComplete = useCallback(() => {
    setIsActive(false);
    const audio = new Audio('/assets/notifications/bell.mp3');
    audio.play().catch(() => {});

    if (mode === 'focus') {
      const newCycles = completedCycles + 1;
      setCompletedCycles(newCycles);
      if (newCycles < targetCycles) {
        setMode('break');
        setTimeLeft(breakDuration * 60);
        // 可选：自动开始休息，或者等待用户点击
        // setIsActive(true); 
      } else {
        // 完成所有循环
        alert("🎉 恭喜！你完成了设定的所有专注周期！");
        setCompletedCycles(0);
      }
    } else {
      setMode('focus');
      setTimeLeft(focusDuration * 60);
    }
  }, [mode, completedCycles, targetCycles, breakDuration, focusDuration]);

  // 计时器逻辑
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      // 时间到，处理循环
      handleTimerComplete();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, timeLeft, handleTimerComplete]);

  // 格式化时间 mm:ss
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 计算进度圈 (SVG Dasharray)
  const totalTime = mode === 'focus' ? focusDuration * 60 : breakDuration * 60;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // 动态颜色
  const themeColor = mode === 'focus' ? '#ef4444' : '#10b981'; // 红/绿

  return (
    <>
      {/* 遮罩层 */}
      <div 
        className={`fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
      />

      {/* 侧边面板容器 */}
      <div className={`fixed top-0 right-0 h-full w-[500px] z-50 flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.15)] transition-transform duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        bg-white/80 backdrop-blur-3xl border-l border-white/50 ring-1 ring-white/60`}>
        
        {/* === 顶部：操作栏 === */}
        <div className="flex justify-between items-center p-6 border-b border-white/20">
          <div className="flex items-center gap-3">
             {/* 状态指示器 */}
             <div className="w-3 h-3 rounded-full shadow-sm transition-colors duration-500" style={{ backgroundColor: themeColor }} />
             <h2 className="text-lg font-black text-slate-800 tracking-tight">
               专注计时器
             </h2>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* === 中间：滚动内容区 === */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4">
            
            {/* 1. 顶部状态栏 */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-800">专注时刻</h3>
                <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
                  {mode === 'focus' ? <BrainCircuit size={14} className="text-red-500"/> : <Coffee size={14} className="text-emerald-500"/>}
                  {mode === 'focus' ? '保持专注，通过考核' : '休息一下，喝口水'}
                </p>
              </div>
              {/* 循环计数胶囊 */}
              <div className="bg-slate-100 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold text-slate-600">
                 <CheckCircle2 size={14} className={completedCycles > 0 ? "text-indigo-600" : "text-slate-400"} />
                 {completedCycles} / {targetCycles} 轮
              </div>
            </div>

            {/* 2. 视觉计时器 (SVG 圆环) */}
            <div className="flex-1 flex flex-col items-center justify-center relative min-h-[250px]">
              {/* 外圈装饰 */}
              <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white rounded-full opacity-50 blur-3xl scale-90" />
              
              <div className="relative">
                <svg width="220" height="220" className="transform -rotate-90">
                   {/* 轨道 */}
                   <circle cx="110" cy="110" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="8" />
                   {/* 进度条 */}
                   <circle 
                     cx="110" cy="110" r={radius} fill="none" 
                     stroke={themeColor} strokeWidth="8" strokeLinecap="round"
                     strokeDasharray={circumference}
                     strokeDashoffset={strokeDashoffset}
                     className="transition-all duration-1000 ease-linear"
                     style={{ filter: `drop-shadow(0 0 10px ${themeColor}60)` }}
                   />
                </svg>
                
                {/* 中间文字 */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <div className="text-5xl font-black text-slate-800 tabular-nums tracking-tighter">
                     {formatTime(timeLeft)}
                   </div>
                   <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">
                     {isActive ? 'RUNNING' : 'PAUSED'}
                   </div>
                </div>
              </div>

              {/* 控制按钮组 */}
              <div className="flex items-center gap-6 mt-8">
                 <button 
                   onClick={() => { setIsActive(false); setTimeLeft(mode==='focus'?focusDuration*60:breakDuration*60); }}
                   className="p-4 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                 >
                   <RotateCcw size={20} />
                 </button>
                 
                 <button 
                   onClick={() => setIsActive(!isActive)}
                   className="w-20 h-20 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 hover:scale-105 active:scale-95 transition-all"
                   style={{ backgroundColor: themeColor }}
                 >
                   {isActive ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                 </button>
              </div>
            </div>

            {/* 3. 设置面板 (简单设置) */}
            {/* 仅在暂停时允许修改，或始终允许但下一次生效 */}
            <div className="mt-auto bg-white/60 p-5 rounded-3xl border border-white/50 space-y-5">
               <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  <Settings2 size={12} /> 计时器设置
               </div>
               
               {/* A. 专注时长滑块 */}
               <div className="space-y-3">
                  <div className="flex justify-between text-sm font-bold text-slate-700">
                     <span>专注时长</span>
                     <span className="text-indigo-600">{focusDuration} 分钟</span>
                  </div>
                  <input 
                    type="range" min="5" max="60" step="5"
                    value={focusDuration}
                    onChange={(e) => { setFocusDuration(Number(e.target.value)); setIsActive(false); }}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1">
                     <span>5m</span><span>30m</span><span>60m</span>
                  </div>
               </div>

               {/* B. 循环次数步进器 */}
               <div className="flex items-center justify-between pt-2">
                  <div className="text-sm font-bold text-slate-700">循环周期</div>
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 h-10">
                     <button 
                       onClick={() => setTargetCycles(Math.max(1, targetCycles - 1))}
                       className="w-8 h-full flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-400"
                     >
                       <Minus size={14} />
                     </button>
                     <span className="w-8 text-center text-sm font-black text-slate-800">{targetCycles}</span>
                     <button 
                       onClick={() => setTargetCycles(Math.min(10, targetCycles + 1))}
                       className="w-8 h-full flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-400"
                     >
                       <Plus size={14} />
                     </button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// 保持原有的 FocusTimer 组件用于其他地方
export const FocusTimer = () => {
  // --- 核心设置状态 ---
  const [focusDuration, setFocusDuration] = useState(25); // 分钟
  const [breakDuration] = useState(5);  // 分钟
  const [targetCycles, setTargetCycles] = useState(4);    // 目标循环次数

  // --- 运行时状态 ---
  const [timeLeft, setTimeLeft] = useState(focusDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<TimerMode>('focus');
  const [completedCycles, setCompletedCycles] = useState(0);
  
  const timerRef = useRef<number | null>(null);

  // 初始化时间
  useEffect(() => {
    if (!isActive) {
      setTimeLeft(mode === 'focus' ? focusDuration * 60 : breakDuration * 60);
    }
  }, [focusDuration, breakDuration, mode, isActive]);

  // 自动循环逻辑
  const handleTimerComplete = useCallback(() => {
    setIsActive(false);
    const audio = new Audio('/assets/notifications/bell.mp3');
    audio.play().catch(() => {});

    if (mode === 'focus') {
      const newCycles = completedCycles + 1;
      setCompletedCycles(newCycles);
      if (newCycles < targetCycles) {
        setMode('break');
        setTimeLeft(breakDuration * 60);
        // 可选：自动开始休息，或者等待用户点击
        // setIsActive(true); 
      } else {
        // 完成所有循环
        alert("🎉 恭喜！你完成了设定的所有专注周期！");
        setCompletedCycles(0);
      }
    } else {
      setMode('focus');
      setTimeLeft(focusDuration * 60);
    }
  }, [mode, completedCycles, targetCycles, breakDuration, focusDuration]);

  // 计时器逻辑
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      // 时间到，处理循环
      handleTimerComplete();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, timeLeft, handleTimerComplete]);

  // 格式化时间 mm:ss
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 计算进度圈 (SVG Dasharray)
  const totalTime = mode === 'focus' ? focusDuration * 60 : breakDuration * 60;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // 动态颜色
  const themeColor = mode === 'focus' ? '#ef4444' : '#10b981'; // 红/绿

  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4">
      
      {/* 1. 顶部状态栏 */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-2xl font-black text-slate-800">专注时刻</h3>
          <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
            {mode === 'focus' ? <BrainCircuit size={14} className="text-red-500"/> : <Coffee size={14} className="text-emerald-500"/>}
            {mode === 'focus' ? '保持专注，通过考核' : '休息一下，喝口水'}
          </p>
        </div>
        {/* 循环计数胶囊 */}
        <div className="bg-slate-100 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold text-slate-600">
           <CheckCircle2 size={14} className={completedCycles > 0 ? "text-indigo-600" : "text-slate-400"} />
           {completedCycles} / {targetCycles} 轮
        </div>
      </div>

      {/* 2. 视觉计时器 (SVG 圆环) */}
      <div className="flex-1 flex flex-col items-center justify-center relative min-h-[250px]">
        {/* 外圈装饰 */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white rounded-full opacity-50 blur-3xl scale-90" />
        
        <div className="relative">
          <svg width="220" height="220" className="transform -rotate-90">
             {/* 轨道 */}
             <circle cx="110" cy="110" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="8" />
             {/* 进度条 */}
             <circle 
               cx="110" cy="110" r={radius} fill="none" 
               stroke={themeColor} strokeWidth="8" strokeLinecap="round"
               strokeDasharray={circumference}
               strokeDashoffset={strokeDashoffset}
               className="transition-all duration-1000 ease-linear"
               style={{ filter: `drop-shadow(0 0 10px ${themeColor}60)` }}
             />
          </svg>
          
          {/* 中间文字 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
             <div className="text-5xl font-black text-slate-800 tabular-nums tracking-tighter">
               {formatTime(timeLeft)}
             </div>
             <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">
               {isActive ? 'RUNNING' : 'PAUSED'}
             </div>
          </div>
        </div>

        {/* 控制按钮组 */}
        <div className="flex items-center gap-6 mt-8">
           <button 
             onClick={() => { setIsActive(false); setTimeLeft(mode==='focus'?focusDuration*60:breakDuration*60); }}
             className="p-4 rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
           >
             <RotateCcw size={20} />
           </button>
           
           <button 
             onClick={() => setIsActive(!isActive)}
             className="w-20 h-20 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 hover:scale-105 active:scale-95 transition-all"
             style={{ backgroundColor: themeColor }}
           >
             {isActive ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
           </button>
        </div>
      </div>

      {/* 3. 设置面板 (简单设置) */}
      {/* 仅在暂停时允许修改，或始终允许但下一次生效 */}
      <div className="mt-auto bg-white/60 p-5 rounded-3xl border border-white/50 space-y-5">
         <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <Settings2 size={12} /> 计时器设置
         </div>
         
         {/* A. 专注时长滑块 */}
         <div className="space-y-3">
            <div className="flex justify-between text-sm font-bold text-slate-700">
               <span>专注时长</span>
               <span className="text-indigo-600">{focusDuration} 分钟</span>
            </div>
            <input 
              type="range" min="5" max="60" step="5"
              value={focusDuration}
              onChange={(e) => { setFocusDuration(Number(e.target.value)); setIsActive(false); }}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold px-1">
               <span>5m</span><span>30m</span><span>60m</span>
            </div>
         </div>

         {/* B. 循环次数步进器 */}
         <div className="flex items-center justify-between pt-2">
            <div className="text-sm font-bold text-slate-700">循环周期</div>
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 h-10">
               <button 
                 onClick={() => setTargetCycles(Math.max(1, targetCycles - 1))}
                 className="w-8 h-full flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-400"
               >
                 <Minus size={14} />
               </button>
               <span className="w-8 text-center text-sm font-black text-slate-800">{targetCycles}</span>
               <button 
                 onClick={() => setTargetCycles(Math.min(10, targetCycles + 1))}
                 className="w-8 h-full flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-400"
               >
                 <Plus size={14} />
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};