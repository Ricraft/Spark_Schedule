import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  MapPin,
  RotateCcw,
  Save,
  Sparkles,
  StickyNote,
  Target,
  Zap,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScheduleBridge } from "@/hooks/useScheduleBridge";
import { useTasksBridge } from "@/hooks/useTasksBridge";
import { useSettingsBridge } from "@/hooks/useSettingsBridge";
import { useStudyTime } from "@/hooks/useStudyTime";
import { useFocus } from "@/contexts/FocusContext";
import { useJinriShici } from "@/hooks/useJinriShici";
import { useQWeather } from "@/hooks/useQWeather";
import { useDailyNoteBridge } from "@/hooks/useDailyNoteBridge";
import { invokeBridgeMethodJson, withBridgeTimeout } from "@/utils/bridgeAsyncOperation";
import { getUsableSecret } from "@/utils/secrets";

type SuggestionItem = {
  iconType: "Target" | "AlertCircle" | "Cloud" | "CheckCircle2" | "Sparkles";
  iconColor: string;
  title: string;
  content: string;
  tag: string;
  bg: string;
  border: string;
};

const safeJsonParse = <T,>(raw: unknown, fallback: T): T => {
  try {
    return JSON.parse(String(raw ?? "")) as T;
  } catch {
    return fallback;
  }
};

const WeatherWidget = memo(({ weather, loading }: { weather: any; loading: boolean }) => {
  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl flex items-center gap-3 border border-white/10 shadow-sm">
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        <span className="text-xs text-white/70 font-bold uppercase tracking-widest">Loading...</span>
      </div>
    );
  }
  if (!weather) return null;

  return (
    <div className="bg-white/10 backdrop-blur-xl border border-white/20 px-5 py-3 rounded-2xl shadow-xl hover:bg-white/20 transition-all duration-500 group">
      <div className="flex items-center gap-4">
        <div className="text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform duration-500">{weather.icon}</div>
        <div className="leading-tight">
          <div className="text-2xl font-black text-white tracking-tighter">{weather.temp}°</div>
          <div className="text-[10px] text-white/70 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
            <MapPin size={10} strokeWidth={3} />
            {weather.city} · {weather.text}
          </div>
        </div>
      </div>
    </div>
  );
});

