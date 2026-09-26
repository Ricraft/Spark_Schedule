import React, { useEffect, useState } from 'react';
import {
  X,
  Sparkles,
  Send,
  Loader2,
  BrainCircuit,
  Lightbulb,
  Info,
  Settings,
  Save,
  ChevronLeft,
  Key,
  Globe,
  Cpu,
  Terminal,
  Calendar,
  BookOpen,
  Flag,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RotateCcw,
  Check,
} from 'lucide-react';
import { useSettingsBridge } from '@/hooks/useSettingsBridge';
import { invokeBridgeMethodJson, withBridgeTimeout } from '@/utils/bridgeAsyncOperation';
import { getUsableSecret, isRedactedSecret } from '@/utils/secrets';

interface AITaskImportPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type AISettings = {
  ai_provider: string;
  ai_task_api_key: string;
  ai_task_base_url: string;
  ai_task_model: string;
  ai_task_prompt: string;
};

type ParsedTask = {
  id?: string;
  title: string;
  course_name: string;
  deadline: string;
  is_exam: boolean;
  description: string;
  priority?: string;
  tags?: string[];
  status?: string;
};

const defaultSettings: AISettings = {
  ai_provider: 'openai',
  ai_task_api_key: '',
  ai_task_base_url: 'https://api.openai.com/v1',
  ai_task_model: 'gpt-3.5-turbo',
  ai_task_prompt: '',
};

