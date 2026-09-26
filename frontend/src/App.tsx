import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard";

// Load secondary routes on demand; the startup bundle need not parse every page.
const Schedule = lazy(() => import("./pages/Schedule"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Stats = lazy(() => import("./pages/Stats"));
const Focus = lazy(() => import("./pages/Focus"));
const Settings = lazy(() => import("./pages/Settings"));
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { PythonProvider } from "./contexts/PythonContext";
import { FocusProvider } from "./contexts/FocusContext";
import { LoadingScreen } from "./components/LoadingScreen";
import { useBridgeReady } from "./hooks/useBridgeReady";
import { performanceOptimizer } from "./utils/performanceOptimizer";
import { useDesktopNotifications } from "./hooks/useDesktopNotifications";
import { useRealtimeSettings } from "./hooks/useRealtimeSettings";

const queryClient = new QueryClient();

// Each route mounts once; there is no synthetic exit transition to keep alive.
const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="p-6 text-muted-foreground" role="status">正在加载页面…</div>}>
    <div className="page-transition page-visible">{children}</div>
  </Suspense>
);

// Main App with Loading Screen
const AppContent = () => {
  const { isReady, progress } = useBridgeReady();
  const [showLoading, setShowLoading] = useState(true);
  useDesktopNotifications(isReady);
  
  // 🎨 实时应用设置（深色模式、透明度、背景图等）
  const runtimeSettings = useRealtimeSettings();

  // 🚀 初始化性能优化器
  useEffect(() => {
    performanceOptimizer.getStatus();
    console.log('✅ [App] 性能优化器已初始化');
  }, []);

  // 注意：深色模式和背景图片现在由 useRealtimeSettings 统一处理
  // 不再需要单独的 useEffect

  useEffect(() => {
    if (isReady) {
      // 添加淡出动画，然后隐藏加载屏幕
      const timer = setTimeout(() => {
        setShowLoading(false);
      }, 500); // 500ms 淡出动画
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  return (
    <>
      {/* 加载屏幕 - 使用 opacity 淡出 */}
      {showLoading && (
        <div 
          style={{ 
            opacity: isReady ? 0 : 1,
            transition: 'opacity 0.5s ease-out',
            pointerEvents: isReady ? 'none' : 'auto'
          }}
        >
          <LoadingScreen progress={progress} disableMotion={runtimeSettings?.ui_animations === false} />
        </div>
      )}
      
      {/* 主应用 - 提前渲染，使用 opacity 淡入 */}
      <div
        style={{
          opacity: isReady ? 1 : 0,
          transition: 'opacity 0.5s ease-in',
          pointerEvents: isReady ? 'auto' : 'none'
        }}
      >
        <HashRouter>
          <Routes>
            <Route path="/" element={<PageWrapper><Dashboard /></PageWrapper>} />
            <Route path="/schedule" element={<PageWrapper><Schedule /></PageWrapper>} />
            <Route path="/tasks" element={<PageWrapper><Tasks /></PageWrapper>} />
            <Route path="/stats" element={<PageWrapper><Stats /></PageWrapper>} />
            <Route path="/focus" element={<PageWrapper><Focus /></PageWrapper>} />
            <Route path="/settings" element={<PageWrapper><Settings /></PageWrapper>} />
          </Routes>
        </HashRouter>
      </div>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <PythonProvider>
        <FocusProvider>
          <AppContent />
          <Toaster />
        </FocusProvider>
      </PythonProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
