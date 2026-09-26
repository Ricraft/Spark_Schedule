import React, { useState, useEffect, useRef } from 'react';
import { 
  DownloadCloud, PlusCircle, X, Globe, FileJson, 
  ChevronRight, Save, Trash2, Clock, BookOpen, StickyNote,
  Check, Calendar, Palette, FileSpreadsheet, FileCode, Grid3X3
} from 'lucide-react';
import { Minus, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { findMatchingGroups } from '../utils/courseGrouping';
import { useSettingsBridge } from '../hooks/useSettingsBridge';
import { Course } from '../types/Course';
import { useBrowserPositionSync } from '../hooks/useBrowserPositionSync';

type TabType = 'import' | 'manual';

interface CourseManagerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Course | null; // 允许 null
  onSave?: (courseData: Course) => void; 
  onDelete?: (courseId: string) => void;
  onRefresh?: () => void; 
  courseGroups?: any[]; 
}

export const CourseManagerPanel = ({ 
  isOpen, 
  onClose, 
  initialData, 
  onSave, 
  onDelete,
  onRefresh, 
  courseGroups = [] 
}: CourseManagerPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialData ? 'manual' : 'import');

  // 当 initialData 变化时，如果存在数据则切到手动编辑模式
  useEffect(() => {
    if (initialData) {
      setActiveTab('manual');
    }
  }, [initialData]);

  // 关闭时同时隐藏浏览器
  const handleClose = () => {
    if ((window as any).pyBridge && (window as any).pyBridge.hide_web_browser_view) {
      (window as any).pyBridge.hide_web_browser_view();
    }
    onClose();
  };

  // 1. 新增滚动事件处理
  const handleScroll = () => {
    // 发送一个自定义事件，让子组件监听
    window.dispatchEvent(new Event('panel-scroll'));
  };
  
  return (
    <>
      <div 
        className={`fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px] transition-all duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={handleClose}
      />

      <div className={`fixed top-0 right-0 h-full w-[800px] z-50 flex shadow-[-20px_0_50px_rgba(0,0,0,0.15)] 
        transition-all duration-700 cubic-bezier(0.2, 0.8, 0.2, 1)
        ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        bg-white/80 backdrop-blur-3xl border-l border-white/50 ring-1 ring-white/60
        hover:shadow-[-25px_0_60px_rgba(0,0,0,0.2)] hover:bg-white/85`}>
        
        {/* 左侧导航 */}
        <div className="w-[220px] flex flex-col bg-slate-50/50 border-r border-white/20 pt-10 px-4 space-y-3">
          <h2 className="text-xl font-black text-slate-800 px-2 mb-8 tracking-tight flex items-center gap-2
            animate-in slide-in-from-left-4 duration-500 delay-200">
            <span className="w-2 h-6 bg-indigo-600 rounded-full animate-pulse-slow"/> 课程管理
          </h2>
          
          <div className="animate-in slide-in-from-left-4 duration-500 delay-300">
            <NavButton 
              active={activeTab === 'import'} 
              onClick={() => {
                setActiveTab('import');
                // 切换回来时可能需要重新显示浏览器，交给子组件处理
              }}
              icon={<Globe size={18} />}
              label="智能导入"
              desc="浏览器 / 文件"
            />
          </div>
          <div className="animate-in slide-in-from-left-4 duration-500 delay-400">
            <NavButton 
              active={activeTab === 'manual'} 
              onClick={() => {
                setActiveTab('manual');
                // 切换走时隐藏浏览器
                if ((window as any).pyBridge) (window as any).pyBridge.hide_web_browser_view();
              }}
              icon={<PlusCircle size={18} />}
              label="课程编辑"
              desc="手动 / 配色"
            />
          </div>
        </div>

        {/* 右侧内容 */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white/40 relative">
          <button onClick={handleClose} className="absolute top-6 right-6 z-10 p-2 hover:bg-slate-200/60 rounded-full 
            transition-all duration-200 hover:scale-110 active:scale-95 hover:rotate-90
            animate-in slide-in-from-right-4 duration-500 delay-100">
            <X size={20} className="text-slate-500" />
          </button>

          <div className="flex-1 p-10 overflow-y-auto custom-scrollbar animate-in slide-in-from-right-6 duration-700 delay-200" onScroll={handleScroll}>
            {activeTab === 'import' ? (
              <ImportBrowserView 
                isOpen={isOpen && activeTab === 'import'} 
                onSuccess={() => {
                  // ✅ 导入成功后不需要手动刷新
                  // useScheduleBridge 已通过 scheduleDataUpdated 事件自动更新
                  console.log('✅ 导入成功，数据已通过事件自动更新');
                }}
                onClose={handleClose}
              />
            ) : (
              <DetailedCourseEditor 
                key={initialData?.id || 'new'}
                initialData={initialData || undefined}
                onSave={onSave}
                onDelete={onDelete}
                onClose={handleClose}
                courseGroups={courseGroups}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// --- 通用导航按钮 ---
const NavButton = ({ active, onClick, icon, label, desc }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all duration-300 group
      hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]
      ${active 
        ? 'bg-white shadow-lg shadow-indigo-500/10 ring-1 ring-white scale-[1.02] animate-glow' 
        : 'hover:bg-white/60 hover:scale-[1.01]'}`}
  >
    <div className={`p-2.5 rounded-xl transition-all duration-300 ${
      active ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 text-slate-500 group-hover:text-indigo-600 group-hover:bg-indigo-100'
    } group-hover:scale-110 group-active:scale-95`}>
      {icon}
    </div>
    <div>
      <div className={`text-sm font-bold transition-colors duration-200 ${active ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-700'}`}>{label}</div>
      <div className="text-[10px] text-slate-400 font-medium">{desc}</div>
    </div>
  </button>
);

