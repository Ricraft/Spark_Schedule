import { useEffect, useMemo, useRef, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Palette,
  Bell,
  CloudSun,
  BrainCircuit,
  Database,
  Info,
  Github,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Terminal,
  Save,
  Volume2,
  Clock,
  Layout,
  Bug,
  Loader2,
  ArrowUpCircle,
  CheckCircle2,
  Download,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { useSettingsBridge } from "@/hooks/useSettingsBridge";
import { isRedactedSecret } from "@/utils/secrets";

type SettingsData = {
  [key: string]: any;
};

const ensureRange = (value: number, min: number, max: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

const parseBridgeResult = (raw: unknown) => {
  if (typeof raw !== "string") return { status: "error", message: "Invalid response" };
  try {
    return JSON.parse(raw);
  } catch {
    return { status: "error", message: "Invalid response" };
  }
};

const Settings = () => {
  const { settings, updateSettings, export_all_data, reset_app_data, loading, error } = useSettingsBridge();
  const [draft, setDraft] = useState<SettingsData>({});
  const [working, setWorking] = useState(false);

  const DEFAULT_TASK_PROMPT = `你是一个专业的课程与任务管理助手。请从用户输入的描述中提取任务信息，并以JSON格式返回。字段包括：title (任务标题), course_name (关联课程或分类), deadline (截止时间，格式YYYY-MM-DD HH:mm), is_exam (是否为考试, 布尔值), description (详细描述)。请务必只返回JSON对象，不要包含任何其他文字说明。如果时间信息不完整，请假定当前年份。`;

  const DEFAULT_LEARNING_PROMPT = `你是一个贴心的学习管家和时间管理专家。根据用户的任务进度、学习时长和课程安排，提供个性化的学习策略、复习计划和鼓励。请用温暖、积极的语气回复，并给出具体可行的建议。`;

  const busy = loading || working;

  const syncThemeClassList = (snapshot: SettingsData) => {
    const useMidnight = Boolean(snapshot.midnight_mode);
    const useDark = Boolean(snapshot.dark_mode || useMidnight);
    document.documentElement.classList.toggle("dark", useDark);
    document.documentElement.classList.toggle("midnight", useMidnight);
  };

  const applyRuntimeStyles = (snapshot: SettingsData) => {
    syncThemeClassList(snapshot);

    const transitionsEnabled = snapshot.ui_transitions !== false;
    document.documentElement.classList.toggle("no-transitions", !transitionsEnabled);
    if (transitionsEnabled) {
      document.documentElement.style.removeProperty("--transition-duration");
    } else {
      document.documentElement.style.setProperty("--transition-duration", "0ms");
    }
    document.documentElement.classList.toggle("reduce-motion", snapshot.ui_animations === false);

    const gpuEnabled = snapshot.gpu_acceleration !== false;
    document.documentElement.classList.toggle("gpu-disabled", !gpuEnabled);
    document.body.classList.toggle("gpu-disabled", !gpuEnabled);

    const acrylicPercent = ensureRange(Number(snapshot.acrylic_opacity ?? 80), 0, 100, 80);
    const acrylicOpacity = acrylicPercent / 100;
    document.documentElement.style.setProperty("--acrylic-opacity", `${acrylicOpacity}`);
    document.documentElement.style.setProperty("--glass-bg-opacity", `${acrylicOpacity}`);

    let acrylicStyle = document.getElementById("acrylic-opacity-style");
    if (!acrylicStyle) {
      acrylicStyle = document.createElement("style");
      acrylicStyle.id = "acrylic-opacity-style";
      document.head.appendChild(acrylicStyle);
    }
    acrylicStyle.textContent = `.acrylic, .glass-card { backdrop-filter: blur(${Math.round(6 + acrylicOpacity * 14)}px); }`;

    const backgroundPath = String(snapshot.background_image || "").trim();
    document.documentElement.classList.toggle("has-custom-background", Boolean(backgroundPath));
    if (backgroundPath) {
      const normalizedPath = backgroundPath.replace(/\\/g, "/");
      document.body.style.backgroundImage = `url(${JSON.stringify(`file:///${normalizedPath}`)})`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundAttachment = "fixed";
    } else {
      document.body.style.backgroundImage = "";
      document.body.style.backgroundSize = "";
      document.body.style.backgroundPosition = "";
      document.body.style.backgroundAttachment = "";
    }
  };

  useEffect(() => {
    if (settings) {
      setDraft(settings);
      applyRuntimeStyles(settings);
    }
  }, [settings]);

  const toggleField = async (key: string, value: boolean, label: string) => {
    const previous = draft[key];
    const nextDraft = { ...draft, [key]: value };
    setDraft(nextDraft);
    applyRuntimeStyles(nextDraft);

    const ok = await updateSettings({ [key]: value });
    if (ok) {
      toast.success(`${label}已${value ? "开启" : "关闭"}`);
      return;
    }

    const revertedDraft = { ...nextDraft, [key]: previous };
    setDraft(revertedDraft);
    applyRuntimeStyles(revertedDraft);
    toast.error(`${label}保存失败`);
  };

  const saveSection = async (title: string, updates: Record<string, any>) => {
    setWorking(true);
    const ok = await updateSettings(updates);
    setWorking(false);
    if (ok) toast.success(`${title}已保存`);
    else toast.error(`${title}保存失败`);
  };

  const clearRuntimeCache = async () => {
    try {
      const bridge = (window as any).pyBridge;
      if (!bridge?.clear_runtime_cache) {
        toast.error("后端缓存清理接口不可用");
        return;
      }
      const result = parseBridgeResult(await bridge.clear_runtime_cache());
      if (result?.status === "success") {
        toast.success("运行缓存已清理");
      } else {
        toast.error(result?.message || "清理缓存失败");
      }
    } catch (e) {
      toast.error(`清理缓存失败: ${String(e)}`);
    }
  };

  const exportAll = async () => {
    try {
      const result = await export_all_data();
      if (result?.success) {
        toast.success("导出成功，已保存到本地");
      } else {
        toast.error("导出失败");
      }
    } catch (e) {
      toast.error(`导出失败: ${String(e)}`);
    }
  };

  const resetAll = async () => {
    try {
      const result = await reset_app_data();
      if (result?.success) {
        toast.success("应用数据已重置");
      } else {
        toast.error("重置失败");
      }
    } catch (e) {
      toast.error(`重置失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const APP_VERSION = "v1.2.5-stable";

  return (
    <AppLayout title="设置中心">
      <div className="mx-auto w-full max-w-6xl pb-10">
        {error && (
          <Card className="border-destructive/50 bg-destructive/5 mb-6">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <ShieldCheck className="h-5 w-5 text-destructive" />
              <div>
                <CardTitle className="text-destructive text-base">配置加载异常</CardTitle>
                <CardDescription className="text-destructive/80">{error}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        )}

        <Tabs defaultValue="appearance" className="flex flex-col md:flex-row gap-8">
          {/* 左侧侧边栏导航 */}
          <div className="md:w-64 shrink-0">
            <div className="sticky top-6 space-y-4">
              <div className="px-3 py-2">
                <h2 className="mb-4 px-4 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                  偏好设置
                </h2>
                <TabsList className="flex md:flex-col h-auto bg-transparent p-0 gap-1 items-stretch">
                  <SidebarItem value="appearance" icon={<Palette className="h-4 w-4" />} label="外观与系统" />
                  <SidebarItem value="notifications" icon={<Bell className="h-4 w-4" />} label="通知提醒" />
                  <SidebarItem value="services" icon={<CloudSun className="h-4 w-4" />} label="外部服务与 AI" />
                  <SidebarItem value="data" icon={<Database className="h-4 w-4" />} label="数据管理" />
                  <Separator className="my-2 mx-4 opacity-50" />
                  <SidebarItem value="about" icon={<Info className="h-4 w-4" />} label="关于应用" />
                </TabsList>
              </div>
            </div>
          </div>

          {/* 右侧内容区域 */}
          <div className="flex-1 min-w-0">
            {/* 外观与系统 */}
            <TabsContent value="appearance" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <SectionHeader title="外观与系统" description="定制你的视觉体验与底层性能表现" />

              <Card className="glass-card">
                <CardHeader><CardTitle className="text-base">视觉风格</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingToggle id="midnight_mode" label="深邃模式 (Midnight)" checked={draft.midnight_mode} busy={busy} onChange={(v) => toggleField("midnight_mode", v, "深邃模式")} />
                    <SettingToggle id="ui_transitions" label="过渡动画" checked={draft.ui_transitions} busy={busy} onChange={(v) => toggleField("ui_transitions", v, "UI过渡")} />
                    <SettingToggle id="ui_animations" label="界面动效" checked={draft.ui_animations} busy={busy} onChange={(v) => toggleField("ui_animations", v, "界面动效")} />
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">毛玻璃透明度</Label>
                        <p className="text-xs text-muted-foreground">调整侧边栏与卡片的背景透明感（实时生效）</p>
                      </div>
                      <Badge variant="outline" className="font-mono text-primary bg-primary/5 border-primary/20">
                        {ensureRange(Number(draft.acrylic_opacity ?? 80), 30, 100, 80)}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-6">
                      <Slider
                        min={30} max={100} step={1}
                        className="flex-1"
                        value={[ensureRange(Number(draft.acrylic_opacity ?? 80), 30, 100, 80)]}
                        onValueChange={async (v) => {
                          const nextDraft = { ...draft, acrylic_opacity: v[0] };
                          setDraft(nextDraft);
                          applyRuntimeStyles(nextDraft);
                        }}
                        onValueCommit={async (v) => {
                          // 滑动结束后保存到后端
                          await updateSettings({ acrylic_opacity: v[0] });
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader><CardTitle className="text-base">系统行为</CardTitle></CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <SettingToggle id="gpu_acceleration" label="GPU 硬件加速" checked={draft.gpu_acceleration} busy={busy} onChange={(v) => toggleField("gpu_acceleration", v, "GPU加速")} />
                  <SettingToggle id="auto_start" label="开机自启动" checked={draft.auto_start} busy={busy} onChange={(v) => toggleField("auto_start", v, "自启动")} />
                  <SettingToggle id="minimize_to_tray" label="最小化到托盘" checked={draft.minimize_to_tray} busy={busy} onChange={(v) => toggleField("minimize_to_tray", v, "托盘模式")} />
                  <SettingToggle id="start_minimized" label="启动时最小化" checked={draft.start_minimized} busy={busy} onChange={(v) => toggleField("start_minimized", v, "启动最小化")} />
                  <SettingToggle id="performance_overlay" label="显示性能统计" checked={draft.performance_overlay} busy={busy} onChange={(v) => toggleField("performance_overlay", v, "性能浮层")} />
                  <SettingToggle id="show_python_console" label="显示Python控制台" checked={draft.show_python_console} busy={busy} onChange={(v) => toggleField("show_python_console", v, "Python控制台")} />
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader><CardTitle className="text-base">背景图片</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>当前背景图片路径</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={draft.background_image ?? ""} 
                        readOnly 
                        placeholder="未选择背景图片"
                        className="flex-1 bg-muted/30"
                      />
                      {draft.background_image && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={async () => {
                            const nextDraft = { ...draft, background_image: "" };
                            setDraft(nextDraft);
                            applyRuntimeStyles(nextDraft);
                            await saveSection("背景图片", { background_image: "" });
                            toast.success("背景图片已清除");
                          }}
                        >
                          清除
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={async () => {
                        try {
                          const bridge = (window as any).pyBridge;
                          if (!bridge?.select_background_image) {
                            toast.error("文件选择功能不可用");
                            return;
                          }
                          const result = JSON.parse(await bridge.select_background_image());
                          if (result.success && result.path) {
                            const nextDraft = { ...draft, background_image: result.path };
                            setDraft(nextDraft);
                            applyRuntimeStyles(nextDraft);
                            
                            await saveSection("背景图片", { background_image: result.path });
                            toast.success("背景图片已应用");
                          } else if (result.message && result.message !== "未选择文件") {
                            toast.error(result.message);
                          }
                        } catch (e) {
                          toast.error(`选择背景图片失败: ${String(e)}`);
                        }
                      }}
                    >
                      选择背景图片 / Browse File
                    </Button>
                  </div>
                  {draft.background_image && (
                    <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      背景图片已实时应用
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 通知提醒 */}
            <TabsContent value="notifications" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <SectionHeader title="通知与提醒" description="配置任务开始前的系统通知与提示音" />

              <Card className="glass-card">
                <CardContent className="pt-6 space-y-6">
                  <SettingToggle id="enable_notifications" label="启用桌面系统通知" checked={draft.enable_notifications} busy={busy} onChange={(v) => toggleField("enable_notifications", v, "系统通知")} />

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> 提前提醒 (分钟)</Label>
                      <Input
                        type="number" min={1} max={120}
                        value={ensureRange(Number(draft.reminder_lead_minutes ?? 15), 1, 120, 15)}
                        onChange={(e) => setDraft(p => ({ ...p, reminder_lead_minutes: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2"><Volume2 className="h-3.5 w-3.5" /> 提示音效</Label>
                      <Select
                        value={String(draft.notification_sound ?? "bell")}
                        onValueChange={(v) => setDraft(p => ({ ...p, notification_sound: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bell">默认铃声 (Bell)</SelectItem>
                          <SelectItem value="digital">电子提示 (Digital)</SelectItem>
                          <SelectItem value="bird">鸟鸣提示 (Bird)</SelectItem>
                          <SelectItem value="rain">雨声提示 (Rain)</SelectItem>
                          <SelectItem value="none">静音</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between"><Label className="text-xs">提示音量</Label><span className="text-xs font-mono">{draft.notification_volume ?? 80}%</span></div>
                    <Slider
                      min={0} max={100} value={[draft.notification_volume ?? 80]}
                      onValueChange={(v) => setDraft(p => ({ ...p, notification_volume: v[0] }))}
                    />
                  </div>

                  <Button className="w-full gap-2" disabled={busy} onClick={() => saveSection("通知设置", {
                    reminder_lead_minutes: draft.reminder_lead_minutes,
                    notification_sound: draft.notification_sound,
                    notification_volume: draft.notification_volume
                  })}>
                    <Save className="h-4 w-4" /> 保存通知偏好
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 外部服务与 AI */}
            <TabsContent value="services" className="space-y-8 mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <SectionHeader title="外部服务与 AI 引擎" description="配置天气、诗词以及独立的智能 AI 接口" />

              {/* 1. 天气与诗词 */}
              <Card className="glass-card border-none ring-1 ring-border/50">
                <CardHeader className="pb-4"><CardTitle className="text-sm font-bold flex items-center gap-2"><CloudSun className="h-4 w-4 text-sky-500" /> 天气与文化</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingToggle id="weather_enabled" label="启用实时天气" checked={draft.weather_enabled} busy={busy} onChange={(v) => toggleField("weather_enabled", v, "天气服务")} />
                    <SettingToggle id="shici_enabled" label="启用每日诗词" checked={draft.shici_enabled} busy={busy} onChange={(v) => toggleField("shici_enabled", v, "诗词服务")} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <FieldGroup label="Weather API Key" type="password" value={draft.weather_api_key} onChange={(v) => setDraft(p => ({ ...p, weather_api_key: v }))} placeholder="和风天气 Key" />
                    <FieldGroup label="城市/坐标" value={draft.weather_location} onChange={(v) => setDraft(p => ({ ...p, weather_location: v }))} placeholder="北京" />
                    <FieldGroup label="API Host" value={draft.weather_host_url} onChange={(v) => setDraft(p => ({ ...p, weather_host_url: v }))} placeholder="devapi.qweather.com" />
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => saveSection("天气服务", {
                    weather_api_key: draft.weather_api_key,
                    weather_location: draft.weather_location,
                    weather_host_url: draft.weather_host_url
                  })}>同步服务凭据</Button>
                </CardContent>
              </Card>

              {/* 2. AI 任务解析引擎 (独立配置) */}
              <Card className="glass-card border-none ring-1 ring-border/50 overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500 w-full" />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-blue-500" /> AI 任务解析 (导入)</CardTitle>
                    <Switch checked={Boolean(draft.ai_task_parsing_enabled)} onCheckedChange={(v) => toggleField("ai_task_parsing_enabled", v, "任务解析")} />
                  </div>
                  <CardDescription>用于从自然语言描述中提取日程、作业和考试信息</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldGroup label="接口地址 (Base URL)" value={draft.ai_task_base_url} onChange={(v) => setDraft(p => ({ ...p, ai_task_base_url: v }))} placeholder="https://api.openai.com/v1" />
                    <FieldGroup label="API Key" type="password" value={draft.ai_task_api_key} onChange={(v) => setDraft(p => ({ ...p, ai_task_api_key: v }))} />
                    <FieldGroup label="模型名称 (Model)" value={draft.ai_task_model} onChange={(v) => setDraft(p => ({ ...p, ai_task_model: v }))} placeholder="gpt-3.5-turbo" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">系统提示词 (System Prompt)</Label>
                    <Textarea
                      value={draft.ai_task_prompt || DEFAULT_TASK_PROMPT}
                      onChange={(e) => setDraft(p => ({ ...p, ai_task_prompt: e.target.value }))}
                      className="text-xs font-mono h-24 bg-muted/30"
                    />
                  </div>
                  <Button size="sm" className="w-full md:w-auto" onClick={() => saveSection("任务解析配置", {
                    ai_task_base_url: draft.ai_task_base_url,
                    ai_task_api_key: draft.ai_task_api_key,
                    ai_task_model: draft.ai_task_model,
                    ai_task_prompt: draft.ai_task_prompt || DEFAULT_TASK_PROMPT
                  })}>保存解析引擎</Button>
                </CardContent>
              </Card>

              {/* 3. AI 学习建议引擎 (独立配置) */}
              <Card className="glass-card border-none ring-1 ring-border/50 overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-500 w-full" />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-500" /> AI 学习助手 (建议)</CardTitle>
                    <Switch checked={Boolean(draft.ai_learning_enabled)} onCheckedChange={(v) => toggleField("ai_learning_enabled", v, "学习建议")} />
                  </div>
                  <CardDescription>根据你的任务进度提供学习策略、复习计划和鼓励</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldGroup label="接口地址 (Base URL)" value={draft.ai_learning_base_url} onChange={(v) => setDraft(p => ({ ...p, ai_learning_base_url: v }))} placeholder="https://api.openai.com/v1" />
                    <FieldGroup label="API Key" type="password" value={draft.ai_learning_api_key} onChange={(v) => setDraft(p => ({ ...p, ai_learning_api_key: v }))} />
                    <FieldGroup label="模型名称 (Model)" value={draft.ai_learning_model} onChange={(v) => setDraft(p => ({ ...p, ai_learning_model: v }))} placeholder="gpt-4o" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">系统提示词 (System Prompt)</Label>
                    <Textarea
                      value={draft.ai_learning_prompt || DEFAULT_LEARNING_PROMPT}
                      onChange={(e) => setDraft(p => ({ ...p, ai_learning_prompt: e.target.value }))}
                      placeholder="例如：你是一个贴心的学习管家..."
                      className="text-xs font-mono h-24 bg-muted/30"
                    />
                  </div>
                  <Button size="sm" variant="secondary" className="w-full md:w-auto" onClick={() => saveSection("学习建议配置", {
                    ai_learning_base_url: draft.ai_learning_base_url,
                    ai_learning_api_key: draft.ai_learning_api_key,
                    ai_learning_model: draft.ai_learning_model,
                    ai_learning_prompt: draft.ai_learning_prompt || DEFAULT_LEARNING_PROMPT
                  })}>保存学习引擎</Button>
                </CardContent>
              </Card>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0" />
                <p>注意：所有 AI 接口均需符合 OpenAI API 格式规范。如果你使用的是本地模型（如 Ollama），请确保 Base URL 指向正确的本地端口并在后端放行 CORS。</p>
              </div>
            </TabsContent>

            {/* 数据管理 */}
            <TabsContent value="data" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <SectionHeader title="数据安全与高级设置" description="备份、导出与开发者调试工具" />
              <Card className="glass-card border-l-4 border-l-primary/40">
                <CardHeader><CardTitle className="text-base">自动备份</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SettingToggle id="auto_save" label="实时自动保存" checked={draft.auto_save} busy={busy} onChange={(v) => toggleField("auto_save", v, "自动保存")} />
                    <SettingToggle id="enable_auto_backup" label="自动本地备份" checked={draft.enable_auto_backup} busy={busy} onChange={(v) => toggleField("enable_auto_backup", v, "自动备份")} />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>备份频率</Label>
                      <Select value={String(draft.backup_freq ?? "daily")} onValueChange={(v) => setDraft(p => ({ ...p, backup_freq: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">每日备份</SelectItem>
                          <SelectItem value="weekly">每周备份</SelectItem>
                          <SelectItem value="manual">仅手动执行</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>保留周期 (天)</Label>
                      <Input type="number" value={draft.backup_retention_days ?? 30} onChange={(e) => setDraft(p => ({ ...p, backup_retention_days: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => saveSection("备份配置", {
                    backup_freq: draft.backup_freq,
                    backup_retention_days: draft.backup_retention_days
                  })}>保存备份偏好</Button>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader><CardTitle className="text-base">实验室与数据维护</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" className="gap-2" onClick={exportAll} disabled={busy}>
                      <RefreshCw className="h-4 w-4" /> 导出所有数据
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={clearRuntimeCache} disabled={busy}>
                      清理运行时缓存
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={busy}>重置应用数据</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确定要彻底重置应用吗？</AlertDialogTitle>
                          <AlertDialogDescription>这将永久删除所有课程、任务、记录和设置。此操作不可撤销。</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={resetAll}>确认重置</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground"><Terminal className="h-4 w-4" /> <span className="text-sm font-semibold">开发者调试</span></div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* 前端调试按钮卡片 */}
                      <div 
                        onClick={async () => {
                          try {
                            const bridge = (window as any).pyBridge;
                            if (bridge?.open_frontend_devtools) {
                              const result = JSON.parse(await bridge.open_frontend_devtools());
                              if (result.status === 'success') {
                                toast.success("前端控制台已打开");
                              } else {
                                toast.error(result.message || "打开前端控制台失败");
                              }
                            } else {
                              toast.info("当前环境下请按 F12 打开控制台");
                            }
                          } catch (e) {
                            toast.error(`打开前端控制台失败: ${String(e)}`);
                          }
                        }}
                        className="flex items-center justify-between rounded-xl border border-muted/60 p-4 bg-background/20 hover:bg-accent/10 transition-all cursor-pointer group"
                      >
                        <div className="space-y-0.5">
                          <Label className="cursor-pointer font-semibold text-foreground/80 group-hover:text-foreground transition-colors flex items-center gap-2">
                            <Layout className="h-4 w-4 text-blue-500" />
                            前端 DevTools
                          </Label>
                          <p className="text-xs text-muted-foreground">点击打开前端开发者工具</p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                      </div>

                      {/* 后端调试按钮卡片 */}
                      <div 
                        onClick={async () => {
                          try {
                            const bridge = (window as any).pyBridge;
                            if (bridge?.open_python_console) {
                              const result = JSON.parse(await bridge.open_python_console());
                              if (result.status === 'success') {
                                toast.success("后端控制台已打开");
                              } else {
                                toast.error(result.message || "打开后端控制台失败");
                              }
                            } else {
                              toast.error("后端控制台接口不可用");
                            }
                          } catch (e) {
                            toast.error(`打开后端控制台失败: ${String(e)}`);
                          }
                        }}
                        className="flex items-center justify-between rounded-xl border border-muted/60 p-4 bg-background/20 hover:bg-accent/10 transition-all cursor-pointer group"
                      >
                        <div className="space-y-0.5">
                          <Label className="cursor-pointer font-semibold text-foreground/80 group-hover:text-foreground transition-colors flex items-center gap-2">
                            <Bug className="h-4 w-4 text-orange-500" />
                            后端 Python 控制台
                          </Label>
                          <p className="text-xs text-muted-foreground">点击打开后端调试终端</p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-orange-500 transition-colors" />
                      </div>
                    </div>
                    
                    <div className="max-w-xs space-y-2">
                      <Label className="text-xs">日志过滤级别</Label>
                      <Select value={String(draft.log_level ?? "warn")} onValueChange={(v) => setDraft(p => ({ ...p, log_level: v }))}>
                        <SelectTrigger className="h-8 text-xs font-mono"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="debug">DEBUG (Verbose)</SelectItem>
                          <SelectItem value="info">INFO</SelectItem>
                          <SelectItem value="warn">WARN</SelectItem>
                          <SelectItem value="error">ERROR (Critical)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => saveSection("日志设置", { log_level: draft.log_level })}>设置级别</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 关于应用 */}
            <TabsContent value="about" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <SectionHeader title="关于应用" description="Spark Schedule正在为你的效率赋能" />

              <Card className="overflow-hidden border-none shadow-2xl bg-gradient-to-br from-primary/20 via-background to-background ring-1 ring-primary/10">
                <CardContent className="p-10 relative">
                  {/* 背景装饰 */}
                  <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                    <Sparkles className="h-40 w-40" />
                  </div>

                  <div className="flex flex-col md:flex-row items-center gap-10">
                    <div className="h-28 w-28 rounded-[2.5rem] bg-primary flex items-center justify-center shadow-2xl shadow-primary/30 rotate-6 hover:rotate-0 transition-transform duration-500 group">
                      <Sparkles className="h-14 w-14 text-primary-foreground group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="space-y-3 text-center md:text-left">
                      <div className="flex flex-col md:flex-row items-center md:items-baseline gap-3">
                        <h2 className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                          Spark Schedule
                        </h2>
                        <Badge variant="secondary" className="px-2 py-0.5 text-xs font-mono">{APP_VERSION}</Badge>
                      </div>
                      <p className="text-muted-foreground max-w-lg leading-relaxed">
                        专为学生与开发者打造的下一代智能课程表。结合 AI 任务解析、番茄钟专注与全方位的个性化定制，助你掌控每一分钟。
                      </p>
                    </div>
                  </div>

                  <Separator className="my-10 opacity-50" />

                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <AboutItem icon={<Github className="h-4 w-4" />} title="开源代码库" description="在 GitHub 上关注我们的进展" link="https://github.com/Ricraft/Spark_Schedule" />
                    <AboutItem icon={<ShieldCheck className="h-4 w-4" />} title="服务与隐私" description="了解我们如何保护你的数据" />
                    <UpdateCheckerDialog currentVersion={APP_VERSION} />
                  </div>
                </CardContent>
                <div className="bg-muted/30 px-10 py-5 flex flex-col sm:flex-row justify-between items-center text-[10px] text-muted-foreground uppercase tracking-widest gap-4">
                  <span>© 2024 Spark Schedule Project Team.</span>
                  <div className="flex gap-6">
                    <span className="hover:text-primary cursor-pointer transition-colors">User Agreement</span>
                    <span className="hover:text-primary cursor-pointer transition-colors">Join Community</span>
                  </div>
                </div>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    素材来源与致谢
                  </CardTitle>
                  <CardDescription>点击名称会先弹出确认，再跳转到外部网页。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-relaxed">
                  <p>本项目目前使用了 AI 辅助开发。</p>
                  <p>
                    和风天气 API 服务：
                    <button
                      type="button"
                      className="ml-1 font-semibold text-primary hover:underline underline-offset-4"
                      onClick={() => { void confirmAndOpenExternalLink("和风天气 API 服务（qwd）", "https://github.com/qwd"); }}
                    >
                      qwd（GitHub）
                    </button>
                  </p>
                  <p>
                    今日古诗 API 服务：
                    <button
                      type="button"
                      className="ml-1 font-semibold text-primary hover:underline underline-offset-4"
                      onClick={() => { void confirmAndOpenExternalLink("今日古诗 API 文档", "https://www.jinrishici.com/doc/"); }}
                    >
                      今日诗词文档
                    </button>
                  </p>
                  <p>
                    启动加载页来源于 B 站 UP 主七饼饼子：
                    <button
                      type="button"
                      className="ml-1 font-semibold text-primary hover:underline underline-offset-4"
                      onClick={() => { void confirmAndOpenExternalLink("B 站视频 BV1mb4y1B7io", "https://www.bilibili.com/video/BV1mb4y1B7io/?spm_id_from=333.337.search-card.all.click&vd_source=6c21c6bd3eafe871c68761ee3ea93f86"); }}
                    >
                      BV1mb4y1B7io
                    </button>
                  </p>
                  <p>其他素材均来源于互联网，如有侵权请联系我们后立即删除。</p>
                  <p>感谢 GitHub 开源社区的开发者们。</p>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><Terminal className="h-4 w-4" /> 环境足迹</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-xs py-2 border-b border-muted/50">
                    <span className="text-muted-foreground">运行时内核</span>
                    <span className="font-mono bg-muted px-1.5 rounded">React 18 / PyBridge 2.4</span>
                  </div>
                  <div className="flex justify-between text-xs py-2 border-b border-muted/50">
                    <span className="text-muted-foreground">渲染接口</span>
                    <span className="font-mono text-green-500">WebGL 2.0 Enabled</span>
                  </div>
                  <div className="flex justify-between text-xs py-2">
                    <span className="text-muted-foreground">存储索引</span>
                    <Badge variant="outline" className="text-[9px] py-0 border-primary/20 bg-primary/5">USER_DIR/AppData/Local/SparkSchedule</Badge>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <style>{`
        .glass-card {
          @apply bg-card/40 backdrop-blur-xl border-border/50 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl !important;
        }
        .sidebar-trigger {
          @apply w-full justify-start px-4 py-3 text-sm transition-all duration-200 border-l-[3px] border-transparent hover:bg-muted/50 data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-bold !important;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </AppLayout>
  );
};

// 辅助组件：侧边栏项目
const SidebarItem = ({ value, icon, label }: { value: string, icon: React.ReactNode, label: string }) => (
  <TabsTrigger value={value} className="sidebar-trigger group relative gap-4 !justify-start">
    <div className="p-2.5 rounded-xl transition-all duration-300 bg-muted/50 group-data-[state=active]:bg-primary group-data-[state=active]:text-primary-foreground group-data-[state=active]:shadow-lg group-data-[state=active]:shadow-primary/20">
      {icon}
    </div>
    <div className="flex flex-col items-start">
      <span className="text-sm font-bold transition-colors group-data-[state=active]:text-foreground text-muted-foreground">{label}</span>
    </div>
    <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-full opacity-0 group-data-[state=active]:opacity-100 transition-opacity" />
  </TabsTrigger>
);

// 辅助组件：设置项开关容器
const SettingToggle = ({ id, label, checked, busy, onChange }: { id: string, label: string, checked: any, busy?: boolean, onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between rounded-2xl border border-border/40 p-5 bg-card/30 hover:bg-card/50 transition-all duration-300 group">
    <div className="space-y-1">
      <Label htmlFor={id} className="cursor-pointer font-bold text-foreground/90 group-hover:text-foreground transition-colors">{label}</Label>
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider opacity-60">点击切换状态</p>
    </div>
    <Switch
      id={id}
      checked={Boolean(checked)}
      disabled={busy}
      onCheckedChange={onChange}
      className="data-[state=checked]:bg-primary"
    />
  </div>
);

// 辅助组件：章节页眉
const SectionHeader = ({ title, description }: { title: string, description: string }) => (
  <div className="mb-10 space-y-2 animate-in slide-in-from-left-4 duration-700">
    <h2 className="text-4xl font-black tracking-tighter text-foreground">{title}</h2>
    <div className="flex items-center gap-3">
      <div className="w-10 h-1.5 bg-primary rounded-full shadow-sm shadow-primary/20" />
      <p className="text-muted-foreground text-sm font-semibold tracking-wide">{description}</p>
    </div>
  </div>
);

const confirmAndOpenExternalLink = async (label: string, url: string) => {
  const confirmed = window.confirm(`即将打开外部网页：${label}\n${url}\n是否继续？`);
  if (!confirmed) return;

  const bridge = (window as any).pyBridge;
  if (bridge?.open_external_url) {
    try {
      const raw = await bridge.open_external_url(url);
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed?.status === "success") return;
      throw new Error(parsed?.message || "打开链接失败");
    } catch (error) {
      toast.error(`打开外部浏览器失败：${error instanceof Error ? error.message : String(error)}`);
      return;
    }
  }

  try {
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) {
      window.location.href = url;
    }
  } catch {
    window.location.href = url;
  }
};

// 辅助组件：关于页面的项
const AboutItem = ({ icon, title, description, link, onClick }: any) => (
  <div
    className={`flex items-start gap-4 p-6 rounded-3xl border border-primary/5 bg-card/40 hover:bg-primary/5 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 group ${onClick ? "cursor-pointer" : "cursor-default"}`}
    onClick={onClick || undefined}
  >
    <div className="p-3.5 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 group-hover:bg-primary group-data-[state=active]:shadow-lg group-hover:text-primary-foreground transition-all duration-500">
      {icon}
    </div>
    <div className="space-y-1.5">
      {link ? (
        <button
          type="button"
          className="text-sm font-black flex items-center gap-2 group-hover:text-primary transition-colors underline-offset-4 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            void confirmAndOpenExternalLink(title, link);
          }}
        >
          {title}
          <ExternalLink className="h-3 w-3 opacity-40 group-hover:opacity-100" />
        </button>
      ) : (
        <div className="text-sm font-black flex items-center gap-2 group-hover:text-primary transition-colors">
          {title}
        </div>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground font-medium">{description}</p>
    </div>
  </div>
);

// 辅助组件：检查更新对话框
const UpdateCheckerDialog = ({ currentVersion }: { currentVersion: string }) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'ready' | 'error'>('idle');
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [changelog, setChangelog] = useState<string[]>([]);
  const downloadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (downloadTimerRef.current) {
        clearInterval(downloadTimerRef.current);
        downloadTimerRef.current = null;
      }
    };
  }, []);

  const resetDialogState = () => {
    if (downloadTimerRef.current) {
      clearInterval(downloadTimerRef.current);
      downloadTimerRef.current = null;
    }
    setProgress(0);
    setNewVersion(null);
    setChangelog([]);
    setStatus('idle');
  };

  const closeDialog = () => {
    setOpen(false);
    resetDialogState();
  };

  const checkUpdates = async () => {
    setStatus('checking');
    setProgress(0);
    try {
      const bridge = (window as any).pyBridge;
      if (bridge?.check_updates) {
        const result = JSON.parse(await bridge.check_updates());
        if (result?.status === 'error') {
          throw new Error(result?.message || '检查更新失败');
        }
        if (result.available) {
          setNewVersion(result.version);
          setChangelog(result.changelog || ["Bug fixes", "Performance improvements"]);
          setStatus('available');
        } else {
          setStatus('up-to-date');
        }
      } else {
        // 演示环境模拟
        setTimeout(() => {
          setStatus('available');
          setNewVersion("v1.2.6");
          setChangelog(["新增了桌面小组件支持", "优化了 AI 任务解析的准确率", "修复了日历视图下的显示错位问题", "增强了深色模式下的对比度"]);
        }, 1500);
      }
    } catch (e) {
      setStatus('error');
      toast.error("检查更新失败，请稍后再试");
    }
  };

  const startDownload = async () => {
    setStatus('downloading');
    setProgress(0);
    if (downloadTimerRef.current) {
      clearInterval(downloadTimerRef.current);
      downloadTimerRef.current = null;
    }
    // 模拟下载进度
    let cur = 0;
    downloadTimerRef.current = setInterval(() => {
      cur += Math.random() * 12;
      if (cur >= 100) {
        cur = 100;
        if (downloadTimerRef.current) {
          clearInterval(downloadTimerRef.current);
          downloadTimerRef.current = null;
        }
        setStatus('ready');
      }
      setProgress(cur);
    }, 300);
  };

  const restartAndApply = async () => {
    try {
      const bridge = (window as any).pyBridge;
      if (bridge?.restart_app) {
        const raw = await bridge.restart_app();
        try {
          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (parsed?.status === "error") {
            throw new Error(parsed?.message || "重启失败");
          }
        } catch {
          // If app exits quickly, response parsing may be interrupted; ignore.
        }
      } else {
        toast.success("更新已准备就绪，请手动重启应用");
      }
    } catch (e) {
      toast.error("重启应用失败");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetDialogState();
      }}
    >
      <DialogTrigger asChild>
        <AboutItem 
          icon={<RefreshCw className={`h-4 w-4 ${status === 'checking' ? 'animate-spin' : ''}`} />} 
          title="检查更新" 
          description={status === 'available' ? "发现新版本可用！" : "检查 Spark Schedule 的最新版本"} 
          onClick={status === 'idle' ? checkUpdates : undefined}
        />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md glass-card border-none ring-1 ring-white/10 shadow-2xl overflow-hidden p-0">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              {status === 'checking' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
              {status === 'available' && <ArrowUpCircle className="h-5 w-5 text-blue-500" />}
              {status === 'up-to-date' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              {status === 'downloading' && <Download className="h-5 w-5 text-primary animate-bounce" />}
              {status === 'ready' && <Sparkles className="h-5 w-5 text-purple-500" />}
              {status === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
              软件更新
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium">
              {status === 'checking' && "正在连接服务器并检查最新版本..."}
              {status === 'available' && `发现新版本: ${newVersion}`}
              {status === 'up-to-date' && "当前已是最新稳定版本"}
              {status === 'downloading' && "正在下载更新包，请不要关闭应用"}
              {status === 'ready' && "更新已准备就绪！"}
              {status === 'error' && "无法连接到更新服务器"}
            </DialogDescription>
          </DialogHeader>

          <div className="py-8">
            {status === 'checking' && (
              <div className="flex flex-col items-center justify-center space-y-4 py-4">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full border-4 border-primary/10 border-t-primary animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground animate-pulse font-medium">正在获取版本信息...</p>
              </div>
            )}

            {status === 'available' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest">更新亮点</span>
                    <Badge className="bg-primary text-primary-foreground font-mono text-[10px]">{newVersion}</Badge>
                  </div>
                  <ul className="text-sm space-y-2 text-foreground/80 font-medium">
                    {changelog.map((line, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/40 shrink-0" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {status === 'up-to-date' && (
              <div className="flex flex-col items-center justify-center space-y-4 py-4 animate-in zoom-in-95 duration-300">
                <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg">当前已是最新版本</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">Spark Schedule {currentVersion}</p>
                </div>
              </div>
            )}

            {status === 'downloading' && (
              <div className="space-y-6 py-4 animate-in fade-in duration-300">
                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      正在下载更新...
                    </span>
                    <span className="font-mono text-primary">{Math.round(progress)}%</span>
                  </div>
                  <div className="relative h-3 w-full bg-primary/10 rounded-full overflow-hidden">
                    <div 
                      className="absolute top-0 left-0 h-full bg-primary transition-all duration-300 ease-out shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-center text-muted-foreground/60 italic font-medium">
                  正在部署最新特性，请耐心等待...
                </p>
              </div>
            )}

            {status === 'ready' && (
              <div className="flex flex-col items-center justify-center space-y-4 py-4 animate-in bounce-in duration-500">
                <div className="h-20 w-20 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-purple-500 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg text-foreground">更新准备就绪</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">重启应用即可升级到 {newVersion}</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center justify-center space-y-4 py-4">
                <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-10 w-10 text-destructive" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-lg text-foreground">检查更新失败</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">请检查你的网络连接或稍后重试</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-start">
            {status === 'available' && (
              <Button className="w-full h-11 rounded-xl font-bold gap-2 shadow-lg shadow-primary/20" onClick={startDownload}>
                <Download className="h-4 w-4" /> 立即下载并安装
              </Button>
            )}
            {status === 'ready' && (
              <Button className="w-full h-11 rounded-xl font-bold gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/20" onClick={restartAndApply}>
                <RefreshCw className="h-4 w-4" /> 重启并应用更新
              </Button>
            )}
            {(status === 'up-to-date' || status === 'error') && (
              <Button variant="secondary" className="w-full h-11 rounded-xl font-bold" onClick={closeDialog}>
                我知道了
              </Button>
            )}
            {status === 'checking' && (
              <Button disabled variant="outline" className="w-full h-11 rounded-xl font-bold">
                请稍候...
              </Button>
            )}
          </DialogFooter>
        </div>
        
        {/* 底部装饰栏 */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
      </DialogContent>
    </Dialog>
  );
};

// 辅助组件：输入框组。未修改的脱敏值会回传占位符；主动清除则发送空值。
interface FieldGroupProps {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}

const FieldGroup = ({ label, value, onChange, placeholder, type = "text" }: FieldGroupProps) => {
  const isSavedSecret = type === "password" && isRedactedSecret(value);
  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.1em] ml-1">{label}</Label>
      <Input
        type={type}
        value={isSavedSecret ? "" : value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isSavedSecret ? "已配置密钥（隐藏）；留空保持不变，输入新密钥可替换" : placeholder}
        autoComplete={type === "password" ? "new-password" : undefined}
        className="bg-background/40 h-10 rounded-xl border-border/40 focus:border-primary/50 transition-all font-medium"
      />
      {isSavedSecret && (
        <button type="button" className="text-xs text-destructive hover:underline focus-visible:underline"
          aria-label={`清除 ${label}`} onClick={() => onChange("")}>
          清除已保存密钥
        </button>
      )}
    </div>
  );
};

export default Settings;