const AiSuggestionsWidget = memo(
  ({
    isAnalyzing,
    suggestions,
    onRefresh,
    className = "",
  }: {
    isAnalyzing: boolean;
    suggestions: SuggestionItem[];
    onRefresh: () => void;
    className?: string;
  }) => {
    const renderIcon = (iconType: SuggestionItem["iconType"], iconColor: string) => {
      const props = { className: `w-4 h-4 ${iconColor}` };
      if (iconType === "Target") return <Target {...props} />;
      if (iconType === "AlertCircle") return <AlertCircle {...props} />;
      if (iconType === "Cloud") return <Cloud {...props} />;
      if (iconType === "CheckCircle2") return <CheckCircle2 {...props} />;
      return <Sparkles {...props} />;
    };

    return (
      <Card
        className={`border-none shadow-xl bg-card/70 border border-border/40 rounded-[2rem] overflow-hidden ${className}`}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-base font-black">学习建议</span>
            </div>
            <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isAnalyzing}>
              <RotateCcw className={`w-4 h-4 ${isAnalyzing ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 h-full">
          {isAnalyzing ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-4 border-accent border-t-primary rounded-full animate-spin" />
              <div className="text-xs text-muted-foreground">正在分析...</div>
            </div>
          ) : (
            suggestions.map((item, idx) => (
              <div
                key={`${item.title}-${idx}`}
                className={`p-4 rounded-2xl border ${item.bg} ${item.border} flex items-start gap-3`}
              >
                <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center">
                  {renderIcon(item.iconType, item.iconColor)}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    {item.tag}
                  </div>
                  <div className="text-sm font-black text-foreground">{item.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{item.content}</div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    );
  }
);

const DailyNoteWidget = memo(({ className = "" }: { className?: string }) => {
  const [date, setDate] = useState(new Date());
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { notes, saveNote, getNote } = useDailyNoteBridge();

  const dateKey = useMemo(
    () =>
      `note_${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`,
    [date]
  );

  useEffect(() => {
    setContent(getNote(dateKey));
  }, [dateKey, notes, getNote]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveNote(dateKey, content);
    } finally {
      setTimeout(() => setIsSaving(false), 600);
    }
  };

  return (
    <Card
      className={`border-none shadow-xl bg-card/70 border border-border/40 rounded-[2rem] overflow-hidden ${className}`}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-amber-500" />
            <span className="text-base font-black">每日小记</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                const d = new Date(date);
                d.setDate(d.getDate() - 1);
                setDate(d);
              }}
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="text-xs font-black tabular-nums px-1">
              {date.getMonth() + 1}/{date.getDate()}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                const d = new Date(date);
                d.setDate(d.getDate() + 1);
                setDate(d);
              }}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 h-full">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="写点今天的记录..."
          className="w-full min-h-[180px] rounded-xl border border-border bg-accent/20 p-3 text-sm outline-none"
        />
        <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2">
          {isSaving ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {isSaving ? "已保存" : "保存笔记"}
        </Button>
      </CardContent>
    </Card>
  );
});

const Dashboard = () => {
  const navigate = useNavigate();
  const { courses } = useScheduleBridge();
  const { tasks, updateTaskStatus } = useTasksBridge();
  const { settings } = useSettingsBridge();
  const { weekHours, weekGoalHours } = useStudyTime();
  const { isActive, mode, timeLeft } = useFocus();
  const { shici } = useJinriShici();
  const { weather, loading: weatherLoading } = useQWeather();

  const [aiSuggestions, setAiSuggestions] = useState<SuggestionItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiRefreshSeq, setAiRefreshSeq] = useState(0);
  const AI_SUGGESTION_TIMEOUT_MS = 4500;
  const AI_SUGGESTION_FAIL_COOLDOWN_MS = 3 * 60 * 1000;
  const AI_SUGGESTION_FAIL_KEY = "dashboard_ai_fail_until";

  const taskStats = useMemo(() => {
    if (!tasks) return { pending: 0, done: 0, overdue: 0 };
    const now = Date.now();
    return {
      pending: tasks.filter((t: any) => t.status !== "done").length,
      done: tasks.filter((t: any) => t.status === "done").length,
      overdue: tasks.filter(
        (t: any) => t.status !== "done" && t.deadline && new Date(t.deadline).getTime() < now
      ).length,
    };
  }, [tasks]);

  const effectiveCurrentWeek = useMemo(
    () => {
      const baseWeek = Number((settings as any)?.current_week || 1);
      const maxWeek = Number((settings as any)?.semester_weeks || 0);
      if (Number.isFinite(maxWeek) && maxWeek > 0) {
        return Math.min(Math.max(1, baseWeek), Math.trunc(maxWeek));
      }
      return Math.max(1, baseWeek);
    },
    [settings]
  );

  const thisWeekCourses = useMemo(
    () =>
      (courses || []).filter((c: any) =>
        (Array.isArray(c.weeks) ? c.weeks : []).includes(effectiveCurrentWeek)
      ).length,
    [courses, effectiveCurrentWeek]
  );

  const nextClass = useMemo(() => {
    if (!courses || !settings) return null;
    const now = new Date();
    const currentDay = ((now.getDay() + 6) % 7) + 1;
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const todayCourses = (courses || []).filter(
      (c: any) =>
        (Array.isArray(c.weeks) ? c.weeks : []).includes(effectiveCurrentWeek) && c.day === currentDay
    );

    for (const c of todayCourses) {
      const s = (settings as any)?.section_times?.[c.start - 1];
      if (!s?.s) continue;
      const [h, m] = String(s.s).split(":").map(Number);
      const startMin = h * 60 + m;
      if (startMin > currentMin) {
        return { ...c, minutesUntil: startMin - currentMin, startTime: s.s };
      }
    }
    return null;
  }, [courses, effectiveCurrentWeek, settings]);

  const dataFingerprint = useMemo(
    () =>
      `${taskStats.pending}-${taskStats.overdue}-${taskStats.done}-${weekHours.toFixed(1)}-${
        weather?.text || "clear"
      }-${Boolean((settings as any)?.ai_learning_enabled)}-${
        (settings as any)?.ai_learning_model || "default"
      }`,
    [taskStats, weekHours, weather, settings]
  );

  const localSuggestions = useCallback((): SuggestionItem[] => {
    const progress = weekGoalHours > 0 ? (weekHours / weekGoalHours) * 100 : 0;
    const list: SuggestionItem[] = [];

    if (progress < 50 && thisWeekCourses > 3) {
      list.push({
        iconType: "Target",
        iconColor: "text-primary",
        title: "进度追赶",
        content: `这周课程较满，你当前完成度为 ${progress.toFixed(0)}%。建议今天预留一段完整专注时段。`,
        tag: "日程",
        bg: "bg-accent/40",
        border: "border-border",
      });
    }
    if (taskStats.overdue > 0) {
      list.push({
        iconType: "AlertCircle",
        iconColor: "text-destructive",
        title: "逾期清理",
        content: `你有 ${taskStats.overdue} 个逾期任务。先处理一个关键任务，再批量清理小任务。`,
        tag: "风险",
        bg: "bg-destructive/10",
        border: "border-destructive/30",
      });
    }
    if (weather?.text?.includes("雨")) {
      list.push({
        iconType: "Cloud",
        iconColor: "text-primary",
        title: "利用天气窗口",
        content: "下雨天通常更安静，适合深度学习。现在处理最难的一章或一组题目。",
        tag: "环境",
        bg: "bg-accent/40",
        border: "border-border",
      });
    }
    if (taskStats.pending > 0 && taskStats.pending <= 3) {
      list.push({
        iconType: "CheckCircle2",
        iconColor: "text-primary",
        title: "快速收尾",
        content: `只剩 ${taskStats.pending} 个任务，建议现在清空，为明天留出更多精力。`,
        tag: "任务",
        bg: "bg-accent/40",
        border: "border-border",
      });
    }
    if (list.length === 0) {
      list.push({
        iconType: "Sparkles",
        iconColor: "text-primary",
        title: "状态稳定",
        content: "你的节奏比较平稳，继续保留一段不被打断的学习时间用于巩固和复盘。",
        tag: "总览",
        bg: "bg-accent/40",
        border: "border-border",
      });
    }
    return list.slice(0, 3);
  }, [taskStats, thisWeekCourses, weather, weekGoalHours, weekHours]);

  const sanitizeSuggestions = useCallback((items: any[]): SuggestionItem[] => {
    if (!Array.isArray(items)) return [];
    const allowedIcons = new Set(["Target", "AlertCircle", "Cloud", "CheckCircle2", "Sparkles"]);
    return items
      .filter((it) => it && typeof it === "object" && it.title && it.content)
      .map((it) => {
        const iconType = allowedIcons.has(it.iconType) ? it.iconType : "Sparkles";
        return {
          iconType,
          iconColor: iconType === "AlertCircle" ? "text-destructive" : "text-primary",
          title: String(it.title),
          content: String(it.content),
          tag: String(it.tag || "AI建议"),
          bg: iconType === "AlertCircle" ? "bg-destructive/10" : "bg-accent/40",
          border: iconType === "AlertCircle" ? "border-destructive/30" : "border-border",
        } as SuggestionItem;
      })
      .slice(0, 3);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `dashboard_ai_v2:${dataFingerprint}`;
    const failUntil = Number(localStorage.getItem(AI_SUGGESTION_FAIL_KEY) || "0");

    const loadSuggestions = async () => {
      if (aiRefreshSeq === 0) {
        const cache = localStorage.getItem(cacheKey);
        if (cache) {
          const parsed = sanitizeSuggestions(safeJsonParse<any[]>(cache, []));
          if (parsed.length > 0) {
            setAiSuggestions(parsed);
            return;
          }
        }
      }

      setIsAnalyzing(true);
      let next = localSuggestions();
      let attemptedRemote = false;

      try {
        const bridge = (window as any).pyBridge;
        const aiEnabled = Boolean((settings as any)?.ai_learning_enabled);
        const apiKeyConfigured = Boolean(
          getUsableSecret((settings as any)?.ai_learning_api_key, (settings as any)?.ai_api_key)
        );
        if (aiEnabled && apiKeyConfigured && bridge?.get_learning_suggestions_with_ai) {
          const inFailCooldown = aiRefreshSeq === 0 && failUntil > Date.now();
          if (inFailCooldown) {
            if (cancelled) return;
            setAiSuggestions(next);
            setIsAnalyzing(false);
            localStorage.setItem(cacheKey, JSON.stringify(next));
            return;
          }

          attemptedRemote = true;
          const payload = {
            week_hours: weekHours,
            week_goal_hours: weekGoalHours,
            task_stats: taskStats,
            this_week_courses: thisWeekCourses,
            weather: weather ? { text: weather.text, temp: weather.temp, city: weather.city } : {},
            next_class: nextClass
              ? {
                  name: (nextClass as any).name,
                  start_time: (nextClass as any).startTime,
                  minutes_until: (nextClass as any).minutesUntil,
                }
              : {},
            focus_state: { is_active: isActive, mode, time_left: timeLeft },
          };

          let result: any = {};
          if (bridge?.get_learning_suggestions_with_ai_async && bridge?.get_async_operation_result) {
            result = await invokeBridgeMethodJson(
              bridge,
              "get_learning_suggestions_with_ai_async",
              [JSON.stringify(payload)],
              {
                kickoffTimeoutMs: 1500,
                pollTimeoutMs: AI_SUGGESTION_TIMEOUT_MS,
                pollIntervalMs: 180,
              }
            );
          } else {
            const raw = await withBridgeTimeout(
              Promise.resolve(bridge.get_learning_suggestions_with_ai(JSON.stringify(payload))),
              AI_SUGGESTION_TIMEOUT_MS,
              "AI suggestion request timeout"
            );
            result = safeJsonParse<any>(raw, {});
          }

          const remote = sanitizeSuggestions(result?.data || []);
          if (result?.status === "success" && remote.length > 0) {
            next = remote;
            localStorage.removeItem(AI_SUGGESTION_FAIL_KEY);
          } else {
            localStorage.setItem(
              AI_SUGGESTION_FAIL_KEY,
              String(Date.now() + AI_SUGGESTION_FAIL_COOLDOWN_MS)
            );
          }
        }
      } catch (error) {
        if (attemptedRemote) {
          localStorage.setItem(
            AI_SUGGESTION_FAIL_KEY,
            String(Date.now() + AI_SUGGESTION_FAIL_COOLDOWN_MS)
          );
        }
        console.warn("[Dashboard] AI suggestion request failed, fallback to local rules:", error);
      }

      if (cancelled) return;
      setAiSuggestions(next);
      setIsAnalyzing(false);
      localStorage.setItem(cacheKey, JSON.stringify(next));
    };

    loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [
    aiRefreshSeq,
    dataFingerprint,
    isActive,
    localSuggestions,
    mode,
    nextClass,
    sanitizeSuggestions,
    settings,
    taskStats,
    thisWeekCourses,
    timeLeft,
    weather,
    weekGoalHours,
    weekHours,
  ]);

  useEffect(() => {
    const handleRefresh = () => {
      localStorage.removeItem("qweather_cache");
      localStorage.removeItem("jinrishici_cache");
      window.dispatchEvent(new CustomEvent("forceRefreshWeather"));
      window.dispatchEvent(new CustomEvent("forceRefreshShici"));
    };
    window.addEventListener("refreshWeatherAndShici", handleRefresh);
    return () => window.removeEventListener("refreshWeatherAndShici", handleRefresh);
  }, []);

  const pendingTasks = useMemo(
    () => (tasks || []).filter((t: any) => t.status !== "done").slice(0, 5),
    [tasks]
  );

  return (
    <AppLayout title="仪表盘">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 pb-10 items-stretch animate-in fade-in duration-1000">
        <div className="xl:col-span-12">
          <div className="dashboard-hero relative rounded-[3rem] p-10 text-white shadow-2xl shadow-black/20 overflow-hidden group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />
            
            <div className="relative flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="space-y-4 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3">
                   <div className="w-10 h-1 bg-white/40 rounded-full" />
                   <Badge className="bg-white/20 text-white border-none px-3 py-1 font-black uppercase tracking-widest text-[10px]">Spark Dashboard</Badge>
                </div>
                <h2 className="text-5xl font-black tracking-tighter leading-tight">
                  {new Date().getHours() < 12
                    ? "早上好"
                    : new Date().getHours() < 18
                      ? "下午好"
                      : "晚上好"}
                  ，<span className="text-indigo-100 italic">Sparker</span> ✨
                </h2>
                {Boolean((settings as any)?.shici_enabled) && shici?.content && (
                  <p className="text-base mt-4 opacity-80 font-medium max-w-xl italic leading-relaxed">
                    "{shici.content}"
                  </p>
                )}
              </div>
              {Boolean((settings as any)?.weather_enabled) && (
                <WeatherWidget weather={weather} loading={weatherLoading} />
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card
              onClick={() => (nextClass ? navigate("/schedule") : undefined)}
              className={`border-none shadow-xl rounded-[2.5rem] relative overflow-hidden group/stat transition-all duration-500 hover:-translate-y-1 ${
                nextClass
                  ? "bg-primary text-primary-foreground cursor-pointer hover:shadow-primary/30"
                  : "bg-card/40 border border-white/20"
              }`}
            >
              <CardContent className="pt-8 pb-8 px-8">
                <div className="flex justify-between items-center mb-6">
                  <Badge
                    className={`border-0 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
                      nextClass ? "bg-white/20 text-white" : "bg-accent/50 text-muted-foreground"
                    }`}
                  >
                    Next Class
                  </Badge>
                  {nextClass && <ArrowRight size={18} className="opacity-60 group-hover/stat:translate-x-1 transition-transform" />}
                </div>
                {nextClass ? (
                  <>
                    <div className="text-2xl font-black truncate tracking-tighter">{(nextClass as any).name}</div>
                    <div className="mt-4 text-xs font-bold opacity-70 flex justify-between items-center uppercase tracking-wider">
                      <span className="flex items-center gap-2">
                        <MapPin size={12} strokeWidth={3} />
                        {(nextClass as any).location || "TBD"}
                      </span>
                      <span className="bg-white/20 px-2 py-1 rounded-lg">{(nextClass as any).startTime}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-base font-bold text-muted-foreground/60 py-2">今日暂无课程</div>
                )}
              </CardContent>
              {nextClass && <div className="absolute bottom-0 right-0 p-2 opacity-10"><Zap size={40} /></div>}
            </Card>

            <Card className="border-none shadow-xl rounded-[2.5rem] bg-card/40 border border-white/20 group/stat hover:shadow-lg transition-all duration-500 hover:-translate-y-1">
              <CardHeader className="pb-4 pt-8 px-8">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" /> Study Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                <div className="flex justify-between items-end mb-4">
                  <div className="text-4xl font-black tracking-tighter">
                    {weekHours}
                    <span className="text-sm text-muted-foreground font-bold tracking-normal ml-1"> / {weekGoalHours}h</span>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-none font-black text-xs px-2 py-1 mb-1">
                    {weekGoalHours > 0 ? ((weekHours / weekGoalHours) * 100).toFixed(0) : 0}%
                  </Badge>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-200/50">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 rounded-full shadow-sm transition-all duration-1000"
                    style={{ width: `${Math.min(100, weekGoalHours > 0 ? (weekHours / weekGoalHours) * 100 : 0)}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card
              onClick={() => navigate("/focus")}
              className={`border-none shadow-xl rounded-[2.5rem] cursor-pointer transition-all duration-500 hover:-translate-y-1 group/stat ${
                isActive ? "bg-primary/10 border border-primary/20" : "bg-card/40 border border-border/40"
              }`}
            >
              <CardHeader className="pb-4 pt-8 px-8">
                <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} /> Focus Mode
                </CardTitle>
              </CardHeader>
              <CardContent className="px-8 pb-8">
                {isActive ? (
                  <div className="flex flex-col gap-4">
                    <span className="text-4xl font-black font-mono tracking-tighter text-primary">
                      {Math.floor(timeLeft / 60)
                        .toString()
                        .padStart(2, "0")}
                      :{(timeLeft % 60).toString().padStart(2, "0")}
                    </span>
                    <div className="text-[10px] font-black uppercase tracking-widest text-center py-1.5 rounded-xl bg-primary text-primary-foreground">
                      {mode === "focus" ? "专注中" : "休息中"}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-6 py-1">
                    <div className="text-4xl group-hover:scale-110 transition-transform duration-500">🍅</div>
                    <div>
                      <p className="text-lg font-black text-foreground tracking-tight">开始专注</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Ready to work?</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <QuickStat icon={<Calendar size={14} />} value={thisWeekCourses} label="课程数" color="text-indigo-600" onClick={() => navigate("/schedule")} />
            <QuickStat icon={<CheckCircle2 size={14} />} value={taskStats.pending} label="待办任务" color="text-amber-500" onClick={() => navigate("/tasks")} />
            <QuickStat icon={<Target size={14} />} value={taskStats.done} label="已完成" color="text-emerald-500" onClick={() => navigate("/tasks")} />
          </div>
        </div>

        <div className="xl:col-span-4">
          <Card className="border-none shadow-2xl bg-card/40 backdrop-blur-3xl border border-white/20 rounded-[2.5rem] h-full flex flex-col group/card overflow-hidden">
            <CardHeader className="pb-4 pt-8 px-8">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-500/10 rounded-2xl text-rose-500 ring-1 ring-rose-500/20 group-hover/card:bg-rose-500 group-hover/card:text-white transition-all duration-500">
                    <Zap size={18} />
                  </div>
                  <span className="text-xl font-black tracking-tighter">待办清单</span>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl hover:bg-rose-50" onClick={() => navigate("/tasks")}>
                  <ArrowRight size={20} className="text-muted-foreground" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto px-8 pb-8 space-y-4 custom-scrollbar">
              {taskStats.pending === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-30 py-20">
                  <Sparkles size={64} className="mb-4 stroke-[1px]" />
                  <p className="text-sm font-black uppercase tracking-[0.2em]">All Caught Up!</p>
                </div>
              ) : (
                pendingTasks.map((task: any) => (
                  <div
                    key={task.id}
                    onClick={() => navigate("/tasks")}
                    className="group/item flex items-center gap-4 p-5 rounded-2xl bg-white/40 border border-white/60 cursor-pointer hover:bg-white/80 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-500/10" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black truncate text-slate-800">{task.title}</h4>
                      <div className="text-[10px] text-muted-foreground font-bold flex items-center gap-2 mt-1.5 uppercase tracking-widest opacity-60">
                        <Calendar size={10} strokeWidth={3} />
                        {task.deadline ? String(task.deadline).split(" ")[0] : "No Deadline"}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTaskStatus(task.id, "done");
                      }}
                      className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all shadow-sm"
                    >
                      <CheckCircle2 size={14} strokeWidth={3} />
                    </button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="xl:col-span-8">
          <DailyNoteWidget className="min-h-[420px] h-full" />
        </div>
        <div className="xl:col-span-4">
          <AiSuggestionsWidget
            className="min-h-[420px] h-full"
            isAnalyzing={isAnalyzing}
            suggestions={aiSuggestions}
            onRefresh={() => {
              localStorage.removeItem(`dashboard_ai_v2:${dataFingerprint}`);
              localStorage.removeItem(AI_SUGGESTION_FAIL_KEY);
              setAiRefreshSeq((v) => v + 1);
            }}
          />
        </div>
      </div>
    </AppLayout>
  );
};

// 辅助组件：快速统计卡片
const QuickStat = ({ icon, value, label, color, onClick }: any) => (
  <Card onClick={onClick} className="cursor-pointer border border-white/20 bg-card/40 backdrop-blur shadow-xl rounded-[2rem] group hover:bg-white/60 transition-all duration-500 hover:-translate-y-1">
    <CardContent className="py-8 px-6 text-center flex flex-col items-center gap-3">
      <div className={`p-2 rounded-xl bg-slate-50 ${color} opacity-80 group-hover:scale-110 group-hover:opacity-100 transition-all`}>
        {icon}
      </div>
      <div>
        <div className={`text-3xl font-black tracking-tighter ${color}`}>{value}</div>
        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1">{label}</div>
      </div>
    </CardContent>
  </Card>
);

export default Dashboard;
