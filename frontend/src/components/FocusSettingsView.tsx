import { useState, useEffect } from 'react';
import { 
  Coffee, Music, Volume2, 
  PlayCircle, CheckCircle2, Zap, Hourglass, X,
  CloudRain, Flame, Trees, Moon, Utensils, Waves, MicOff
} from 'lucide-react';

// 模拟音效列表
const SOUND_OPTIONS = [
  { id: 'bell', name: '经典闹铃', icon: '🔔' },
  { id: 'digital', name: '电子滴答', icon: '⏰' },
  { id: 'bird', name: '清晨鸟鸣', icon: '🐦' },
  { id: 'rain', name: '雨天白噪', icon: '🌧️' },
  { id: 'none', name: '静音', icon: '🔕' },
];

// --- 新增：白噪音配置数据 ---
const AMBIENT_OPTIONS = [
  { id: 'none',   name: '静默',     icon: <MicOff size={24}/>,   desc: '保持安静' },
  { id: 'rain',   name: '雷雨夜',   icon: <CloudRain size={24}/>, desc: '淅沥雨声' },
  { id: 'fire',   name: '壁炉',     icon: <Flame size={24}/>,     desc: '温暖篝火' },
  { id: 'forest', name: '迷雾森林', icon: <Trees size={24}/>,     desc: '鸟鸣虫叫' },
  { id: 'night',  name: '夏夜',     icon: <Moon size={24}/>,      desc: '静谧蝉鸣' },
  { id: 'cafe',   name: '咖啡馆',   icon: <Utensils size={24}/>,  desc: '人群白噪' },
];

interface FocusSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // 传入设置状态和更新函数
  focusTime: number;
  setFocusTime: (value: number) => void;
  shortBreak: number;
  setShortBreak: (value: number) => void;
  ambientSound: string;
  setAmbientSound: (value: string) => void;
  ambientVolume: number;
  setAmbientVolume: (value: number) => void;
  selectedSound: string;
  setSelectedSound: (value: string) => void;
  volume: number;
  setVolume: (value: number) => void;
  autoPlayNoise: boolean;
  setAutoPlayNoise: (value: boolean) => void;
  weekGoalHours: number;
  setWeekGoalHours: (value: number) => void;
}

export const FocusSettingsPanel = ({ 
  isOpen, 
  onClose,
  focusTime,
  setFocusTime,
  shortBreak,
  setShortBreak,
  ambientSound,
  setAmbientSound,
  ambientVolume,
  setAmbientVolume,
  selectedSound,
  setSelectedSound,
  volume,
  setVolume,
  autoPlayNoise,
  setAutoPlayNoise,
  weekGoalHours,
  setWeekGoalHours
}: FocusSettingsPanelProps) => {
  const [previewAudioRef, setPreviewAudioRef] = useState<HTMLAudioElement | null>(null);

  // 当面板关闭时，停止所有预览音频
  useEffect(() => {
    if (!isOpen && previewAudioRef) {
      previewAudioRef.pause();
      previewAudioRef.currentTime = 0;
      previewAudioRef.src = '';
      setPreviewAudioRef(null);
    }
  }, [isOpen, previewAudioRef]);

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
             <div className="w-3 h-3 rounded-full shadow-sm transition-colors duration-500 bg-indigo-600" />
             <h2 className="text-lg font-black text-slate-800 tracking-tight">
               专注设置
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
          <FocusSettingsView 
            focusTime={focusTime}
            setFocusTime={setFocusTime}
            shortBreak={shortBreak}
            setShortBreak={setShortBreak}
            ambientSound={ambientSound}
            setAmbientSound={setAmbientSound}
            ambientVolume={ambientVolume}
            setAmbientVolume={setAmbientVolume}
            selectedSound={selectedSound}
            setSelectedSound={setSelectedSound}
            volume={volume}
            setVolume={setVolume}
            autoPlayNoise={autoPlayNoise}
            setAutoPlayNoise={setAutoPlayNoise}
            weekGoalHours={weekGoalHours}
            setWeekGoalHours={setWeekGoalHours}
            previewAudioRef={previewAudioRef}
            setPreviewAudioRef={setPreviewAudioRef}
          />
        </div>
      </div>
    </>
  );
};

