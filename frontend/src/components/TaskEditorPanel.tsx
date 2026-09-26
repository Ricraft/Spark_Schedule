import React, { useState, useEffect } from 'react';
import { 
  X, Flag, AlertTriangle, 
  CheckCircle2, Trash2, AlignLeft, CalendarDays, Loader2,
  Search, Plus
} from 'lucide-react';
import { useTasksBridge, Task } from '../hooks/useTasksBridge';

interface TaskEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Task | null;
  courses: any[];
  defaultStatus?: 'todo' | 'doing' | 'done';
}

export const TaskEditorPanel = ({ isOpen, onClose, initialData, courses = [], defaultStatus }: TaskEditorPanelProps) => {
  const { addTask, updateTask, deleteTask, tasks } = useTasksBridge();
  
  // --- 表单状态 ---
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [courseName, setCourseName] = useState('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState<string>('23:59');
  const [isExam, setIsExam] = useState(false);
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'todo' | 'doing' | 'done'>('todo');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // 搜索下拉状态
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // 构建课程选项（包括个人杂项）- 去重处理
  const uniqueCourses = courses.reduce((acc, course) => {
    // 检查是否已存在同名课程
    if (!acc.some(c => c.name === course.name)) {
      acc.push({ id: course.id, name: course.name, color: course.color });
    }
    return acc;
  }, [] as Array<{ id: string; name: string; color: string }>);
  
  // 从已有任务中提取自定义板块（非课程的板块）
  const customCategories = tasks
    .filter(task => task.course_name && !task.course_id?.startsWith('course_') && task.course_id?.startsWith('custom_'))
    .reduce((acc, task) => {
      if (!acc.some(c => c.name === task.course_name)) {
        acc.push({ 
          id: task.course_id || `custom_${task.course_name}`, 
          name: task.course_name, 
          color: '#8B5CF6' // 紫色表示自定义板块
        });
      }
      return acc;
    }, [] as Array<{ id: string; name: string; color: string }>);
  
  const courseOptions = [
    { id: '', name: '个人杂项', color: '#64748b' },
    ...uniqueCourses,
    ...customCategories
  ];
  
  // 初始化数据
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // 编辑模式：填充数据
        setTitle(initialData.title);
        setCourseId(initialData.course_id || '');
        setCourseName(initialData.course_name || '');
        setIsExam(initialData.is_exam);
        setDesc(initialData.description || '');
        
        // 解析截止日期和时间
        const deadlineParts = (initialData.deadline || '').split(' ');
        setDate(deadlineParts[0] || new Date().toISOString().split('T')[0]);
        setTime(deadlineParts[1] || '23:59');
        
        setSearchQuery(initialData.course_name || '');
        setStatus(initialData.status || 'todo');
      } else {
        // 新建模式：重置，使用默认状态
        setTitle('');
        setCourseId('');
        setCourseName('');
        setIsExam(false);
        setDesc('');
        setDate(new Date().toISOString().split('T')[0]);
        setTime('23:59');
        setSearchQuery('');
        setStatus(defaultStatus || 'todo');
      }
      setIsDropdownOpen(false);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, initialData, defaultStatus]);
  
  // 获取当前主题色
  const selectedCourse = courseOptions.find(c => c.id === courseId);
  const activeColor = isExam 
    ? '#EF4444' 
    : (selectedCourse?.color || '#64748b');
  
  // 快捷日期操作
  const setQuickDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };
  
  // 动态过滤选项
  const filteredCourses = courseOptions.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // 判断是否需要显示"创建新板块"
  const showCreateOption = searchQuery.trim() !== '' && 
    !courseOptions.some(c => c.name.toLowerCase() === searchQuery.toLowerCase());
  
  // 处理课程选择
  const handleCourseSelect = (course: typeof courseOptions[0]) => {
    setCourseId(course.id);
    setCourseName(course.name);
    setSearchQuery(course.name);
    setIsDropdownOpen(false);
  };
  
  // 处理新建板块
  const handleCreateNew = () => {
    const newName = searchQuery.trim();
    setCourseId(`custom_${Date.now()}`);
    setCourseName(newName);
    setIsDropdownOpen(false);
  };
  
  // 保存任务
  const handleSave = async () => {
    if (!title.trim()) {
      alert('请输入任务标题');
      return;
    }
    
    try {
      setSaving(true);
      
      const taskData = {
        title: title.trim(),
        course_id: courseId,
        course_name: courseName || '个人杂项',
        deadline: `${date} ${time}`,
        is_exam: isExam,
        priority: isExam ? 'high' as const : 'normal' as const,
        description: desc,
        status: status
      };
      
      if (initialData?.id) {
        // 更新现有任务
        await updateTask(initialData.id, taskData);
      } else {
        // 创建新任务
        await addTask(taskData);
      }
      
      onClose();
    } catch (error: any) {
      alert(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };
  
  // 删除任务确认
  const handleDelete = () => {
    if (!initialData?.id) return;
    setShowDeleteConfirm(true);
  };

  // 执行删除
  const executeDelete = async () => {
    if (!initialData?.id) return;
    try {
      setSaving(true);
      await deleteTask(initialData.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (error: any) {
      alert(error.message || '删除失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* 遮罩层 - 增强动效 */}
      <div 
        className={`fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px] transition-all duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
      />

      {/* 侧边面板容器 - 增强动效 */}
      <div className={`fixed top-4 right-4 bottom-4 w-[540px] z-50 flex flex-col shadow-[-20px_0_80px_rgba(0,0,0,0.1)] transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1)
        ${isOpen ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-12 opacity-0 scale-95 pointer-events-none'}
        mica rounded-[3.5rem] overflow-hidden animate-in`}
        style={{
          animationDuration: isOpen ? '700ms' : '0ms',
          animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        
        {/* === 顶部：操作栏 === */}
        <div className="flex justify-between items-center p-8 pb-4">
          <div className="flex items-center gap-4">
             {/* 状态指示器 */}
             <div className="w-4 h-4 rounded-full shadow-lg transition-all duration-500 animate-pulse-slow" style={{ backgroundColor: activeColor, boxShadow: `0 0 15px ${activeColor}40` }} />
             <div className="flex flex-col">
               <h2 className="text-xl font-black text-slate-800 tracking-tight leading-none">
                 {initialData ? '编辑任务' : '新建任务'}
               </h2>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Task Configuration</span>
             </div>
          </div>
          <div className="flex gap-2">
            {initialData && (
              <button 
                onClick={handleDelete}
                disabled={saving}
                className="h-11 w-11 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all duration-300 disabled:opacity-50"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button 
              onClick={onClose}
              disabled={saving}
              className="h-11 w-11 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-2xl transition-all duration-300 disabled:opacity-50"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* === 中间：滚动内容区 === */}
        <div className="flex-1 overflow-y-auto px-8 py-4 space-y-10 custom-scrollbar">
          
          {/* 1. 标题输入 - 添加渐入动效 */}
          <div className={`space-y-3 group transition-all duration-500 ${isOpen ? 'animate-in fade-in slide-in-from-bottom-4' : ''}`} style={{ animationDelay: '100ms' }}>
             <textarea 
               value={title}
               onChange={e => setTitle(e.target.value)}
               placeholder="准备做什么？"
               className="w-full text-4xl font-black bg-transparent border-none outline-none placeholder:text-slate-200 text-slate-900 resize-none min-h-[100px] leading-[1.1] transition-all duration-300"
               autoFocus
               disabled={saving}
             />
             <div className="h-1.5 w-16 rounded-full transition-all duration-700 group-focus-within:w-32 group-focus-within:bg-indigo-500 opacity-50 bg-slate-200" style={{ backgroundColor: title ? activeColor : undefined }} />
          </div>

          {/* 2. 关联课程 (搜索与创建) - 添加渐入动效 */}
          <div className={`space-y-4 relative transition-all duration-500 ${isOpen ? 'animate-in fade-in slide-in-from-bottom-4' : ''}`} style={{ animationDelay: '200ms' }}>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Flag size={12} className="stroke-[3px]" /> 归属板块
            </label>
            
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search size={16} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                  if (e.target.value === '') {
                    setCourseId('');
                    setCourseName('');
                  }
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onBlur={() => {
                  setTimeout(() => setIsDropdownOpen(false), 200);
                }}
                placeholder="搜索课程或输入新板块名称..."
                disabled={saving}
                className="w-full bg-white/60 border border-white/80 rounded-[1.5rem] py-3.5 pl-11 pr-4 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:border-indigo-100 shadow-sm transition-all disabled:opacity-50"
                style={{ '--tw-ring-color': `${activeColor}15` } as React.CSSProperties}
              />
            </div>

            {/* 悬浮的下拉选择菜单 - 增强动效 */}
            <div className={`absolute z-20 top-[4.5rem] left-0 right-0 bg-white/80 backdrop-blur-2xl border border-white shadow-[0_10px_40px_rgba(0,0,0,0.08)] rounded-[1.5rem] overflow-hidden transition-all duration-400 origin-top
              ${isDropdownOpen ? 'opacity-100 scale-y-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-y-90 -translate-y-2 pointer-events-none'}`}
            >
              <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
                {filteredCourses.length > 0 ? (
                  filteredCourses.map(c => (
                    <button
                      key={c.id || 'none'}
                      onClick={() => handleCourseSelect(c)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-100/50 rounded-xl transition-colors text-left"
                    >
                      <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: c.color }} />
                      <span className="text-sm font-bold text-slate-700">{c.name}</span>
                      {courseId === c.id && <CheckCircle2 size={16} className="ml-auto text-indigo-500" />}
                    </button>
                  ))
                ) : (
                  !showCreateOption && (
                    <div className="px-4 py-3 text-sm text-slate-400 text-center font-medium">
                      无匹配项
                    </div>
                  )
                )}
                
                {/* 创建新板块的提示项 */}
                {showCreateOption && (
                  <button
                    onClick={handleCreateNew}
                    className="w-full flex items-center gap-3 px-4 py-3 mt-1 bg-indigo-50/50 hover:bg-indigo-100/50 text-indigo-600 rounded-xl transition-colors text-left border border-indigo-100 border-dashed"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <Plus size={16} className="stroke-[3px]" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black">创建新板块</span>
                      <span className="text-[10px] font-bold opacity-70">将 "{searchQuery}" 设为新分类</span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 任务状态切换器 - 添加渐入动效 */}
          <div className={`space-y-4 transition-all duration-500 ${isOpen ? 'animate-in fade-in slide-in-from-bottom-4' : ''}`} style={{ animationDelay: '300ms' }}>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <CheckCircle2 size={12} className="stroke-[3px]" /> 当前状态
            </label>
            <div className="flex bg-white/60 p-1.5 rounded-[1.5rem] border border-white/80 shadow-sm relative">
              {/* 滑动背景块 */}
              <div 
                className="absolute inset-y-1.5 w-[calc(33.333%-4px)] bg-white rounded-[1.25rem] shadow-[0_4px_15px_rgba(0,0,0,0.05)] transition-all duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)"
                style={{ 
                  left: status === 'todo' ? '6px' : status === 'doing' ? 'calc(33.333% + 2px)' : 'calc(66.666% - 2px)',
                }}
              />
              <button
                disabled={saving}
                onClick={() => setStatus('todo')}
                className={`flex-1 py-3 text-sm font-bold z-10 transition-colors duration-300 ${
                  status === 'todo' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                待办
              </button>
              <button
                disabled={saving}
                onClick={() => setStatus('doing')}
                className={`flex-1 py-3 text-sm font-bold z-10 transition-colors duration-300 ${
                  status === 'doing' ? 'text-purple-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                进行中
              </button>
              <button
                disabled={saving}
                onClick={() => setStatus('done')}
                className={`flex-1 py-3 text-sm font-bold z-10 transition-colors duration-300 ${
                  status === 'done' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                已完成
              </button>
            </div>
          </div>

          {/* 3. 时间与类型 - 添加渐入动效 */}
          <div className={`grid grid-cols-2 gap-6 transition-all duration-500 ${isOpen ? 'animate-in fade-in slide-in-from-bottom-4' : ''}`} style={{ animationDelay: '400ms' }}>
            
            {/* 左侧：日期时间选择卡片 */}
            <div className="bg-white/60 p-5 rounded-[2rem] border border-white space-y-4 shadow-sm group hover:shadow-md transition-all duration-500">
               <div className="flex items-center justify-between">
                 <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">截止时间</label>
                 <CalendarDays size={16} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
               </div>
               
               <div className="space-y-2">
                 <input 
                   type="date" 
                   value={date}
                   onChange={e => setDate(e.target.value)}
                   disabled={saving}
                   className="w-full bg-white/80 font-black text-slate-800 text-sm rounded-xl px-3 py-2.5 outline-none focus:ring-4 transition-all disabled:opacity-50 border border-slate-100/50"
                   style={{ '--tw-ring-color': `${activeColor}20` } as React.CSSProperties}
                 />
                 <input 
                   type="time" 
                   value={time}
                   onChange={e => setTime(e.target.value)}
                   disabled={saving}
                   className="w-full bg-white/80 font-black text-slate-800 text-sm rounded-xl px-3 py-2.5 outline-none focus:ring-4 transition-all disabled:opacity-50 border border-slate-100/50"
                   style={{ '--tw-ring-color': `${activeColor}20` } as React.CSSProperties}
                 />
               </div>
               
               {/* 快捷按钮 */}
               <div className="grid grid-cols-3 gap-2">
                 {['今天', '明天', '下周'].map((label, idx) => (
                   <button 
                     key={label}
                     onClick={() => setQuickDate(idx === 2 ? 7 : idx)}
                     disabled={saving}
                     className="py-2 bg-white/80 rounded-xl text-[10px] font-black text-slate-500 shadow-sm hover:text-indigo-600 hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-50 border border-transparent hover:border-indigo-100"
                   >
                     {label}
                   </button>
                 ))}
               </div>
            </div>

            {/* 右侧：考试模式开关 */}
            <div 
              onClick={() => !saving && setIsExam(!isExam)}
              className={`relative overflow-hidden p-5 rounded-[2rem] border-2 transition-all duration-700 cursor-pointer flex flex-col justify-between group
                ${isExam ? 'bg-red-50/50 border-red-100 shadow-xl shadow-red-100/20' : 'bg-white/60 border-white hover:bg-white hover:shadow-md'}
                ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
               {isExam && <div className="absolute -right-8 -top-8 w-32 h-32 bg-red-500/20 rounded-full blur-2xl animate-pulse-slow" />}
               
               <div className="flex justify-between items-start z-10">
                 <label className={`text-[11px] font-black uppercase tracking-widest transition-colors ${isExam ? 'text-red-500' : 'text-slate-400'}`}>
                   重要程度
                 </label>
                 <div className={`w-10 h-6 rounded-full p-1 transition-colors duration-500 ${isExam ? 'bg-red-500' : 'bg-slate-200'}`}>
                   <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-500 ${isExam ? 'translate-x-4' : ''}`} />
                 </div>
               </div>

               <div className="z-10 mt-4">
                 <div className={`text-xl font-black transition-all duration-500 ${isExam ? 'text-red-600 scale-105 origin-left' : 'text-slate-800'}`}>
                   {isExam ? '考试 / DDL' : '普通任务'}
                 </div>
                 <div className={`text-[10px] font-bold mt-1 transition-colors ${isExam ? 'text-red-400' : 'text-slate-400'}`}>
                   {isExam ? '首页倒计时显示' : '普通列表项'}
                 </div>
               </div>
            </div>
          </div>

          {/* 4. 详细备注 - 添加渐入动效 */}
          <div className={`space-y-4 pb-10 transition-all duration-500 ${isOpen ? 'animate-in fade-in slide-in-from-bottom-4' : ''}`} style={{ animationDelay: '500ms' }}>
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <AlignLeft size={12} className="stroke-[3px]" /> 详细描述
            </label>
            <textarea 
              value={desc}
              onChange={e => setDesc(e.target.value)}
              disabled={saving}
              className="w-full h-40 bg-white/60 border border-white rounded-[2rem] p-6 text-sm font-medium resize-none outline-none focus:bg-white focus:ring-4 transition-all shadow-sm disabled:opacity-50 placeholder:text-slate-300"
              placeholder="添加备注、考试范围或具体要求..."
              style={{ '--tw-ring-color': `${activeColor}15` } as React.CSSProperties}
            />
          </div>

        </div>

        {/* === 底部：保存栏 - 添加渐入动效 === */}
        <div className={`p-8 bg-white/40 backdrop-blur-xl border-t border-white/40 transition-all duration-500 ${isOpen ? 'animate-in fade-in slide-in-from-bottom-4' : ''}`} style={{ animationDelay: '600ms' }}>
          <button 
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className={`w-full py-5 rounded-[1.75rem] font-black text-lg text-white shadow-2xl flex items-center justify-center gap-3 transition-all duration-500 active:scale-95 hover:scale-[1.02] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed
              ${isExam ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-red-200' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-indigo-200'}`}
          >
            {saving ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                <span>处理中...</span>
              </>
            ) : (
              <>
                {isExam ? <AlertTriangle size={24} className="stroke-[2.5px]" /> : <CheckCircle2 size={24} className="stroke-[2.5px]" />}
                <span>{initialData ? '保存修改' : (isExam ? '立即创建 DDL' : '添加到任务集')}</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* 删除确认对话框 - 增强动效 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="mica w-full max-w-[340px] rounded-[2.5rem] p-8 shadow-2xl overflow-hidden relative border border-white/40 animate-in zoom-in-95 slide-in-from-bottom-4 duration-500" style={{ animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            {/* 背景装饰 */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-red-500/10 rounded-full blur-3xl" />
            
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-red-50 rounded-[2.2rem] flex items-center justify-center text-red-500 shadow-inner">
                <Trash2 size={40} className="stroke-[2.5px]" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">确认删除？</h3>
                <p className="text-sm font-bold text-slate-400 px-4 leading-relaxed">
                  此操作将永久删除任务 <br/>
                  <span className="text-slate-600">"{title.length > 20 ? title.substring(0, 20) + '...' : title}"</span>
                </p>
              </div>

              <div className="flex flex-col w-full gap-3">
                <button
                  onClick={executeDelete}
                  disabled={saving}
                  className="w-full py-4 bg-gradient-to-r from-red-500 to-rose-600 rounded-[1.2rem] font-black text-white shadow-lg shadow-red-200 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={20} className="animate-spin" /> : '确定删除'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={saving}
                  className="w-full py-4 bg-slate-100 hover:bg-slate-200 rounded-[1.2rem] font-black text-slate-500 transition-all active:scale-95"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
