import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, MoreVertical, Calendar, AlertCircle, Loader2, Check, Trash2, Sparkles } from "lucide-react";
import { TaskEditorPanel } from "@/components/TaskEditorPanel";
import { AITaskImportPanel } from "@/components/AITaskImportPanel";
import { useState, useMemo, useEffect } from "react";
import { useTasksBridge, Task } from "@/hooks/useTasksBridge";
import { useScheduleBridge } from "@/hooks/useScheduleBridge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Tasks = () => {
  const [isTaskEditorOpen, setIsTaskEditorOpen] = useState(false);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<'todo' | 'doing' | 'done'>('todo');
  const [filterMode, setFilterMode] = useState<'all' | 'exam' | 'homework' | 'personal'>('all');
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingStatus, setClearingStatus] = useState<'todo' | 'doing' | 'done' | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  
  // 使用任务 Bridge Hook（Hook 内部已经处理了初始化加载）
  const { tasks, loading, deleteTask, updateTaskStatus } = useTasksBridge();

  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;

      // 🌟 如果窗口缩小到移动端尺寸，自动关闭侧边栏
      if (newWidth < 768 && windowSize.width >= 768 && isTaskEditorOpen) {
        setIsTaskEditorOpen(false);
        console.log('📱 窗口缩小，自动关闭任务编辑面板');
      }

      setWindowSize({ width: newWidth, height: newHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [windowSize.width, isTaskEditorOpen]);

  // 根据窗口宽度决定布局
  const isMobile = windowSize.width < 768;
  const isTablet = windowSize.width >= 768 && windowSize.width < 1024;
  const isDesktop = windowSize.width >= 1024;

  // 打开新建任务面板
  const handleNewTask = (status?: 'todo' | 'doing' | 'done') => {
    setEditingTask(null);
    setDefaultStatus(status || 'todo');
    setIsTaskEditorOpen(true);
  };

  // 打开编辑任务面板
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskEditorOpen(true);
  };

  // 批量删除指定状态的任务
  const handleClearTasks = async (status: 'todo' | 'doing' | 'done') => {
    const tasksToDelete = filteredTasks.filter(t => t.status === status);
    
    if (tasksToDelete.length === 0) {
      return;
    }

    // 显示确认对话框
    setClearingStatus(status);
    setShowClearConfirm(true);
  };

  // 执行清空操作
  const executeClearTasks = async () => {
    if (!clearingStatus) return;

    const tasksToDelete = filteredTasks.filter(t => t.status === clearingStatus);
    const statusText = clearingStatus === 'todo' ? '待办' : clearingStatus === 'doing' ? '进行中' : '已完成';

    try {
      setIsClearing(true);
      // 批量删除任务 - 使用 Promise.allSettled 防止部分失败导致整体失败
      const results = await Promise.allSettled(tasksToDelete.map(task => deleteTask(task.id)));

      const failed = results.filter(r => r.status === 'rejected');
      const succeeded = results.filter(r => r.status === 'fulfilled');

      if (failed.length > 0) {
        console.error(`❌ ${failed.length} 个任务删除失败:`, failed);
        alert(`删除完成：成功 ${succeeded.length} 个，失败 ${failed.length} 个`);
      } else {
        console.log(`✅ 已清空 ${tasksToDelete.length} 个${statusText}任务`);
      }

      setShowClearConfirm(false);
      setClearingStatus(null);
    } catch (error) {
      console.error('批量删除任务失败:', error);
      alert('删除任务失败，请重试');
    } finally {
      setIsClearing(false);
    }
  };



  // 过滤任务
  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    
    if (filterMode === 'exam') {
      // 考试
      filtered = tasks.filter(t => t.is_exam);
    } else if (filterMode === 'homework') {
      // 课程作业 (非考试 且 有绑定的课程ID)
      filtered = tasks.filter(t => !t.is_exam && t.course_id);
    } else if (filterMode === 'personal') {
      // 个人事务 (非考试 且 没有绑定课程ID)
      filtered = tasks.filter(t => !t.is_exam && !t.course_id);
    }
    
    return filtered;
  }, [tasks, filterMode]);

  // 格式化截止日期显示
  const formatDeadline = (deadline: string) => {
    if (!deadline) return '无截止日期';
    
    // 解析 YYYY-MM-DD 或 YYYY-MM-DD HH:mm
    const parts = deadline.split(' ');
    const dateStr = parts[0];
    const timeStr = parts[1];
    
    const deadlineDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadlineDate.setHours(0, 0, 0, 0);
    
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let result = '';
    if (diffDays < 0) result = `逾期 ${Math.abs(diffDays)} 天`;
    else if (diffDays === 0) result = '今天';
    else if (diffDays === 1) result = '明天';
    else if (diffDays <= 7) result = `${diffDays} 天后`;
    else result = dateStr;
    
    // 如果有具体时间，且是今天或明天，或者日期较近，附加上时间
    if (timeStr && (diffDays >= 0 && diffDays <= 7)) {
      result += ` ${timeStr}`;
    } else if (timeStr && diffDays < 0) {
      // 逾期任务也显示具体时间
      result += ` ${timeStr}`;
    }
    
    return result;
  };

  const columns = [
    { 
      title: "待办 (To Do)", 
      status: "todo" as const, 
      color: "bg-card/40 border-border/40 shadow-xl shadow-black/5",
      accent: "from-blue-500/10 to-indigo-500/10"
    },
    { 
      title: "进行中 (Doing)", 
      status: "doing" as const, 
      color: "bg-card/50 border-border/50 shadow-xl shadow-black/5",
      accent: "from-violet-500/10 to-purple-500/10"
    },
    { 
      title: "已完成 (Done)", 
      status: "done" as const, 
      color: "bg-card/60 border-border/60 shadow-xl shadow-black/5",
      accent: "from-emerald-500/10 to-teal-500/10"
    },
  ];

  // 🔥 移除加载屏幕 - 直接显示缓存的任务数据
  // Hook 会在后台静默加载最新数据，无需阻塞 UI

  return (
    <AppLayout title="任务集">
       <div className="h-full flex flex-col p-1 md:p-2 lg:p-4 relative overflow-hidden">
         {/* 底部 Mica 材质渐变遮罩 - 调整为更透明 */}
         <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none z-30 rounded-b-[3rem]">
           <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-background/40 via-50% via-background/20 via-75% to-transparent" />
         </div>
         
         {/* 顶部筛选栏 - 响应式，调整透明度 */}
         <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-center'} mb-4 md:mb-6 lg:mb-8 animate-in slide-in-from-top-4 duration-500`}>
            <div className={`flex ${isMobile ? 'flex-wrap' : 'gap-0'} bg-gradient-to-br from-card/40 via-card/30 to-card/20 p-1.5 md:p-2 rounded-[1.5rem] backdrop-blur-md border border-border/50 shadow-[0_8px_32px_rgba(0,0,0,0.08)] ${isMobile ? 'w-full' : 'w-full max-w-2xl mx-auto'} relative midnight:border-emerald-500/10`}>
              {/* 微妙的光泽效果 */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-50 pointer-events-none rounded-[1.5rem]" />
              
              {/* ✅ 优化的滑块轨道层 - 自动扣除父级 padding */}
              <div className="absolute inset-y-1.5 md:inset-y-2 left-1.5 md:left-2 right-1.5 md:right-2 z-0 pointer-events-none">
                <div 
                  className="absolute inset-y-0 w-1/4 bg-card/80 rounded-[1.25rem] shadow-[0_4px_20px_rgba(0,0,0,0.1)] transition-transform duration-500 ease-out midnight:bg-emerald-600/20"
                  style={{
                    transform: filterMode === 'all' ? 'translateX(0%)' : 
                               filterMode === 'exam' ? 'translateX(100%)' : 
                               filterMode === 'homework' ? 'translateX(200%)' : 
                               'translateX(300%)'
                  }}
                />
              </div>
              
              {/* 按钮部分 - 加上 whitespace-nowrap 防止文字换行 */}
              <Button 
                variant="ghost"
                className={`flex-1 rounded-[1.25rem] ${isMobile ? 'px-3 py-3 text-sm' : 'px-4 md:px-6 py-3.5 md:py-5'} font-bold transition-colors duration-500 relative z-10 whitespace-nowrap ${filterMode === 'all' ? 'text-primary midnight:text-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setFilterMode('all')}
              >
                全部
              </Button>
              <Button 
                variant="ghost"
                className={`flex-1 rounded-[1.25rem] ${isMobile ? 'px-3 py-3 text-sm' : 'px-4 md:px-6 py-3.5 md:py-5'} font-bold transition-colors duration-500 relative z-10 whitespace-nowrap ${filterMode === 'exam' ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setFilterMode('exam')}
              >
                {isMobile ? '考试' : '考试/DDL'}
              </Button>
              <Button 
                variant="ghost"
                className={`flex-1 rounded-[1.25rem] ${isMobile ? 'px-3 py-3 text-sm' : 'px-4 md:px-6 py-3.5 md:py-5'} font-bold transition-colors duration-500 relative z-10 whitespace-nowrap ${filterMode === 'homework' ? 'text-emerald-600' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setFilterMode('homework')}
              >
                {isMobile ? '作业' : '课程作业'}
              </Button>
              <Button 
                variant="ghost"
                className={`flex-1 rounded-[1.25rem] ${isMobile ? 'px-3 py-3 text-sm' : 'px-4 md:px-6 py-3.5 md:py-5'} font-bold transition-colors duration-500 relative z-10 whitespace-nowrap ${filterMode === 'personal' ? 'text-blue-500' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setFilterMode('personal')}
              >
                {isMobile ? '个人' : '个人事务'}
              </Button>
            </div>
            <div className={`flex items-center gap-3 ${isMobile ? 'w-full' : ''}`}>
              <Button 
                variant="outline"
                className={`rounded-[1.5rem] border-border/40 bg-card/30 backdrop-blur-md hover:bg-card/50 hover:scale-105 active:scale-95 transition-all duration-500 gap-2.5 shadow-sm ${isMobile ? 'flex-1 py-5' : 'px-5 md:px-7 py-4 md:py-6'} text-sm md:text-base font-bold text-primary midnight:text-emerald-500 midnight:border-emerald-500/20 group`}
                onClick={() => setIsAIPanelOpen(true)}
              >
                <Sparkles className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} stroke-[2.5px] text-primary midnight:text-emerald-500 group-hover:rotate-12 transition-transform`} /> 
                <span className="relative z-10">AI 智能导入</span>
              </Button>
              <Button 
                className={`rounded-[1.5rem] bg-gradient-to-br from-primary via-purple-500 to-pink-500 midnight:from-emerald-600 midnight:via-teal-600 midnight:to-teal-700 hover:scale-105 hover:shadow-[0_20px_60px_rgba(0,0,0,0.2)] active:scale-95 transition-all duration-500 gap-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.15)] border-none ${isMobile ? 'flex-1 py-5' : 'px-5 md:px-7 py-4 md:py-6'} text-sm md:text-base font-bold relative overflow-hidden group text-primary-foreground`}
                onClick={() => handleNewTask()}
              >
                {/* 动态光泽效果 */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                <Plus className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} stroke-[3px] relative z-10`} /> 
                <span className="relative z-10">新建任务</span>
              </Button>
            </div>
         </div>

         {/* 任务列表 - 响应式布局：使用 Grid 确保在平板及以上尺寸完整显示三个板块 */}
         <div className="flex-1 overflow-hidden pb-4 md:pb-6 min-h-0 relative z-10">
            <div className="w-full max-w-[1600px] mx-auto h-full px-1 md:px-4 lg:px-6">
              <div className={`h-full ${
                isMobile 
                  ? 'flex flex-col space-y-4 overflow-y-auto custom-scrollbar px-1' 
                  : 'grid grid-cols-3 gap-3 md:gap-4 lg:gap-8 overflow-hidden pb-4 pt-2'
              }`}>
              {columns.map((col, idx) => {
                const columnTasks = filteredTasks.filter(t => t.status === col.status);
                
                return (
                  <div 
                    key={col.status} 
                    className={`flex flex-col h-full min-w-0 rounded-[2.5rem] ${col.color} backdrop-blur-md border p-4 md:p-5 lg:p-8 relative overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700 group/column midnight:bg-black/40 midnight:border-emerald-500/10`}
                    style={{ animationDelay: `${idx * 150}ms` }}
                  >
                    {/* 动态背景光晕 */}
                    <div className={`absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br ${col.accent} rounded-full blur-[60px] opacity-0 group-hover/column:opacity-100 transition-opacity duration-1000`} />
                    <div className={`absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-tr ${col.accent} rounded-full blur-[60px] opacity-0 group-hover/column:opacity-100 transition-opacity duration-1000 delay-200`} />
                    
                    <div className="flex justify-between items-center mb-3 md:mb-5 lg:mb-8 px-1 md:px-3 z-10 shrink-0">
                      <div className="flex flex-col min-w-0">
                        <h3 className={`font-black ${isMobile ? 'text-lg' : 'text-sm md:text-lg lg:text-2xl'} text-foreground flex items-center gap-1.5 md:gap-3 tracking-tight`}>
                          <span className="truncate">{col.title.split(' ')[0]}</span>
                          <span className={`bg-card/90 ${isMobile ? 'px-2.5 py-1 text-[10px]' : 'px-2 py-0.5 md:px-3 py-1.5 text-[10px] md:text-xs'} rounded-full font-black text-muted-foreground shadow-sm border border-border flex-shrink-0 midnight:bg-zinc-900/60 midnight:border-emerald-500/10`}>
                            {columnTasks.length}
                          </span>
                        </h3>
                        <p className={`${isMobile ? 'text-[8px]' : 'text-[7px] md:text-[8px] lg:text-[10px]'} uppercase tracking-widest text-muted-foreground font-bold mt-1`}>
                          {col.status} STAGE
                        </p>
                      </div>
                      {!isMobile && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-11 rounded-lg md:rounded-2xl bg-card/60 hover:bg-card/90 transition-all duration-300 backdrop-blur-sm border border-border/40 flex-shrink-0 midnight:border-emerald-500/10">
                              <MoreVertical className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-2xl">
                            <DropdownMenuItem 
                              onClick={() => handleClearTasks(col.status)}
                              className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer rounded-xl font-bold text-xs p-3"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              清空{col.status === 'todo' ? '待办' : col.status === 'doing' ? '进行中' : '已完成'}任务
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    <div className={`flex-1 overflow-y-auto custom-scrollbar ${isMobile ? '-mx-3 px-3' : '-mx-2 md:-mx-4 lg:-mx-5 px-2 md:px-4 lg:px-5'} z-10 relative`}>
                      <div className={`${isMobile ? 'space-y-3' : 'space-y-2 md:space-y-4'} pb-6 md:pb-8 lg:pb-10 pt-2`}>
                        {columnTasks.map((task, taskIdx) => (
                          <div 
                            key={task.id} 
                            className={`group/task relative overflow-hidden bg-card ${isMobile ? 'p-3.5 rounded-2xl' : 'p-3 md:p-4 lg:p-6 rounded-[1.5rem] lg:rounded-[2rem]'} shadow-md border border-border/90 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-in fade-in slide-in-from-bottom-4 zoom-in-95 midnight:bg-zinc-900/40 midnight:border-emerald-500/5`}
                            style={{ animationDelay: `${taskIdx * 50}ms`, animationDuration: '400ms' }}
                            onClick={() => handleEditTask(task)}
                          >
                             <div className={`absolute top-0 right-0 ${isMobile ? 'w-24 h-24' : 'w-40 h-40'} bg-gradient-to-br ${col.accent} blur-3xl opacity-0 group-hover/task:opacity-100 transition-opacity duration-700`} />
                             
                             {task.is_exam && (
                               <div className={`absolute left-0 top-0 bottom-0 ${isMobile ? 'w-1.5' : 'w-2'} bg-red-500`} />
                             )}
                             
                             <div className={`flex justify-between items-center ${isMobile ? 'mb-2.5' : 'mb-2 md:mb-3 lg:mb-4'} relative z-10`}>
                               <Badge variant="outline" className={`bg-card/90 ${isMobile ? 'text-[8px] px-2.5 py-1' : 'text-[8px] md:text-[9px] lg:text-[10px] px-2 py-0.5 md:px-3 md:py-1.5'} font-black uppercase tracking-wider border-border shadow-sm rounded-lg md:rounded-xl text-muted-foreground backdrop-blur-sm truncate max-w-[70%] midnight:bg-zinc-800/60 midnight:border-emerald-500/10`}>
                                 <span className="truncate">{task.course_name || 'Personal'}</span>
                               </Badge>
                               
                               <div className="flex items-center gap-1 md:gap-2">
                                 {task.is_exam && (
                                   <div className={`${isMobile ? 'p-1.5' : 'p-1.5 md:p-2'} bg-red-500/10 rounded-lg md:rounded-xl border border-red-500/20`}>
                                     <AlertCircle className={`${isMobile ? 'w-3 h-3' : 'w-3 h-3 md:w-4 h-4'} text-red-500 animate-pulse-slow` } />
                                   </div>
                                 )}
                                 
                                 {task.status !== 'done' && (
                                   <button 
                                     onClick={async (e) => {
                                       e.stopPropagation();
                                       try {
                                         const target = e.currentTarget;
                                         target.style.transform = 'scale(0.8)';
                                         setTimeout(() => {
                                           if (target) target.style.transform = '';
                                         }, 150);
                                         await updateTaskStatus(task.id, 'done');
                                       } catch (err) {
                                         console.error("Quick complete failed:", err);
                                       }
                                     }}
                                     className={`group/complete relative flex items-center justify-center rounded-full border-2 transition-all duration-300 hover:scale-110 active:scale-90 overflow-hidden flex-shrink-0
                                       ${isMobile ? 'w-7 h-7' : 'w-6 h-6 md:w-8 md:h-8'} 
                                       ${task.is_exam 
                                         ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500 hover:border-red-500' 
                                         : 'border-border bg-accent/30 hover:bg-emerald-500 hover:border-emerald-500'}`}
                                     title="标记为完成"
                                   >
                                     <Check className={`transition-all duration-300 stroke-[3px] 
                                       ${isMobile ? 'w-3.5 h-3.5' : 'w-3 h-3 md:w-4 h-4'}
                                       ${task.is_exam 
                                         ? 'text-red-400 group-hover/complete:text-white opacity-40 group-hover/complete:opacity-100' 
                                         : 'text-muted-foreground group-hover/complete:text-white opacity-40 group-hover/complete:opacity-100'}`} 
                                     />
                                   </button>
                                 )}
                               </div>
                             </div>
                             
                             <h4 className={`font-black text-foreground tracking-tight ${isMobile ? 'mb-2.5 text-sm' : 'mb-2 md:mb-3 lg:mb-4 text-xs md:text-sm lg:text-base'} leading-relaxed relative z-10 group-hover/task:text-primary midnight:group-hover/task:text-emerald-400 transition-colors duration-300 line-clamp-2`}>
                               {task.title}
                             </h4>
                             
                             <div className={`flex items-center justify-between ${isMobile ? 'text-[10px]' : 'text-[9px] md:text-xs'} font-bold relative z-10`}>
                               <div className={`flex items-center gap-1 md:gap-2 ${isMobile ? 'px-2 py-1' : 'px-1.5 py-0.5 md:px-3 md:py-1.5'} rounded-lg md:rounded-xl ${
                                 task.status === 'done' 
                                   ? 'text-emerald-600 bg-emerald-500/10 border border-emerald-500/20' 
                                   : 'text-muted-foreground bg-accent/30 border border-border/50'
                               } truncate mr-1 midnight:border-emerald-500/10`}>
                                 <Calendar className={`${isMobile ? 'w-3 h-3' : 'w-2.5 h-2.5 md:w-3.5 h-3.5'}`} />
                                 <span className="truncate">{formatDeadline(task.deadline)}</span>
                               </div>
                               <div className={`${isMobile ? 'px-2.5 py-1 text-[8px]' : 'px-2 py-0.5 md:px-3.5 md:py-1.5 text-[8px] md:text-[10px]'} rounded-lg md:rounded-xl font-black uppercase tracking-widest flex-shrink-0 ${
                                 task.is_exam 
                                   ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
                                   : 'bg-card border border-border text-muted-foreground'
                               }`}>
                                 {task.is_exam ? 'Exam' : 'Task'}
                               </div>
                             </div>
                          </div>
                        ))}
                        
                        {columnTasks.length === 0 && (
                          <div className={`flex flex-col items-center justify-center ${isMobile ? 'py-8 px-4' : 'py-6 md:py-10 lg:py-12 px-2 md:px-4 lg:px-6'} border-2 border-dashed border-border/50 rounded-[1.5rem] md:rounded-[2rem] bg-card/30 midnight:border-emerald-500/10`}>
                            <div className={`${isMobile ? 'w-10 h-10' : 'w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-12'} rounded-xl md:rounded-2xl bg-card/50 flex items-center justify-center mb-2 md:mb-3`}>
                              <Plus className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6'} text-muted-foreground/40`} />
                            </div>
                            <p className={`text-muted-foreground/60 font-bold uppercase tracking-widest ${isMobile ? 'text-[10px]' : 'text-[10px] md:text-xs'}`}>Empty Stage</p>
                          </div>
                        )}
                        
                        {!isMobile && (
                          <Button 
                            variant="ghost" 
                            className="w-full border-2 border-dashed border-border/60 text-muted-foreground hover:text-primary hover:bg-card hover:border-primary/40 hover:shadow-sm h-10 md:h-14 lg:h-16 rounded-xl md:rounded-[1.5rem] lg:rounded-[1.75rem] transition-all duration-300 group mt-2 shrink-0 midnight:border-emerald-500/10 midnight:hover:text-emerald-400 midnight:hover:border-emerald-500/30"
                            onClick={() => handleNewTask(col.status)}
                          >
                            <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-5 lg:h-5 mr-1 md:mr-2 group-hover:scale-125 group-hover:rotate-90 transition-transform duration-300" />
                            <span className="font-bold text-[10px] md:text-xs lg:text-sm tracking-widest uppercase">Quick Add</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
         </div>
       </div>
       
       {/* 清空任务确认对话框 */}
       {showClearConfirm && clearingStatus && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="mica w-full max-w-[380px] rounded-[2.5rem] p-8 shadow-2xl overflow-hidden relative border border-white/40 animate-in zoom-in-95 slide-in-from-bottom-4 duration-500" style={{ animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
             {/* 背景装饰 */}
             <div className="absolute -top-12 -right-12 w-32 h-32 bg-red-500/10 rounded-full blur-3xl" />
             <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
             
             <div className="flex flex-col items-center text-center space-y-6 relative z-10">
               <div className="w-20 h-20 bg-gradient-to-br from-red-50 to-orange-50 rounded-[2.2rem] flex items-center justify-center text-red-500 shadow-inner relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-br from-red-100/50 to-transparent" />
                 <Trash2 size={40} className="stroke-[2.5px] relative z-10 animate-pulse-slow" />
               </div>
               
               <div className="space-y-3">
                 <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                   确认清空任务？
                 </h3>
                 <div className="space-y-2">
                   <p className="text-sm font-bold text-slate-600 px-4 leading-relaxed">
                     即将删除 <span className="text-red-600 font-black text-lg mx-1">
                       {filteredTasks.filter(t => t.status === clearingStatus).length}
                     </span> 个
                     <span className="text-slate-800 font-black mx-1">
                       {clearingStatus === 'todo' ? '待办' : clearingStatus === 'doing' ? '进行中' : '已完成'}
                     </span>
                     任务
                   </p>
                   <p className="text-xs font-bold text-slate-400 px-6">
                     此操作无法撤销，请谨慎操作
                   </p>
                 </div>
               </div>

               <div className="flex flex-col w-full gap-3 pt-2">
                 <button
                   onClick={executeClearTasks}
                   disabled={isClearing}
                   className="w-full py-4 bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 rounded-[1.2rem] font-black text-white shadow-lg shadow-red-200 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {isClearing ? (
                     <>
                       <Loader2 size={20} className="animate-spin" />
                       <span>删除中...</span>
                     </>
                   ) : (
                     <>
                       <Trash2 size={20} className="stroke-[2.5px]" />
                       <span>确定清空</span>
                     </>
                   )}
                 </button>
                 <button
                   onClick={() => {
                     setShowClearConfirm(false);
                     setClearingStatus(null);
                   }}
                   disabled={isClearing}
                   className="w-full py-4 bg-slate-100 hover:bg-slate-200 rounded-[1.2rem] font-black text-slate-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   取消
                 </button>
               </div>
             </div>
           </div>
         </div>
       )}
       
       {/* 任务编辑面板 */}
       {isTaskEditorOpen && (
         <TaskEditorPanelWithCourses 
           isOpen={isTaskEditorOpen} 
           onClose={() => {
             setIsTaskEditorOpen(false);
             setEditingTask(null);
           }}
           initialData={editingTask}
           defaultStatus={defaultStatus}
         />
       )}

       {/* AI 智能导入面板 */}
       <AITaskImportPanel 
         isOpen={isAIPanelOpen}
         onClose={() => setIsAIPanelOpen(false)}
       />
    </AppLayout>
  );
};

// 包装组件：处理课程数据依赖
const TaskEditorPanelWithCourses = (props: {
  isOpen: boolean;
  onClose: () => void;
  initialData: Task | null;
  defaultStatus?: 'todo' | 'doing' | 'done';
}) => {
  const { courses } = useScheduleBridge();
  return <TaskEditorPanel {...props} courses={courses} />;
};

export default Tasks;
