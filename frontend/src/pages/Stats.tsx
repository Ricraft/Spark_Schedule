import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, Cell, PieChart, Pie
} from "recharts";
import { useScheduleBridge } from "@/hooks/useScheduleBridge";
import { useTasksBridge } from "@/hooks/useTasksBridge";
import { useStudyTime } from "@/hooks/useStudyTime";
import { useGpaBridge } from "@/hooks/useGpaBridge";
import { 
  TrendingUp, GraduationCap, Zap, BarChart3, ArrowRight, 
  Plus, X, Save, Sparkles, Database, Trash2, Edit2, Server, AlertCircle
} from "lucide-react";

const Stats = () => {
  const navigate = useNavigate();
  const { courses } = useScheduleBridge();
  const { statistics } = useTasksBridge();
  const { weekHours, weekGoalHours } = useStudyTime();
  const { records: gpaRecords, saveRecord, deleteRecord: deleteGpaRecord } = useGpaBridge();
  
  const [isGpaModalOpen, setIsGpaModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ year: "大一", term: "秋季", value: "" });
  
  // 彻底锁定背景滚动，修复滚轮穿透
  useEffect(() => {
    if (isGpaModalOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      // 只允许弹窗内容区滚动，拦截底层页面滚动
      const modalScrollRoot = document.querySelector('.modal-scroll-area');
      const canScrollInModal = (target: EventTarget | null) => {
        if (!(target instanceof Node) || !modalScrollRoot) return false;
        return modalScrollRoot.contains(target);
      };

      const preventBackgroundScroll = (e: Event) => {
        if (!canScrollInModal(e.target)) {
          e.preventDefault();
          e.stopPropagation();
        }
      };

      const preventScrollKeys = (e: KeyboardEvent) => {
        const blockedKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Space'];
        if (!blockedKeys.includes(e.code) && !blockedKeys.includes(e.key)) return;
        if (!canScrollInModal(e.target)) {
          e.preventDefault();
          e.stopPropagation();
        }
      };

      document.addEventListener('wheel', preventBackgroundScroll, { passive: false, capture: true });
      document.addEventListener('touchmove', preventBackgroundScroll, { passive: false, capture: true });
      document.addEventListener('keydown', preventScrollKeys, { capture: true });
      
      return () => {
        document.removeEventListener('wheel', preventBackgroundScroll, true);
        document.removeEventListener('touchmove', preventBackgroundScroll, true);
        document.removeEventListener('keydown', preventScrollKeys, true);
        
        const scrollY = document.body.style.top;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);
      };
    }
  }, [isGpaModalOpen]);

  const yearOptions = ["大一", "大二", "大三", "大四", "研究生"];
  const termOptions = ["秋季", "春季", "夏季"];

  // 保存或更新 GPA 记录
  const handleSave = async () => {
    const val = parseFloat(formData.value);
    if (isNaN(val) || val < 0 || val > 5) {
      alert("请输入 0-5.0 之间的绩点");
      return;
    }
    
    try {
      // 检查非编辑模式下的重复性
      if (!editingId) {
        const exists = gpaRecords.some(r => r.year === formData.year && r.term === formData.term);
        if (exists) {
          alert("该学期数据已存在，请点击下方列表进行修改");
          return;
        }
      }

      await saveRecord({
        id: editingId || undefined,
        year: formData.year,
        term: formData.term,
        value: val.toFixed(2)
      });
      
      setEditingId(null);
      setFormData({ ...formData, value: "" });
    } catch (err) {
      console.error('保存失败:', err);
      alert('保存失败，请重试');
    }
  };

  // 开始编辑已有记录
  const startEdit = (record: typeof gpaRecords[0]) => {
    setEditingId(record.id);
    setFormData({
      year: record.year,
      term: record.term,
      value: record.value
    });
    // 自动滚动到顶部输入区
    const modalContent = document.querySelector('.modal-scroll-area');
    if (modalContent) modalContent.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('确定要删除这条记录吗？')) return;
    try {
      await deleteGpaRecord(id);
      if (editingId === id) {
        setEditingId(null);
        setFormData({ ...formData, value: "" });
      }
    } catch (err) {
      alert('删除失败');
    }
  };

  const chartData = useMemo(() => {
    return [...gpaRecords]
      .sort((a, b) => {
        const yIdx = yearOptions.indexOf(a.year) - yearOptions.indexOf(b.year);
        if (yIdx !== 0) return yIdx;
        return termOptions.indexOf(a.term) - termOptions.indexOf(b.term);
      })
      .map(r => ({
        name: `${r.year}${r.term}`,
        gpa: parseFloat(r.value)
      }));
  }, [gpaRecords]);

  const latestGpa = gpaRecords.length > 0 ? gpaRecords[gpaRecords.length - 1].value : "0.00";

  const taskStatusData = useMemo(() => {
    if (!statistics) return [];
    return [
      { name: '待办', value: statistics.todo, color: '#f59e0b' },
      { name: '进行中', value: statistics.doing, color: '#8b5cf6' },
      { name: '已完成', value: statistics.done, color: '#10b981' }
    ];
  }, [statistics]);

  return (
    <AppLayout title="数据统计">
      <div className="space-y-6 pb-8">
        {/* 指标卡片行 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card 
            onClick={() => setIsGpaModalOpen(true)}
            className="border-none shadow-xl bg-gradient-to-br from-primary to-violet-700 midnight:from-emerald-600 midnight:to-teal-800 text-primary-foreground rounded-[2rem] overflow-hidden relative group cursor-pointer hover:scale-[1.02] transition-all"
          >
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-110 transition-transform"><GraduationCap size={64} /></div>
            <CardContent className="pt-8 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <Badge className="bg-white/20 border-0 text-[10px] font-black uppercase tracking-widest text-white">GPA Records</Badge>
                <Edit2 size={16} className="opacity-40 group-hover:opacity-100 transition-all text-white" />
              </div>
              <div className="text-4xl font-black mb-1 text-white">{latestGpa}</div>
              <div className="text-sm font-bold opacity-90 text-white/90">最新学期绩点</div>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                <Plus size={14} /> 管理并编辑档案
              </div>
            </CardContent>
          </Card>

          <Card onClick={() => navigate('/focus')} className="border-none shadow-xl bg-gradient-to-br from-rose-500 to-orange-600 midnight:from-orange-600 midnight:to-red-900 text-white rounded-[2rem] cursor-pointer hover:scale-[1.02] transition-all">
            <CardContent className="pt-8">
              <div className="flex items-center justify-between mb-4">
                <Badge className="bg-white/20 border-0 text-[10px] font-black uppercase text-white">Focus</Badge>
                <ArrowRight size={16} className="opacity-40 text-white" />
              </div>
              <div className="text-4xl font-black mb-1 text-white">{weekHours.toFixed(1)}<span className="text-xl ml-1">h</span></div>
              <div className="text-sm font-bold opacity-90 text-white/90">本周专注时长</div>
              <div className="mt-4 h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white" style={{ width: `${Math.min((weekHours/weekGoalHours)*100, 100)}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card onClick={() => navigate('/tasks')} className="border-none shadow-xl bg-gradient-to-br from-emerald-500 to-teal-600 midnight:from-teal-600 midnight:to-emerald-950 text-white rounded-[2rem] cursor-pointer hover:scale-[1.02] transition-all">
            <CardContent className="pt-8">
              <div className="flex items-center justify-between mb-4">
                <Badge className="bg-white/20 border-0 text-[10px] font-black uppercase text-white">Task Rate</Badge>
                <Zap size={16} className="text-yellow-300" />
              </div>
              <div className="text-4xl font-black mb-1 text-white">{statistics?.completion_rate.toFixed(0) || 0}%</div>
              <div className="text-sm font-bold opacity-90 text-white/90">任务完成效率</div>
              <p className="mt-4 text-[10px] font-black italic opacity-80 uppercase tracking-tighter text-white/80">Growth Mindset</p>
            </CardContent>
          </Card>

          <Card onClick={() => navigate('/schedule')} className="border-none shadow-xl bg-card border border-border/50 rounded-[2rem] cursor-pointer hover:scale-[1.02] transition-all midnight:bg-zinc-950 midnight:border-emerald-500/30">
            <CardContent className="pt-8">
              <div className="flex items-center justify-between mb-4">
                <Badge className="bg-accent/50 text-muted-foreground border-0 text-[10px] font-black uppercase">Courses</Badge>
                <ArrowRight size={16} className="text-primary midnight:text-emerald-500 opacity-40" />
              </div>
              <div className="text-4xl font-black mb-1 text-foreground">{(courses || []).length}</div>
              <div className="text-sm font-bold text-muted-foreground">累计参与课程</div>
              <div className="mt-4 flex gap-1 h-1.5 bg-accent rounded-full overflow-hidden">
                <div className="w-3/4 h-full bg-primary midnight:bg-emerald-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 趋势图与比例图 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <Card 
            onClick={() => setIsGpaModalOpen(true)}
            className="md:col-span-8 border-none shadow-2xl bg-card border border-border/40 rounded-[2.5rem] overflow-hidden cursor-pointer group midnight:bg-zinc-950 midnight:border-emerald-500/30"
          >
            <CardHeader className="p-8 pb-0">
              <CardTitle className="text-xl font-black text-foreground flex items-center justify-between">
                <div className="flex items-center gap-2"><BarChart3 className="text-primary midnight:text-emerald-500" /> 学期绩点变化趋势</div>
                <div className="p-2 bg-primary/10 midnight:bg-emerald-500/10 rounded-xl group-hover:scale-110 transition-transform"><Plus className="text-primary midnight:text-emerald-500" size={20} /></div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorGpa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/><stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.2} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontWeight: 700, fontSize: 11 }} />
                  <YAxis domain={[0, 4.5]} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', color: 'var(--foreground)' }} />
                  <Area type="monotone" dataKey="gpa" stroke="var(--primary)" strokeWidth={4} fill="url(#colorGpa)" dot={{ r: 6, fill: 'var(--card)', stroke: 'var(--primary)', strokeWidth: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card 
            onClick={() => navigate('/tasks')}
            className="md:col-span-4 border-none shadow-2xl bg-card border border-border/40 rounded-[2.5rem] overflow-hidden flex flex-col cursor-pointer group hover:shadow-3xl hover:scale-[1.01] transition-all midnight:bg-zinc-950 midnight:border-emerald-500/30"
          >
            <CardHeader className="p-8 pb-0">
              <CardTitle className="text-xl font-black text-foreground flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="text-amber-500" size={20} /> 任务分布
                </div>
                <ArrowRight size={20} className="text-primary midnight:text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col justify-between">
              {/* 环形图容器 */}
              <div className="relative h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={taskStatusData} 
                      innerRadius={65} 
                      outerRadius={85} 
                      paddingAngle={10} 
                      dataKey="value" 
                      stroke="none"
                      cornerRadius={10}
                    >
                      {taskStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', color: 'var(--foreground)' }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* 中心文字 */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-foreground">
                    {(statistics?.todo || 0) + (statistics?.doing || 0) + (statistics?.done || 0)}
                  </span>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Tasks</span>
                </div>
              </div>

              {/* 自定义图例列表 */}
              <div className="space-y-3 mt-4">
                {taskStatusData.map((status, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-accent border border-border/50 hover:bg-accent/80 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                      <span className="text-xs font-bold text-muted-foreground">{status.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-foreground">{status.value}</span>
                      <div className="w-12 h-1 bg-accent rounded-full overflow-hidden">
                        <div 
                          className="h-full transition-all duration-1000" 
                          style={{ 
                            backgroundColor: status.color, 
                            width: `${((status.value / Math.max((statistics?.todo || 0) + (statistics?.doing || 0) + (statistics?.done || 0), 1)) * 100).toFixed(0)}%` 
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* GPA 管理模态框 */}
      {isGpaModalOpen && (
        <div 
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6"
          style={{ overflow: 'hidden' }}
        >
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" 
            onClick={() => setIsGpaModalOpen(false)} 
          />
          
          <div 
            className="relative w-full max-w-2xl bg-card rounded-[3rem] shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 midnight:bg-zinc-950 midnight:border-emerald-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-8 pb-4 flex items-center justify-between border-b border-border/50 flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary midnight:bg-emerald-600 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20"><GraduationCap size={24} /></div>
                <div>
                  <h3 className="text-xl font-black text-foreground">{editingId ? '编辑成绩记录' : '成绩档案库'}</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">GPA Archives / Edit Mode</p>
                </div>
              </div>
              <button onClick={() => setIsGpaModalOpen(false)} className="p-3 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"><X size={20} /></button>
            </div>

            {/* Scroll Area */}
            <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-8 custom-scrollbar modal-scroll-area">
              {/* 编辑表单 */}
              <div className={`p-8 rounded-[2.5rem] border transition-all space-y-8 ${editingId ? "bg-amber-500/10 border-amber-500/30 ring-4 ring-amber-500/5" : "bg-card border-border"}`}>
                {editingId && (
                  <div className="flex items-center gap-2 text-amber-500 text-xs font-black uppercase animate-pulse-slow">
                    <AlertCircle size={14} /> 正在编辑已选择的记录
                  </div>
                )}
                
                <div className="space-y-4">
                  <label className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2"><Database size={12} /> 学年</label>
                  <div className="flex flex-wrap gap-2">
                    {yearOptions.map(y => (
                      <button
                        key={y}
                        onClick={() => setFormData({...formData, year: y})}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
                          formData.year === y ? "bg-primary text-primary-foreground shadow-lg midnight:bg-emerald-600" : "bg-card text-muted-foreground border border-border/50 hover:text-primary midnight:hover:text-emerald-400"
                        }`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2"><Sparkles size={12} /> 学期</label>
                  <div className="flex gap-2">
                    {termOptions.map(t => (
                      <button
                        key={t}
                        onClick={() => setFormData({...formData, term: t})}
                        className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${
                          formData.term === t ? "bg-secondary text-secondary-foreground shadow-lg midnight:bg-emerald-900/40" : "bg-card text-muted-foreground border border-border/50"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2"><TrendingUp size={12} /> 绩点录入</label>
                  <input 
                    type="number" step="0.01" placeholder="3.80" 
                    value={formData.value}
                    onChange={e => setFormData({...formData, value: e.target.value})}
                    className="w-full h-16 bg-card border-2 border-border/50 rounded-[1.25rem] px-6 text-2xl font-black text-foreground outline-none focus:border-primary midnight:focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="flex gap-3">
                  <Button 
                    onClick={handleSave}
                    className={`flex-1 h-16 rounded-[1.25rem] font-black text-base flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl ${
                      editingId ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-primary text-primary-foreground hover:opacity-90 midnight:bg-emerald-600"
                    }`}
                  >
                    <Save size={20} /> {editingId ? "保存修改" : "确认入库"}
                  </Button>
                  {editingId && (
                    <Button 
                      variant="outline"
                      onClick={() => { setEditingId(null); setFormData({ ...formData, value: "" }); }}
                      className="h-16 w-16 rounded-[1.25rem] border-border text-muted-foreground hover:bg-accent"
                    >
                      <X size={24} />
                    </Button>
                  )}
                </div>
              </div>

              {/* 档案列表 */}
              <div className="space-y-4 pb-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">已入库记录 ({gpaRecords.length})</label>
                </div>
                
                {gpaRecords.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {gpaRecords.map(r => (
                      <div 
                        key={r.id} 
                        onClick={() => startEdit(r)}
                        className={`group flex items-center justify-between p-5 border transition-all rounded-[1.75rem] cursor-pointer ${
                          editingId === r.id 
                          ? "bg-primary border-primary text-primary-foreground shadow-xl -translate-y-1 midnight:bg-emerald-600 midnight:border-emerald-600" 
                          : "bg-card border-border/50 hover:border-primary/50 midnight:hover:border-emerald-500/50 hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                            editingId === r.id ? "bg-white/20 text-white" : "bg-primary/10 text-primary midnight:bg-emerald-500/10 midnight:text-emerald-400"
                          }`}>{r.year.charAt(1)}</div>
                          <div>
                            <h4 className={`text-sm font-black ${editingId === r.id ? "text-primary-foreground" : "text-foreground/80"}`}>{r.year} · {r.term}</h4>
                            <p className={`text-[10px] font-bold uppercase tracking-widest ${editingId === r.id ? "opacity-70" : "text-muted-foreground"}`}>
                              {editingId === r.id ? "Currently Editing" : "Record Confirmed"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className={`text-lg font-black ${editingId === r.id ? "text-primary-foreground" : "text-primary midnight:text-emerald-400"}`}>{r.value}</div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteRecord(r.id); }} 
                              className={`p-2 rounded-lg transition-all ${
                                editingId === r.id ? "text-white hover:bg-white/20" : "text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                              }`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="py-12 text-center text-muted-foreground/40 font-black italic text-sm border-2 border-dashed border-border rounded-[2.5rem]">NO ARCHIVES FOUND</div>}
              </div>

              <div className="p-6 bg-card border border-border rounded-[2rem] flex items-center justify-between opacity-50 grayscale">
                <div className="flex items-center gap-4"><Server className="text-muted-foreground" size={24} /><div><h4 className="text-sm font-black text-muted-foreground">教务系统同步</h4><p className="text-[10px] font-bold text-muted-foreground/60 uppercase">System integration pending...</p></div></div>
                <Badge className="bg-accent text-muted-foreground border-0 text-[9px] font-black">COMING SOON</Badge>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default Stats;