// =========================================================================
// 视图 1: 导入中心 (整合教务、文件、备份)
// =========================================================================
const ImportBrowserView = ({ isOpen, onSuccess, onClose }: { isOpen: boolean, onSuccess?: () => void, onClose?: () => void }) => {
  const [url, setUrl] = useState('http://jwxt.univ.edu.cn');
  const [importStatus, setImportStatus] = useState<string>('');
  const [isBrowserActive, setIsBrowserActive] = useState(false);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const initialBrowserUrlRef = useRef<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const extractTimeoutRef = useRef<number | null>(null);
  const [isFileDialogOpen, setIsFileDialogOpen] = useState(false); // 🔥 新增：文件对话框状态

  // 获取 Python Bridge
  const bridge = (window as any).pyBridge;

  // 🔥 监听导入进度信号，自动关闭面板
  useEffect(() => {
    if (!bridge || !isOpen) return;

    const handleImportProgress = (msg: string) => {
      console.log('📡 [ImportBrowserView] 收到导入进度:', msg);
      setImportStatus(msg);
      
      // 检查是否导入成功
      if (msg.includes('✨ 成功导入') || msg.includes('🗑️ 课表已清空')) {
        console.log('✅ [ImportBrowserView] 导入/清空完成，准备关闭面板');
        setIsFileDialogOpen(false);
        
        // 延迟关闭面板，让用户看到成功提示
        setTimeout(() => {
          if (onClose) {
            console.log('🚪 [ImportBrowserView] 自动关闭面板');
            onClose();
          }
        }, 1500);
      }
    };

    // 连接信号
    if (bridge.importProgress && typeof bridge.importProgress.connect === 'function') {
      bridge.importProgress.connect(handleImportProgress);
      console.log('✅ [ImportBrowserView] 已连接 importProgress 信号');
    }

    return () => {
      // 断开信号
      if (bridge.importProgress && typeof bridge.importProgress.disconnect === 'function') {
        bridge.importProgress.disconnect(handleImportProgress);
        console.log('🔌 [ImportBrowserView] 已断开 importProgress 信号');
      }
    };
  }, [bridge, isOpen, onClose]);

  useBrowserPositionSync({
    enabled: isBrowserActive && isOpen,
    elementRef: placeholderRef,
    bridge,
    initialUrlRef: initialBrowserUrlRef,
  });

  useEffect(() => {
    return () => {
      if (bridge && typeof bridge.hide_web_browser_view === 'function') {
        bridge.hide_web_browser_view();
      }
      if (extractTimeoutRef.current) clearTimeout(extractTimeoutRef.current);
    };
  }, []);

  const handleLaunchBrowser = () => {
    initialBrowserUrlRef.current = url;
    setIsBrowserActive(true);
    setImportStatus('浏览器已启动，请登录后导航至课表页面...');
  };

  const handleExtract = async () => {
    if (!isBrowserActive || !bridge) return;
    setIsExtracting(true);
    setImportStatus('正在提取页面内容...');
    try {
      const resultStr = await bridge.extract_schedule_from_browser();
      const result = JSON.parse(resultStr);
      if (result.status === 'processing' || result.status === 'success') {
        setImportStatus('⏳ 正在解析并保存...');
        extractTimeoutRef.current = window.setTimeout(() => {
          setImportStatus('✅ 导入完成！');
          setIsExtracting(false);
          if (onSuccess) onSuccess();
          // 🔥 不再发送空事件，数据已通过 scheduleLoaded 信号传递
        }, 2500);
      }
    } catch (e) {
      setImportStatus(`❌ 提取失败: ${e}`);
      setIsExtracting(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-8 pb-10">
      <div className="animate-in slide-in-from-top-4 duration-500">
        <h3 className="text-2xl font-black text-foreground tracking-tight">导入中心</h3>
        <p className="text-muted-foreground text-sm mt-1 font-medium">支持教务系统自动识别、文件导入及备份恢复。</p>
      </div>

      {/* --- Section 1: 教务系统 --- */}
      <div className="space-y-4">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <Globe size={12} className="text-primary" /> 教务系统自动导入
        </h4>
        
        <div className="flex gap-2 bg-card/60 p-2 rounded-2xl shadow-sm border border-border/50 
          hover:shadow-md transition-all duration-300">
          <input 
            className="flex-1 bg-background/50 border-none rounded-xl px-4 py-2.5 text-sm font-mono text-foreground 
              focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="教务系统登录网址..."
          />
          {!isBrowserActive ? (
            <Button onClick={handleLaunchBrowser} className="bg-primary text-primary-foreground rounded-xl font-bold">
              启动浏览器
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => bridge?.load_url_in_browser(url)} className="text-slate-600 font-bold">前往</Button>
              <Button 
                onClick={handleExtract} 
                disabled={isExtracting}
                className="bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex gap-2"
              >
                {isExtracting ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"/> : <DownloadCloud size={16}/>}
                提取课表
              </Button>
            </div>
          )}
        </div>

        <div ref={placeholderRef} className={`aspect-[16/9] rounded-2xl border-2 border-dashed border-slate-200 
          relative overflow-hidden transition-all duration-500 bg-slate-50/30 flex items-center justify-center
          ${isBrowserActive ? 'bg-transparent border-indigo-100' : 'hover:border-indigo-200'}`}
        >
          {!isBrowserActive && (
            <div className="text-center text-slate-400 group">
              <Globe size={40} className="mx-auto mb-3 opacity-30 group-hover:scale-110 group-hover:text-indigo-500 transition-all duration-500" />
              <p className="text-xs font-bold tracking-tight">内嵌浏览器将在此区域激活</p>
            </div>
          )}
        </div>
      </div>

      {/* --- Section 2: 快速操作 --- */}
      <div className="grid grid-cols-2 gap-4">
        {/* 文件导入区域 */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <FileCode size={12} className="text-emerald-500" /> 本地文件导入
          </h4>
          <div className="grid grid-cols-1 gap-2">
            <FileImportCard 
              title="Excel 导入" desc="支持 .xls / .xlsx" 
              icon={<FileSpreadsheet size={18} />} colorClass="bg-emerald-100 text-emerald-600"
              onClick={() => {
                setIsFileDialogOpen(true);
                setImportStatus('📂 请在文件对话框中选择 Excel 文件...');
                bridge?.trigger_excel_import();
                // 10秒后自动清除状态（防止用户取消选择后状态卡住）
                setTimeout(() => {
                  setIsFileDialogOpen(false);
                  setImportStatus('');
                }, 10000);
              }}
              disabled={isFileDialogOpen}
            />
            <FileImportCard 
              title="HTML 导入" desc="Coming Soon 🚀" 
              icon={<FileCode size={18} />} colorClass="bg-gray-100 text-gray-400"
              onClick={() => {
                setImportStatus('🚀 HTML 导入功能即将上线，敬请期待！');
                setTimeout(() => {
                  setImportStatus('');
                }, 3000);
              }}
              disabled={false}
              comingSoon={true}
            />
          </div>
        </div>

        {/* 备份与管理区域 */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <FileJson size={12} className="text-amber-500" /> 备份与清空
          </h4>
          <div className="grid grid-cols-1 gap-2">
            <FileImportCard 
              title="JSON 恢复" desc="Coming Soon 🚀" 
              icon={<FileJson size={18} />} colorClass="bg-gray-100 text-gray-400"
              onClick={() => {
                setImportStatus('🚀 JSON 导入功能即将上线，敬请期待！');
                setTimeout(() => {
                  setImportStatus('');
                }, 3000);
              }}
              disabled={false}
              comingSoon={true}
            />
            <FileImportCard 
              title="清空并新建" desc="重置为一个空课表" 
              icon={<Trash2 size={18} />} colorClass="bg-red-100 text-red-600"
              onClick={async () => {
                if(confirm("确定要新建空白课表吗？这将清空当前所有课程且无法撤销。")) {
                  try {
                    console.log('🗑️ [CourseManagerPanel] 开始清空课表');
                    setImportStatus('🗑️ 正在清空课表...');
                    await bridge?.clear_all_courses();
                    
                    // 等待后端处理完成
                    setTimeout(() => {
                      console.log('✅ [CourseManagerPanel] 清空完成，关闭面板');
                      setImportStatus('');
                      onClose(); // 关闭面板
                    }, 1000);
                  } catch (error) {
                    console.error('❌ [CourseManagerPanel] 清空失败:', error);
                    setImportStatus('');
                    alert('清空失败，请重试');
                  }
                }
              }}
              disabled={isFileDialogOpen}
            />
          </div>
        </div>
      </div>

      {importStatus && (
        <div className="bg-slate-900/5 p-3 rounded-xl border border-slate-200/50">
          <p className="text-[11px] font-black text-slate-600 flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse-slow" />
            状态：{importStatus}
          </p>
        </div>
      )}
      
      {/* 🔥 文件对话框遮罩 */}
      {isFileDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md mx-4 animate-in zoom-in duration-300">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <h3 className="text-xl font-black text-slate-800">请选择文件</h3>
              <p className="text-sm text-slate-500 text-center">
                文件选择对话框已打开<br/>
                请在系统窗口中选择要导入的文件
              </p>
              <p className="text-xs text-slate-400 mt-2">
                如果看不到对话框，请检查任务栏或最小化的窗口
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 📦 复用组件：文件导入卡片
const FileImportCard = ({ title, desc, icon, colorClass, onClick, disabled, comingSoon }: any) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center gap-3 p-4 relative ${
          disabled 
            ? 'bg-gray-100 cursor-not-allowed opacity-50' 
            : comingSoon
            ? 'bg-gray-50/60 cursor-pointer hover:bg-gray-100/80'
            : 'bg-white/40 hover:bg-white hover:shadow-lg'
        } rounded-2xl border border-transparent ${
          !comingSoon && 'hover:border-slate-200'
        } transition-all text-left group`}
    >
        {comingSoon && (
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[9px] font-black rounded-full shadow-sm animate-pulse-slow">
            SOON
          </div>
        )}
        <div className={`w-10 h-10 rounded-full ${colorClass} flex items-center justify-center ${
          !disabled && !comingSoon && 'group-hover:scale-110'
        } transition-transform`}>
            {icon}
        </div>
        <div>
            <div className={`font-bold text-sm ${comingSoon ? 'text-gray-500' : 'text-slate-700'}`}>{title}</div>
            <div className={`text-[10px] ${comingSoon ? 'text-gray-400' : 'text-slate-400'}`}>{desc}</div>
        </div>
    </button>
);


// =========================================================================
// 视图 2: 课程编辑 (包含自定义取色器)
// =========================================================================
interface DetailedCourseEditorProps {
  initialData?: Course | null;
  onSave?: (courseData: Course) => void;
  onDelete?: (courseId: string) => void;
  onClose?: () => void;
  courseGroups?: any[]; // 新增：课程分组数据
}

const DetailedCourseEditor = ({ initialData, onSave, onDelete, onClose, courseGroups = [] }: DetailedCourseEditorProps) => {
  // 使用 initialData 初始化表单状态
  const [courseName, setCourseName] = useState(initialData?.name || '');
  const [teacher, setTeacher] = useState(initialData?.teacher || '');
  const [location, setLocation] = useState(initialData?.location || '');
  const [weeks, setWeeks] = useState<number[]>(initialData?.weeks || [1,2,3,4,5,6,7,8]);
  const [color, setColor] = useState(initialData?.color || '#9B8FAA'); 
  const [day, setDay] = useState(initialData?.day || 1); // 1 = 周一
  const [startNode, setStartNode] = useState(initialData?.start || 1); // 第1节
  const [step, setStep] = useState(initialData?.duration || 2); // 持续2节
  const [credit, setCredit] = useState(initialData?.credit || 3);
  const [note, setNote] = useState(initialData?.note || '');
  
  // 使用设置桥接钩子
  const { settings: backendSettings } = useSettingsBridge();
  
  // 动态获取学期总周数和每天节次
  const maxWeeks = backendSettings?.semester_weeks || 25;
  const maxSections = backendSettings?.sections_per_day || 12;
  const totalWeeks = Array.from({length: maxWeeks}, (_, i) => i + 1);

  // 当学期设置变化时，调整已选择的周数
  useEffect(() => {
    if (backendSettings) {
      setWeeks(prev => prev.filter(w => w <= maxWeeks));
    }
  }, [backendSettings, maxWeeks]);

  // 预设莫兰迪色系（低饱和度、优雅沉稳）
  const presetColors = [
      '#9B8FAA', '#D4A5A5', '#8FA5B8', '#A5B8A5', '#D4B896', '#9B8FB8', '#C89B9B', '#8FB8B8'
  ];

  // 保存处理
  const handleSave = () => {
    const courseData: Course = {
      id: initialData?.id || `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: courseName,
      teacher,
      location,
      weeks,
      day,
      start: startNode,
      duration: step,
      color,
      credit,
      note,
      groupId: initialData?.groupId || (window as any)._pendingGroupId
    };
    
    // 清理临时状态
    delete (window as any)._pendingGroupId;
    
    console.log('💾 保存课程数据:', courseData);
    if (onSave) {
      onSave(courseData);
    }
    
    // 🔥 保存成功后自动关闭面板
    if (onClose) {
      setTimeout(() => {
        onClose();
      }, 300); // 延迟300ms，让用户看到保存动画
    }
  };

  // 删除处理
  const handleDelete = () => {
    if (initialData?.id && onDelete) {
      onDelete(initialData.id);
      // 删除后自动关闭编辑面板
      if (onClose) {
        onClose();
      }
    }
  };

  const toggleWeek = (w: number) => {
    setWeeks(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8 pb-20">
      <div className="flex justify-between items-end animate-in slide-in-from-top-4 duration-500">
        <div>
          <h3 className="text-2xl font-black text-slate-800">
            {initialData ? '编辑课程' : '新建课程'}
          </h3>
          <p className="text-slate-500 text-sm mt-1">编辑课程的详细时间与外观属性。</p>
        </div>
        {initialData && (
          <button 
            onClick={handleDelete}
            className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 hover:scale-110 
              active:scale-95 transition-all duration-200 hover:shadow-md" 
            title="删除课程"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* 1. 基础信息 */}
      <div className="space-y-4 animate-in slide-in-from-left-4 duration-500 delay-100">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <BookOpen size={12} /> 基础信息
        </h4>
        <div className="grid grid-cols-2 gap-4">
           <div className="animate-in slide-in-from-left-4 duration-500 delay-200">
             <InputGroup 
               label="课程名称" 
               placeholder="例如：高等数学" 
               value={courseName}
               onChange={(e) => setCourseName(e.target.value)}
             />
           </div>
           <div className="animate-in slide-in-from-right-4 duration-500 delay-200">
             <InputGroup 
               label="任课教师" 
               placeholder="例如：张教授" 
               value={teacher}
               onChange={(e) => setTeacher(e.target.value)}
             />
           </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
           <div className="col-span-2 animate-in slide-in-from-left-4 duration-500 delay-300">
             <InputGroup 
               label="上课地点" 
               placeholder="例如：第三教学楼 302" 
               icon={<Clock size={14}/>}
               value={location}
               onChange={(e) => setLocation(e.target.value)}
             />
           </div>
           <div className="animate-in slide-in-from-right-4 duration-500 delay-300">
             <InputGroup 
               label="学分" 
               placeholder="4.0" 
               type="number" 
               value={credit.toString()}
               onChange={(e) => setCredit(parseFloat(e.target.value) || 0)}
             />
           </div>
        </div>

        {/* 分组信息显示 */}
        {initialData?.groupId && courseGroups.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Grid3X3 size={16} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-800">课程分组管理</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-100"
                onClick={() => {
                  // 解除分组
                  if (onSave && initialData) {
                    const updatedCourse: Course = { ...initialData, groupId: undefined };
                    onSave(updatedCourse);
                  }
                }}
              >
                解除分组
              </Button>
            </div>
            {(() => {
              const group = courseGroups.find(g => g.id === initialData.groupId);
              return group ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: group.color }}
                    />
                    <div>
                      <div className="font-medium text-blue-800">{group.name}</div>
                      <div className="text-xs text-blue-600">
                        教师: {group.teacher} | 地点: {group.location}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-100/50 rounded-lg p-3">
                    <div className="text-xs text-blue-700 mb-2 font-medium">分组统计</div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-blue-600">课程数量:</span>
                        <span className="font-medium text-blue-800">{group.course_count || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">创建时间:</span>
                        <span className="font-medium text-blue-800">
                          {new Date(group.created_at || Date.now()).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center mt-0.5">
                        <span className="text-white text-xs font-bold">!</span>
                      </div>
                      <div className="text-xs text-amber-800">
                        <div className="font-medium mb-1">分组同步提醒</div>
                        <div>修改课程名称、教师或地点将同步更新该分组内的所有课程。颜色和时间安排可以单独设置。</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-blue-600">分组信息加载中...</div>
              );
            })()}
          </div>
        )}

        {/* 自动分组建议 */}
        {!initialData?.groupId && courseGroups.length > 0 && (courseName || teacher || location) && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Grid3X3 size={14} className="text-green-600" />
              <span className="text-sm font-medium text-green-800">智能分组建议</span>
            </div>
            {(() => {
              // 查找匹配的分组
              const matchingGroups = findMatchingGroups(
                { name: courseName, teacher, location }, 
                courseGroups
              );
              
              return matchingGroups.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-green-700 mb-2">
                    发现 {matchingGroups.length} 个可能匹配的分组:
                  </div>
                  {matchingGroups.slice(0, 3).map(group => (
                    <div 
                      key={group.id}
                      className="flex items-center justify-between bg-white/60 rounded-lg p-2"
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: group.color }}
                        />
                        <div className="text-xs">
                          <div className="font-medium text-green-800">{group.name}</div>
                          <div className="text-green-600">{group.teacher} | {group.location}</div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-green-600 hover:bg-green-100"
                        onClick={() => {
                          // 🚀 核心修复：点击加入分组只更新本地表单状态，不自动退出
                          setCourseName(group.name);
                          setTeacher(group.teacher);
                          setLocation(group.location);
                          setColor(group.color);
                          // 这里不直接调用 onSave，而是等待用户点击最后的“保存”按钮
                          // 我们给当前编辑的对象打上 groupId 标记
                          if (initialData) {
                            initialData.groupId = group.id;
                          } else {
                            // 如果是新建，我们可以用一个 ref 或临时状态存一下 groupId
                            (window as any)._pendingGroupId = group.id;
                          }
                          alert(`已应用 "${group.name}" 的分组信息，请继续编辑或点击下方保存。`);
                        }}
                      >
                        加入
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-green-600">
                  当前课程信息将创建新的分组。相同名称、教师和地点的课程会自动归类到一起。
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* 2. 外观配色 */}
      <div className="space-y-4 animate-in slide-in-from-right-4 duration-500 delay-400">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
           <Palette size={12} /> 课程配色
        </h4>
        <div className="bg-white/50 p-4 rounded-xl border border-white flex flex-wrap gap-3 items-center
          hover:bg-white/70 hover:shadow-md transition-all duration-200">
            {presetColors.map((c, index) => (
                <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all duration-200 hover:scale-125 flex items-center justify-center
                        animate-in zoom-in duration-300
                        ${color === c ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110 shadow-md' : 'ring-1 ring-white/50 hover:shadow-lg'}`}
                    style={{ 
                      backgroundColor: c,
                      animationDelay: `${500 + index * 50}ms`
                    }}
                >
                    {color === c && <Check size={14} className="text-white animate-in zoom-in duration-200" strokeWidth={3} />}
                </button>
            ))}
            <div className="w-[1px] h-8 bg-slate-300 mx-1"></div>
            <div className="relative group overflow-hidden rounded-full w-8 h-8 ring-1 ring-slate-200 cursor-pointer
              hover:scale-125 hover:shadow-lg transition-all duration-200 animate-in zoom-in duration-300 delay-700">
                <input 
                    type="color" 
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="w-full h-full" style={{background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)'}} />
            </div>
        </div>
      </div>

      {/* 3. 时间与周数 (现代化重构重点) */}
      <div className="space-y-6">
        {/* A. 上课周数选择 */}
        <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Calendar size={12} /> 上课周数 (最多第 {maxWeeks} 周)
              </h4>
              <div className="flex bg-slate-100 p-1 rounded-lg scale-90 origin-right">
                {['全选', '单周', '双周'].map((label) => (
                    <button 
                      key={label} 
                      className="px-3 py-1 text-[10px] font-bold text-slate-500 hover:bg-white hover:shadow-sm rounded-md transition-all"
                      onClick={() => {
                        if (label === '全选') {
                          setWeeks(Array.from({length: maxWeeks}, (_, i) => i + 1)); // 使用动态周数
                        } else if (label === '单周') {
                          // 选择所有单数周，但不超过maxWeeks
                          const oddWeeks = [];
                          for (let i = 1; i <= maxWeeks; i += 2) {
                            oddWeeks.push(i);
                          }
                          setWeeks(oddWeeks);
                        } else if (label === '双周') {
                          // 选择所有双数周，但不超过maxWeeks
                          const evenWeeks = [];
                          for (let i = 2; i <= maxWeeks; i += 2) {
                            evenWeeks.push(i);
                          }
                          setWeeks(evenWeeks);
                        }
                      }}
                    >
                      {label}
                    </button>
                ))}
              </div>
            </div>
            {/* 网格布局 */}
            <div className="grid grid-cols-10 gap-2">
              {totalWeeks.map(w => {
                const isSelected = weeks.includes(w);
                return (
                  <button
                    key={w}
                    onClick={() => toggleWeek(w)}
                    className={`aspect-square rounded-lg text-xs font-bold flex items-center justify-center transition-all duration-200
                      ${isSelected 
                        ? 'text-white shadow-md shadow-indigo-200 scale-105' 
                        : 'bg-white border border-slate-100 text-slate-300 hover:border-indigo-300 hover:text-indigo-500'}`}
                    style={{ backgroundColor: isSelected ? color : undefined }}
                  >
                    {w}
                  </button>
                )
              })}
            </div>
        </div>

        {/* B. 星期、节次、时长 (完全移除 Dropdown) */}
        <div className="bg-white/60 p-5 rounded-2xl ring-1 ring-white space-y-5">
            
            {/* 1. 星期选择器 (Day Picker) */}
            <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">选择星期</label>
                <div className="flex justify-between bg-slate-100/50 p-1 rounded-xl">
                    {['一','二','三','四','五','六','日'].map((d, index) => {
                        const val = index + 1;
                        const active = day === val;
                        return (
                            <button
                                key={val}
                                onClick={() => setDay(val)}
                                className={`w-10 h-10 rounded-lg text-sm font-bold transition-all duration-300
                                    ${active ? 'bg-white text-indigo-600 shadow-md scale-105 ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600 hover:bg-white/40'}`}
                            >
                                {d}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* 2. 开始节次 (Start Node) - 弹性布局以支持更多节次显示 */}
                <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] flex items-center gap-2">
                      <Clock size={12} className="stroke-[2.5px]" /> 选择开始节次
                    </label>
                    <div className="flex flex-wrap gap-2 animate-in fade-in duration-500">
                        {Array.from({length: maxSections}, (_, i) => i + 1).map(n => (
                            <button
                                key={n}
                                onClick={() => setStartNode(n)}
                                className={`w-11 h-11 rounded-xl text-sm font-black border-2 transition-all duration-300
                                    ${startNode === n 
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-[0_4px_12px_rgba(99,102,241,0.2)]' 
                                        : 'border-slate-100 bg-white/60 text-slate-400 hover:border-indigo-200 hover:text-indigo-500 hover:bg-white'}`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. 持续节数 (Duration) - 步进器 */}
                <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] flex items-center gap-2">
                      <PlusCircle size={12} className="stroke-[2.5px]" /> 持续时长 (节)
                    </label>
                    <div className="flex items-center bg-white/60 border-2 border-slate-100 rounded-xl p-1.5 w-max">
                        <button 
                            onClick={() => setStep(Math.max(1, step - 1))}
                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all active:scale-90"
                        >
                            <Minus size={18} strokeWidth={3} />
                        </button>
                        <span className="text-lg font-black text-slate-700 min-w-[4rem] text-center select-none tabular-nums">
                            {step}
                        </span>
                        <button 
                            onClick={() => setStep(Math.min(maxSections - startNode + 1, step + 1))}
                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all active:scale-90"
                        >
                            <Plus size={18} strokeWidth={3} />
                        </button>
                    </div>
                </div>
            </div>
            
            {/* 可视化预览条 (Optional Polish) */}
            <div className="pt-2 flex flex-col gap-3">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Grid3X3 size={10} /> Time Preview
                </div>
                <div className="w-full h-3 bg-slate-100/50 rounded-full overflow-hidden flex shadow-inner border border-slate-200/20">
                    {/* 空白占位 */}
                    <div style={{ flex: startNode - 1 }} className="transition-all duration-500" />
                    {/* 课程条 */}
                    <div style={{ flex: step, backgroundColor: color }} className="rounded-full shadow-lg transition-all duration-500" />
                    {/* 剩余占位 */}
                    <div style={{ flex: Math.max(0, maxSections - (startNode - 1) - step) }} className="transition-all duration-500" />
                </div>
                <div className="flex justify-between px-1">
                  <span className="text-[9px] font-bold text-slate-300">1</span>
                  <span className="text-[9px] font-bold text-slate-300">{maxSections}</span>
                </div>
            </div>
        </div>
      </div>

      {/* 4. 备注 */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
           <StickyNote size={12} /> 备注
        </h4>
        <textarea 
          className="w-full h-24 bg-white/50 border border-slate-200 rounded-xl p-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none transition-all"
          placeholder="例如：单周在实验室，双周在教室... or 君の名は"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* 底部保存 */}
      <div className="sticky bottom-0 pt-4 pb-8 bg-gradient-to-t from-white/90 to-transparent">
        <button 
            onClick={handleSave}
            className="w-full text-white py-3.5 rounded-xl font-bold shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-[0.98] hover:brightness-110"
            style={{ backgroundColor: color }}
        >
          <Save size={18} /> {initialData ? '保存修改' : '保存课程设置'}
        </button>
      </div>
    </div>
  );
};

// --- 辅助 UI 组件 ---
const InputGroup = ({ label, placeholder, type = "text", icon, value, onChange }: any) => (
  <div className="space-y-1.5 group">
    <label className="text-[10px] font-bold text-slate-400 ml-1 flex items-center gap-1 
      group-focus-within:text-indigo-600 transition-colors duration-200">
        {label} {icon}
    </label>
    <input 
      type={type}
      className="w-full bg-white/60 border border-slate-200 px-3 py-2.5 rounded-xl text-sm font-medium 
        outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 
        hover:bg-white/80 focus:bg-white focus:scale-[1.02]
        transition-all duration-200 placeholder:text-slate-300"
      placeholder={placeholder}
      value={value || ''}
      onChange={onChange}
    />
  </div>
);