const normalizeDeadline = (value: unknown): string => {
  const text = String(value || '').trim();
  if (!text) return `${new Date().toISOString().split('T')[0]} 23:59`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text} 23:59`;
  return text;
};

const parseJsonSafe = (value: unknown) => {
  try {
    return JSON.parse(String(value || '{}'));
  } catch {
    return {};
  }
};

export const AITaskImportPanel = ({ isOpen, onClose }: AITaskImportPanelProps) => {
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [aiInfo, setAiInfo] = useState<any>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  const { settings, updateSettings } = useSettingsBridge();
  const [localSettings, setLocalSettings] = useState<AISettings>(defaultSettings);

  useEffect(() => {
    if (!isOpen || !settings) return;
    setLocalSettings({
      ai_provider: (settings as any).ai_provider || 'openai',
      ai_task_api_key: (settings as any).ai_task_api_key || (settings as any).ai_api_key || '',
      ai_task_base_url: (settings as any).ai_task_base_url || (settings as any).ai_base_url || 'https://api.openai.com/v1',
      ai_task_model: (settings as any).ai_task_model || (settings as any).ai_model || 'gpt-3.5-turbo',
      ai_task_prompt: (settings as any).ai_task_prompt || (settings as any).ai_system_prompt || '',
    });
    // Reset state when opening
    setImportStatus({ type: null, message: '' });
  }, [settings, isOpen]);

  const handleSaveSettings = async () => {
    const ok = await updateSettings({
      ai_provider: localSettings.ai_provider,
      ai_task_api_key: localSettings.ai_task_api_key,
      ai_task_base_url: localSettings.ai_task_base_url,
      ai_task_model: localSettings.ai_task_model,
      ai_task_prompt: localSettings.ai_task_prompt,
    } as any);
    if (ok) {
      setShowSettings(false);
      return;
    }
    setImportStatus({ type: 'error', message: '保存 AI 配置失败，请重试' });
  };

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;
    const apiKey = getUsableSecret(
      (settings as any)?.ai_task_api_key,
      (settings as any)?.ai_api_key,
      localSettings.ai_task_api_key
    );
    if (!apiKey) {
      setShowSettings(true);
      return;
    }

    setIsAnalyzing(true);
    setAiInfo(null);
    setImportStatus({ type: null, message: '' });
    
    try {
      const bridge = (window as any).pyBridge;
      if (!bridge) throw new Error('Bridge 接口不可用');

      let result: { status?: string; message?: string; data?: any; ai_info?: any } = {};
      if (bridge?.analyze_task_with_ai_async && bridge?.get_async_operation_result) {
        result = await invokeBridgeMethodJson(bridge, 'analyze_task_with_ai_async', [inputText], {
          kickoffTimeoutMs: 1500,
          pollTimeoutMs: 16000,
          pollIntervalMs: 180,
        });
      } else if (bridge?.analyze_task_with_ai) {
        const resultJson = await withBridgeTimeout(
          Promise.resolve(bridge.analyze_task_with_ai(inputText)),
          12000,
          'AI 任务解析请求超时'
        );
        result = parseJsonSafe(resultJson) as { status?: string; message?: string; data?: any; ai_info?: any };
      } else {
        throw new Error('Bridge AI 接口不可用');
      }
      
      if (result.status !== 'success') throw new Error(result.message || 'AI 解析失败');

      if (result.ai_info) setAiInfo(result.ai_info);

      const aiData = result.data;
      const tasks = Array.isArray(aiData) ? aiData : [aiData];
      
      const normalized = tasks.map(t => ({
        ...t,
        deadline: normalizeDeadline(t.deadline),
        priority: t.priority || 'normal',
        tags: t.tags || [],
      }));

      setParsedTasks(normalized);
    } catch (error: any) {
      setImportStatus({ type: 'error', message: error?.message || '未知错误' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImportAll = async () => {
    if (parsedTasks.length === 0) return;
    
    setIsImporting(true);
    try {
      const bridge = (window as any).pyBridge;
      let successCount = 0;

      for (const task of parsedTasks) {
        const addResult = await bridge.add_task(JSON.stringify({ ...task, status: 'todo' }));
        const res = parseJsonSafe(addResult);
        if (res.status === 'success') successCount++;
      }

      window.dispatchEvent(new CustomEvent('taskDataUpdated', { detail: { action: 'refresh' } }));
      
      setImportStatus({ 
        type: 'success', 
        message: `成功导入 ${successCount} 个任务！` 
      });

      // Clear after delay
      setTimeout(() => {
        setParsedTasks([]);
        setInputText('');
        onClose();
      }, 2000);
    } catch (error: any) {
      setImportStatus({ type: 'error', message: '导入过程发生异常' });
    } finally {
      setIsImporting(false);
    }
  };

  const removeParsedTask = (index: number) => {
    setParsedTasks(prev => prev.filter((_, i) => i !== index));
  };

  const suggestions = [
    '明天上午6点考化学，下午4点考生物',
    '下周一交数学作业，周三交物理实验报告',
    '今晚10点去跑步',
  ];

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px] transition-all duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <div
        className={`fixed top-4 right-4 bottom-4 w-[580px] z-50 flex flex-col shadow-[-20px_0_80px_rgba(0,0,0,0.1)] transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1)
        ${isOpen ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-12 opacity-0 scale-95 pointer-events-none'}
        mica rounded-[3.5rem] overflow-hidden animate-in`}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-8 pb-4">
          <div className="flex items-center gap-4">
            {showSettings || parsedTasks.length > 0 ? (
              <button
                onClick={() => {
                  if (showSettings) setShowSettings(false);
                  else setParsedTasks([]);
                }}
                className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-200">
                <Sparkles className="text-white w-5 h-5 animate-pulse-slow" />
              </div>
            )}
            <div className="flex flex-col">
              <h2 className="text-xl font-black text-slate-800 tracking-tight leading-none">
                {showSettings ? 'AI 配置' : parsedTasks.length > 0 ? '任务预览' : 'AI 智能导入'}
              </h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                {showSettings ? 'API Settings' : parsedTasks.length > 0 ? 'Review & Confirm' : 'Intelligent Assistant'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {!showSettings && parsedTasks.length === 0 && (
              <button
                onClick={() => setShowSettings(true)}
                className="h-11 w-11 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all duration-300"
              >
                <Settings size={20} />
              </button>
            )}
            <button
              onClick={onClose}
              className="h-11 w-11 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-2xl transition-all duration-300"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-8 py-4 space-y-6 custom-scrollbar relative">
          {importStatus.type && (
            <div className={`p-4 rounded-3xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500 ${
              importStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
            }`}>
              {importStatus.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span className="text-sm font-bold">{importStatus.message}</span>
            </div>
          )}

          {!showSettings ? (
            parsedTasks.length > 0 ? (
              /* Preview Mode */
              <div className="space-y-4 pb-8">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">已识别 {parsedTasks.length} 个任务</span>
                  <button onClick={() => setParsedTasks([])} className="text-xs font-bold text-indigo-500 flex items-center gap-1 hover:underline">
                    <RotateCcw size={12} /> 重新输入
                  </button>
                </div>
                
                {parsedTasks.map((task, idx) => (
                  <div key={idx} className="group relative bg-white/60 border border-white hover:border-indigo-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                    <button 
                      onClick={() => removeParsedTask(idx)}
                      className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                    
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 h-3 w-3 rounded-full shrink-0 ${task.is_exam ? 'bg-rose-500 animate-pulse' : 'bg-indigo-400'}`} />
                        <div className="space-y-1">
                          <h3 className="text-lg font-black text-slate-800 leading-tight">{task.title}</h3>
                          <div className="flex flex-wrap gap-2">
                            {task.tags?.map((tag, tIdx) => (
                              <span key={tIdx} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase">{tag}</span>
                            ))}
                            {task.is_exam && <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-black uppercase">考试/重要 DDL</span>}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="flex items-center gap-2.5 text-slate-500">
                          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                            <Calendar size={14} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">截止时间</span>
                            <span className="text-xs font-bold text-slate-700">{task.deadline}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 text-slate-500">
                          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                            <BookOpen size={14} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">关联课程</span>
                            <span className="text-xs font-bold text-slate-700">{task.course_name || '个人事务'}</span>
                          </div>
                        </div>
                      </div>

                      {task.description && (
                        <div className="p-4 bg-slate-50/50 rounded-2xl">
                          <p className="text-xs text-slate-500 font-medium leading-relaxed italic">"{task.description}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* AI Detail Summary in Preview */}
                {aiInfo && (
                  <details className="mt-8 opacity-60 hover:opacity-100 transition-opacity">
                    <summary className="text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer list-none flex items-center gap-2">
                      <BrainCircuit size={12} /> AI 解析元数据
                    </summary>
                    <div className="mt-4 p-6 bg-white/40 border border-white rounded-[2rem] text-[10px] font-mono text-slate-500 space-y-2">
                      <div>Model: {aiInfo.model}</div>
                      <div>Context Time: {aiInfo.context_used?.current_time || aiInfo.context_time || '-'}</div>
                      <div className="max-h-32 overflow-y-auto pt-2 border-t border-slate-100">
                        Response: {aiInfo.raw_response || aiInfo.raw || '-'}
                      </div>
                    </div>
                  </details>
                )}
              </div>
            ) : (
              /* Input Mode */
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <BrainCircuit size={12} className="stroke-[3px]" /> 描述你的任务
                    </label>
                    {!getUsableSecret((settings as any)?.ai_task_api_key, (settings as any)?.ai_api_key, localSettings.ai_task_api_key) && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 rounded-full border border-amber-100">
                        <Info size={10} className="text-amber-500" />
                        <span className="text-[9px] font-black text-amber-600 uppercase">请先配置 API Key</span>
                      </div>
                    )}
                  </div>

                  <div className="relative group">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="直接输入文本，例如：明天下午两点在教三考数学..."
                      className="w-full h-72 bg-white/60 border border-white rounded-[2.5rem] p-8 text-lg font-medium resize-none outline-none focus:bg-white focus:ring-8 focus:ring-indigo-500/5 transition-all shadow-sm placeholder:text-slate-200 text-slate-700 leading-relaxed"
                      disabled={isAnalyzing}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Lightbulb size={12} className="stroke-[3px]" /> 快速选择建议
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setInputText(s)}
                        className="px-4 py-2.5 bg-white/40 border border-white hover:bg-white hover:border-indigo-100 hover:text-indigo-600 rounded-2xl text-xs font-bold text-slate-500 transition-all active:scale-95 shadow-sm"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )
          ) : (
            /* Settings Mode */
            <div className="space-y-6 pb-10">
              <div className="space-y-4">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Globe size={12} className="stroke-[3px]" /> API 提供商与地址
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {['openai', 'deepseek', 'custom'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setLocalSettings({ ...localSettings, ai_provider: p })}
                      className={`py-3 rounded-2xl text-xs font-bold border transition-all ${
                        localSettings.ai_provider === p
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                          : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-200'
                      }`}
                    >
                      {p.toUpperCase()}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={localSettings.ai_task_base_url}
                  onChange={(e) => setLocalSettings({ ...localSettings, ai_task_base_url: e.target.value })}
                  placeholder="API Base URL"
                  className="w-full bg-white border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Key size={12} className="stroke-[3px]" /> API KEY
                </label>
                <input
                  type="password"
                  value={isRedactedSecret(localSettings.ai_task_api_key) ? '' : localSettings.ai_task_api_key}
                  onChange={(e) => setLocalSettings({ ...localSettings, ai_task_api_key: e.target.value })}
                  placeholder={isRedactedSecret(localSettings.ai_task_api_key) ? '已配置密钥（隐藏）；留空保持不变，输入新密钥可替换' : 'sk-...'}
                  autoComplete="new-password"
                  className="w-full bg-white border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Cpu size={12} className="stroke-[3px]" /> 模型名称
                </label>
                <input
                  type="text"
                  value={localSettings.ai_task_model}
                  onChange={(e) => setLocalSettings({ ...localSettings, ai_task_model: e.target.value })}
                  placeholder="gpt-4o-mini / deepseek-chat"
                  className="w-full bg-white border border-slate-100 rounded-2xl py-3 px-4 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-8 bg-white/40 backdrop-blur-xl border-t border-white/40">
          {showSettings ? (
            <button
              onClick={handleSaveSettings}
              className="w-full py-5 rounded-[1.75rem] font-black text-lg text-white shadow-2xl flex items-center justify-center gap-3 transition-all duration-500 active:scale-95 hover:scale-[1.02] bg-gradient-to-r from-slate-700 to-slate-800"
            >
              <Save size={22} className="stroke-[2.5px]" />
              <span>保存配置</span>
            </button>
          ) : parsedTasks.length > 0 ? (
            <div className="flex gap-4">
              <button
                onClick={() => setParsedTasks([])}
                className="flex-1 py-5 rounded-[1.75rem] font-black text-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95"
              >
                取消
              </button>
              <button
                onClick={handleImportAll}
                disabled={isImporting}
                className="flex-[2] py-5 rounded-[1.75rem] font-black text-lg text-white shadow-2xl flex items-center justify-center gap-3 transition-all duration-500 active:scale-95 hover:scale-[1.02] bg-gradient-to-r from-emerald-500 to-teal-500 disabled:opacity-50"
              >
                {isImporting ? <Loader2 size={24} className="animate-spin" /> : <Check size={22} className="stroke-[3px]" />}
                <span>确认并导入全部</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !inputText.trim()}
              className="w-full py-5 rounded-[1.75rem] font-black text-lg text-white shadow-2xl flex items-center justify-center gap-3 transition-all duration-500 active:scale-95 hover:scale-[1.02] hover:shadow-indigo-200 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 disabled:opacity-50 group"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={24} className="animate-spin" />
                  <span>AI 正在全力解析中...</span>
                </>
              ) : (
                <>
                  <Send size={22} className="stroke-[2.5px] group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  <span>立即分析任务</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
};