interface FocusSettingsViewProps {
  focusTime: number;
  setFocusTime: (value: number) => void;
  shortBreak: number;
  setShortBreak: (value: number) => void;
  ambientSound: string;
  setAmbientSound: (value: string) => void;
  ambientVolume: number;
  setAmbientVolume: (value: number) => void;
  selectedSound: string;
  setSelectedSound: (value: string) => void;
  volume: number;
  setVolume: (value: number) => void;
  autoPlayNoise: boolean;
  setAutoPlayNoise: (value: boolean) => void;
  weekGoalHours: number;
  setWeekGoalHours: (value: number) => void;
  previewAudioRef: HTMLAudioElement | null;
  setPreviewAudioRef: (audio: HTMLAudioElement | null) => void;
}

export const FocusSettingsView = ({
  focusTime,
  setFocusTime,
  shortBreak,
  setShortBreak,
  ambientSound,
  setAmbientSound,
  ambientVolume,
  setAmbientVolume,
  selectedSound,
  setSelectedSound,
  volume,
  setVolume,
  autoPlayNoise,
  setAutoPlayNoise,
  weekGoalHours,
  setWeekGoalHours,
  previewAudioRef,
  setPreviewAudioRef
}: FocusSettingsViewProps) => {
  // --- 其他本地状态 ---
  const [longBreak, setLongBreak] = useState(15);
  const [rounds, setRounds] = useState(4);
  const [autoStartBreak, setAutoStartBreak] = useState(false);

  // --- 音频管理状态 (仅用于显示播放状态) ---
  const [currentNotificationAudio, setCurrentNotificationAudio] = useState<HTMLAudioElement | null>(null);
  const [currentAmbientAudio, setCurrentAmbientAudio] = useState<HTMLAudioElement | null>(null);

  // 组件卸载时清理所有音频
  useEffect(() => {
    return () => {
      // 清理通知音效
      if (currentNotificationAudio) {
        currentNotificationAudio.pause();
        currentNotificationAudio.currentTime = 0;
        currentNotificationAudio.src = '';
      }
      // 清理白噪音
      if (currentAmbientAudio) {
        currentAmbientAudio.pause();
        currentAmbientAudio.currentTime = 0;
        currentAmbientAudio.src = '';
      }
      // 清理父组件传入的预览音频
      if (previewAudioRef) {
        previewAudioRef.pause();
        previewAudioRef.currentTime = 0;
        previewAudioRef.src = '';
      }
    };
  }, [currentNotificationAudio, currentAmbientAudio, previewAudioRef]);

  // 停止当前播放的音频
  const stopCurrentAudio = (audioRef: HTMLAudioElement | null) => {
    if (audioRef) {
      audioRef.pause();
      audioRef.currentTime = 0;
    }
  };

  // 完成音效预览 - 在点击的同步堆栈中直接初始化
  const previewNotificationSound = (soundId: string) => {
    console.log(`🔊 Preview notification sound: ${soundId} at volume ${volume}%`);
    
    // 停止之前的完成音效
    stopCurrentAudio(currentNotificationAudio);
    stopCurrentAudio(previewAudioRef);
    
    // 静音选项不播放
    if (soundId === 'none') return;
    
    // 关键点：在用户点击的当前执行栈中直接创建并调用 play
    const audio = new Audio(`./assets/notifications/${soundId}.mp3`);
    audio.volume = volume / 100;
    
    // 保存当前音频引用
    setCurrentNotificationAudio(audio);
    setPreviewAudioRef(audio);
    
    // 音频结束后清理引用
    audio.addEventListener('ended', () => {
      setCurrentNotificationAudio(null);
      setPreviewAudioRef(null);
    });
    
    // 关键点：在用户点击的当前执行栈中直接调用 play
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.error("Notification audio play blocked:", error);
        setCurrentNotificationAudio(null);
        setPreviewAudioRef(null);
      });
    }
  };

  // 白噪音预览 - 循环播放
  const previewAmbientSound = (soundId: string) => {
    console.log(`🌊 Preview ambient sound: ${soundId} at volume ${ambientVolume}%`);
    
    // 停止之前的白噪音
    stopCurrentAudio(currentAmbientAudio);
    stopCurrentAudio(previewAudioRef);
    setCurrentAmbientAudio(null);
    
    // 静音选项不播放
    if (soundId === 'none') return;
    
    // 关键点：在用户点击的当前执行栈中直接创建并调用 play
    const audio = new Audio(`./assets/sounds/${soundId}.mp3`);
    audio.volume = ambientVolume / 100;
    audio.loop = true; // 白噪音需要循环播放
    
    // 保存当前音频引用
    setCurrentAmbientAudio(audio);
    setPreviewAudioRef(audio);
    
    // 关键点：在用户点击的当前执行栈中直接调用 play
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        console.error("Ambient audio play blocked:", error);
        setCurrentAmbientAudio(null);
        setPreviewAudioRef(null);
      });
    }
  };

  // 停止白噪音预览
  const stopAmbientPreview = () => {
    stopCurrentAudio(currentAmbientAudio);
    stopCurrentAudio(previewAudioRef);
    setCurrentAmbientAudio(null);
    setPreviewAudioRef(null);
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-8 space-y-8 pb-10">
      
      {/* 顶部标题 */}
      <div>
        <h3 className="text-2xl font-black text-slate-800">专注设置</h3>
        <p className="text-slate-500 text-sm mt-1">定制你的节奏、音效与沉浸氛围。</p>
      </div>

      {/* =================================================================
          板块 1: 时间节奏 (Time & Rhythm)
         ================================================================= */}
      <section className="space-y-3">
        <SectionHeader title="时间节奏" icon={<Hourglass size={14}/>} />
        
        <div className="bg-white/60 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-sm space-y-6">
           
           {/* 1. 专注时长 */}
           <TimeSlider 
             label="专注时长" 
             value={focusTime} 
             onChange={setFocusTime} 
             min={5} max={90} step={5}
             color="text-indigo-600"
             icon={<Zap size={16} />}
           />

           {/* 2. 短休息时长 (解决你的痛点) */}
           <TimeSlider 
             label="短休息" 
             value={shortBreak} 
             onChange={setShortBreak} 
             min={1} max={15} step={1}
             color="text-emerald-600"
             icon={<Coffee size={16} />}
           />

           {/* 3. 长休息时长 */}
           <TimeSlider 
             label="长休息" 
             value={longBreak} 
             onChange={setLongBreak} 
             min={10} max={45} step={5}
             color="text-blue-600"
             icon={<Coffee size={16} className="text-blue-600" />} // 复用图标但换色
           />
           
           {/* 4. 长休息间隔 */}
           <div className="flex items-center justify-between pt-2 border-t border-slate-100/50">
              <div className="text-sm font-bold text-slate-700">长休息间隔</div>
              <div className="flex items-center gap-3">
                 <span className="text-xs text-slate-400">每 {rounds} 个番茄后</span>
                 <div className="flex bg-white border border-slate-200 rounded-xl p-1">
                    {[3, 4, 5].map(n => (
                      <button 
                        key={n}
                        onClick={() => setRounds(n)}
                        className={`w-8 h-8 rounded-lg text-xs font-black transition-all
                          ${rounds === n ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
                      >
                        {n}
                      </button>
                    ))}
                 </div>
              </div>
           </div>

           {/* 5. 每周目标学习时长 */}
           <div className="pt-4 border-t border-slate-100/50">
             <TimeSlider 
               label="每周目标" 
               value={weekGoalHours} 
               onChange={setWeekGoalHours} 
               min={5} max={60} step={1}
               color="text-amber-600"
               icon={<Zap size={16} className="text-amber-600" />}
               unit="小时"
             />
           </div>
        </div>
      </section>

      {/* =================================================================
          板块 2 (新增): 沉浸白噪音 (Ambient Soundscapes)
         ================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionHeader title="沉浸白噪音" icon={<Waves size={14}/>} />
          {/* 自动播放开关 */}
          <div className="flex items-center gap-2 pr-2">
            <span className="text-[10px] font-bold text-slate-400">跟随专注自动播放</span>
            <Switch checked={autoPlayNoise} onChange={setAutoPlayNoise} />
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-xl p-5 rounded-3xl border border-white/50 shadow-sm space-y-5">
          {/* 白噪音选择网格 */}
          <div className="grid grid-cols-3 gap-3">
            {AMBIENT_OPTIONS.map(sound => {
              const isSelected = ambientSound === sound.id;
              const isPlaying = currentAmbientAudio && ambientSound === sound.id;
              return (
                <button
                  key={sound.id}
                  onClick={() => {
                    setAmbientSound(sound.id);
                    previewAmbientSound(sound.id);
                  }}
                  className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all duration-300 group
                    ${isSelected 
                      ? 'bg-white border-indigo-200 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500 ring-offset-2 ring-offset-white/60' 
                      : 'bg-white/30 border-transparent hover:bg-white hover:border-slate-200 hover:shadow-sm'}`}
                >
                  <div className={`transition-colors duration-300 ${isSelected ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                    {sound.icon}
                  </div>
                  <div className="text-center">
                    <div className={`text-xs font-bold ${isSelected ? 'text-slate-800' : 'text-slate-600'}`}>
                      {sound.name}
                    </div>
                    <div className="text-[10px] text-slate-400 scale-90 opacity-80">
                      {sound.desc}
                    </div>
                  </div>
                  
                  {/* 播放状态指示器 */}
                  {isPlaying && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  )}
                </button>
              )
            })}
          </div>

          {/* 白噪音控制按钮 */}
          {ambientSound !== 'none' && (
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => previewAmbientSound(ambientSound)}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <PlayCircle size={14} />
                预览
              </button>
              <button
                onClick={stopAmbientPreview}
                className="px-4 py-2 bg-slate-600 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors"
              >
                停止
              </button>
            </div>
          )}

          {/* 白噪音音量 (仅当选择了声音时显示) */}
          {ambientSound !== 'none' && (
            <div className="flex items-center gap-4 pt-2 animate-in fade-in slide-in-from-top-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
                <Waves size={16} />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                  <span>背景音量</span>
                  <span>{ambientVolume}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={ambientVolume}
                  onChange={(e) => {
                    const newVolume = Number(e.target.value);
                    setAmbientVolume(newVolume);
                    // 实时更新当前播放的白噪音音量
                    if (currentAmbientAudio) {
                      currentAmbientAudio.volume = newVolume / 100;
                    }
                  }}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =================================================================
          板块 3: 音效与反馈 (Sound & Haptics)
         ================================================================= */}
      <section className="space-y-3">
        <SectionHeader title="完成音效" icon={<Music size={14}/>} />

        <div className="bg-white/60 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-sm space-y-6">
           
           {/* 音效选择网格 */}
           <div className="grid grid-cols-2 gap-3">
              {SOUND_OPTIONS.map(sound => {
                const isSelected = selectedSound === sound.id;
                return (
                  <button
                    key={sound.id}
                    onClick={() => { 
                      setSelectedSound(sound.id); 
                      previewNotificationSound(sound.id); 
                    }}
                    className={`relative flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 text-left group
                      ${isSelected 
                        ? 'bg-white border-indigo-200 shadow-md ring-1 ring-indigo-500/20' 
                        : 'bg-white/40 border-transparent hover:bg-white hover:border-slate-200'}`}
                  >
                    <div className="text-xl">{sound.icon}</div>
                    <div className="flex-1">
                      <div className={`text-sm font-bold ${isSelected ? 'text-slate-800' : 'text-slate-600'}`}>
                        {sound.name}
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 size={16} className="text-indigo-600 animate-in zoom-in" />}
                    
                    {/* 悬浮播放按钮 */}
                    {!isSelected && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-3 text-slate-400">
                        <PlayCircle size={16} />
                      </div>
                    )}
                  </button>
                )
              })}
           </div>

           {/* 音量控制 */}
           <div className="flex items-center gap-4 pt-2">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                <Volume2 size={20} />
              </div>
              <div className="flex-1 space-y-2">
                 <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>提示音量</span>
                    <span>{volume}%</span>
                 </div>
                 <input 
                    type="range" min="0" max="100" 
                    value={volume}
                    onChange={(e) => {
                      const newVolume = Number(e.target.value);
                      setVolume(newVolume);
                      // 实时更新当前播放的完成音效音量
                      if (currentNotificationAudio) {
                        currentNotificationAudio.volume = newVolume / 100;
                      }
                    }}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-600"
                 />
              </div>
           </div>
        </div>
      </section>

      {/* =================================================================
          板块 4: 自动化 (Automation)
         ================================================================= */}
      <section className="space-y-3">
        <SectionHeader title="自动化" icon={<Zap size={14}/>} />
        
        <div className="bg-white/60 backdrop-blur-xl rounded-3xl border border-white/50 shadow-sm overflow-hidden divide-y divide-slate-100">
           <div className="p-5 flex items-center justify-between hover:bg-white/40 transition-colors">
              <div>
                 <div className="font-bold text-slate-700 text-sm">自动开始休息</div>
                 <div className="text-[11px] text-slate-400">专注结束后自动进入休息计时</div>
              </div>
              <Switch checked={autoStartBreak} onChange={setAutoStartBreak} />
           </div>
        </div>
      </section>

    </div>
  );
};

// ----------------------------------------------------------------------
// 🧩 辅助组件 (Styled Components)
// ----------------------------------------------------------------------

// 1. 板块标题
const SectionHeader = ({ title, icon }: any) => (
  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-2 flex items-center gap-2">
     {icon} {title}
  </h4>
);

// 2. 时间滑块 (带数值气泡)
const TimeSlider = ({ label, value, onChange, min, max, step, color, icon, unit = '分钟' }: any) => (
  <div className="space-y-3">
     <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
           {icon} {label}
        </div>
        <span className={`text-xs font-black px-2 py-0.5 rounded-md bg-white border border-slate-100 shadow-sm ${color}`}>
           {value} {unit}
        </span>
     </div>
     <div className="relative h-6 flex items-center">
        {/* 背景轨道 */}
        <div className="absolute w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
           <div 
             className="h-full bg-current opacity-20" 
             style={{ width: `${((value - min) / (max - min)) * 100}%`, color: 'currentColor' }} 
           />
        </div>
        {/* 原生滑块覆盖 */}
        <input 
          type="range" min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`relative w-full h-1.5 bg-transparent appearance-none cursor-pointer z-10 focus:outline-none 
            [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full 
            [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:shadow-md 
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110`}
          style={{ accentColor: 'transparent' }} // 隐藏默认颜色，使用 CSS 自定义
        />
        {/* 滑块颜色动态注入 (Tailwind 无法动态改 accent-color，这里用 style hack 或 class 映射) */}
        <style>{`
          input[type=range]::-webkit-slider-thumb { border-color: currentColor; }
        `}</style>
        <div className={`absolute top-0 left-0 w-full h-full pointer-events-none ${color}`} />
     </div>
     <div className="flex justify-between text-[10px] text-slate-300 font-bold px-1 select-none">
        <span>{min}{unit === '小时' ? 'h' : 'm'}</span>
        <span>{max}{unit === '小时' ? 'h' : 'm'}</span>
     </div>
  </div>
);

// 3. 开关
const Switch = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
  <button 
    onClick={() => onChange(!checked)}
    className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 relative focus:outline-none
      ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
  >
    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 flex items-center justify-center
      ${checked ? 'translate-x-4' : 'translate-x-0'}`} 
    />
  </button>
);