import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Calendar, 
  ListTodo, 
  BarChart, 
  Clock, 
  Settings, 
  BookOpen,
  Bell
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { debugMonitor } from "../utils/debugMonitor";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

const AppLayout = ({ children, title }: AppLayoutProps) => {
  const location = useLocation();

  // 跟踪导航路径，简化版本，移除复杂的冲突检测
  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = sessionStorage.getItem('currentPath');
    
    // 记录导航事件到调试监控
    debugMonitor.logNavigation(previousPath || 'startup', currentPath);
    
    console.log(`🧭 导航: ${previousPath || '启动'} → ${currentPath}`);
    
    // 更新当前路径
    sessionStorage.setItem('currentPath', currentPath);
    
    // 清理过期的会话数据
    if (currentPath === '/') {
      // 访问仪表盘时清理导航状态
      sessionStorage.removeItem('lastNavigation');
      sessionStorage.removeItem('lastInitTime');
    }
  }, [location.pathname]);

  const navItems = [
    { icon: LayoutDashboard, label: "仪表盘", path: "/" },
    { icon: Calendar, label: "主课表", path: "/schedule" },
    { icon: ListTodo, label: "任务集", path: "/tasks" },
    { icon: BarChart, label: "数据统计", path: "/stats" },
    { icon: Clock, label: "番茄钟", path: "/focus" },
  ];

  return (
    <div className="min-h-screen w-full flex justify-center p-4 md:p-6 lg:p-8 selection:bg-indigo-100 selection:text-indigo-900">
      {/* 1440px Fixed Width Container */}
      <div className="w-full max-w-[1440px] flex h-[calc(100vh-4rem)] gap-4 md:gap-6 lg:gap-8">
        
        {/* Sidebar - Floating Acrylic - 优化断点：从 lg 改为 xl，让边栏在 1280px 以下自动收缩 */}
        <aside className="w-20 xl:w-64 acrylic rounded-3xl flex flex-col p-4 shrink-0 transition-all duration-300">
          <div className="flex items-center gap-3 px-2 mb-8 mt-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 midnight:from-emerald-500 midnight:to-teal-600 flex items-center justify-center shrink-0 shadow-custom">
              <BookOpen className="text-white w-6 h-6" />
            </div>
            <span className="font-bold text-xl hidden xl:block bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 midnight:from-emerald-400 midnight:to-teal-500">
              Spark Schedule
            </span>
          </div>

          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200 group ${
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-custom midnight:bg-emerald-600" 
                      : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? "" : "group-hover:scale-110 transition-transform"}`} />
                  <span className="font-medium hidden xl:block">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-2">
             <Link
              to="/settings"
              className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200 group ${
                location.pathname === "/settings"
                  ? "bg-secondary text-secondary-foreground midnight:bg-emerald-900/40" 
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="font-medium hidden xl:block">设置</span>
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-16 md:h-20 flex items-center justify-between mb-2 px-2 md:px-4 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="min-w-0">
              <h1 className="text-xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2 md:gap-3 truncate">
                {title}
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-primary midnight:bg-emerald-500 animate-pulse-slow shrink-0" />
              </h1>
              <p className="hidden md:block text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mt-1">Academic Dashboard • Active Session</p>
            </div>
            
            <div className="flex items-center gap-2 md:gap-6">
              <div className="flex gap-1 md:gap-2">
                <Button variant="ghost" size="icon" className="relative h-9 w-9 md:h-11 md:w-11 rounded-xl md:rounded-2xl bg-card border border-border/60 shadow-sm transition-all duration-300 group">
                  <Bell className="w-4 h-4 md:w-5 md:h-5 text-foreground/70 group-hover:shake" />
                  <span className="absolute top-2.5 right-2.5 md:top-3 md:right-3 w-2 h-2 md:w-2.5 md:h-2.5 bg-red-500 rounded-full border-2 border-background"></span>
                </Button>
              </div>

              <div className="flex items-center gap-2 md:gap-3 bg-card/80 backdrop-blur-md px-2 md:px-4 py-1.5 md:py-2 rounded-xl md:rounded-2xl border border-border/50 shadow-lg shadow-black/5 hover:shadow-xl transition-all duration-300 group cursor-pointer">
                <div className="relative">
                  <Avatar className="w-7 h-7 md:w-9 md:h-9 border-2 border-background shadow-sm transition-transform group-hover:scale-110">
                    <AvatarFallback aria-label="Student avatar">ST</AvatarFallback>
                  </Avatar>
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className="text-xs md:text-sm font-bold text-foreground leading-none">Student</span>
                  <span className="text-[8px] md:text-[10px] font-bold text-primary midnight:text-emerald-400 mt-1 uppercase">Premium</span>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content - Scrollable Area */}
          <main className="theme-page-surface theme-page-shell flex-1 overflow-y-auto overflow-x-hidden rounded-[2rem] md:rounded-[3rem] mica shadow-2xl shadow-black/10 p-4 md:p-6 lg:p-8 xl:p-10 animate-in fade-in zoom-in-95 duration-700 delay-150">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;