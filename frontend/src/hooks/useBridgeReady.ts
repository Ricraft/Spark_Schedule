import { useState, useEffect, useRef } from 'react';
import { preloadWeather, preloadShici } from '@/utils/preloader';

export const useBridgeReady = () => {
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const bridgeRef = useRef<any>(null);
  const progressRef = useRef(0);
  const listenersBound = useRef(false);

  useEffect(() => {
    console.log('🚀 [BridgeReady] 开始加载...');
    
    let checkCount = 0;
    const maxChecks = 40; // 增加到 40 次，约 12 秒
    let progressInterval: number | null = null;
    let backupTimeout: number | null = null;
    let preloadStarted = false;

    // 🔥 彻底兜底：如果 10 秒后还没 Ready，强制进入
    backupTimeout = window.setTimeout(() => {
      if (!preloadStarted) {
        console.warn('🚨 [BridgeReady] 10秒深度兜底触发，强制跳过加载页');
        updateProgress(100);
        setTimeout(() => setIsReady(true), 500);
      }
    }, 10000);

    // 🔥 使用函数式更新，确保进度只增不减
    const updateProgress = (value: number) => {
      setProgress(prev => {
        const newValue = Math.max(prev, Math.min(value, 100)); // 允许到 100%
        progressRef.current = newValue;
        return newValue;
      });
    };

    // 🔥 监听 loadingProgress 信号（通用加载进度）
    const handleLoadingProgress = (progressValue: number, message: string) => {
      updateProgress(progressValue);
      
      // 当后端到达 100% 时，触发前端的预加载逻辑
      if (progressValue === 100 && !preloadStarted) {
        startFrontendPreload();
      }
    };

    // 🔥 监听 asyncOperationProgress 信号（异步操作进度）
    const handleAsyncOperationProgress = (operationId: string, percent: number) => {
      updateProgress(percent);
    };

    // 🔥 绑定所有信号
    const setupBridgeListeners = () => {
      const bridge = (window as any).pyBridge;
      if (bridge && !listenersBound.current) {
        try {
          // 断开旧连接
          if (bridge.loadingProgress) {
            try { bridge.loadingProgress.disconnect(handleLoadingProgress); } catch (e) {}
          }
          
          // 绑定新连接
          bridge.loadingProgress.connect(handleLoadingProgress);
          bridge.asyncOperationProgress.connect(handleAsyncOperationProgress);
          bridgeRef.current = bridge;
          listenersBound.current = true;
          console.log('✅ [BridgeReady] 已绑定所有进度信号');
          
          // 🚀 核心：通知后端开始真正的异步初始化
          if (bridge.perform_initialization) {
            console.log('⚙️ [BridgeReady] 请求后端执行初始化...');
            bridge.perform_initialization();
          }
          
          return true;
        } catch (e) {
          console.warn('⚠️ [BridgeReady] 绑定信号失败:', e);
          return false;
        }
      }
      return false;
    };

    // 模拟进度（仅在刚启动且未收到真实进度时使用）
    const startProgressSimulation = () => {
      let currentProgress = 0;
      progressInterval = window.setInterval(() => {
        // 如果进度已经通过信号增加到了 20% 以上，停止模拟，完全交给信号
        if (progressRef.current > 20) {
          console.log('📡 [BridgeReady] 已连接信号，停止模拟');
          if (progressInterval) clearInterval(progressInterval);
          return;
        }
        
        if (currentProgress < 30) {
          currentProgress += 1;
          updateProgress(currentProgress);
        }
      }, 200);
    };

    // 开始前端预加载（天气、诗词等）
    const startFrontendPreload = () => {
      if (preloadStarted) return;
      preloadStarted = true;
      
      console.log('🔄 [BridgeReady] 后端已就绪，开始前端数据预缓存...');
      
      if (progressInterval) clearInterval(progressInterval);
      updateProgress(95); // 设置到 95%
      
      // 执行天气和诗词的预拉取
      Promise.all([
        preloadWeather(),
        preloadShici()
      ]).then(() => {
        console.log('✅ [BridgeReady] 预加载完成');
        updateProgress(100); // 完成后设置到 100%
        window.dispatchEvent(new CustomEvent('dataPreloadComplete'));
        // 稍微延迟让 100% 进度显示一会儿
        setTimeout(() => setIsReady(true), 400);
      }).catch(error => {
        console.error('❌ [BridgeReady] 预加载失败:', error);
        updateProgress(100); // 即使失败也设置到 100%
        setTimeout(() => setIsReady(true), 400);
      });
    };

    const checkBridge = async () => {
      const bridge = (window as any).pyBridge;
      checkCount++;

      if (bridge) {
        console.log('✅ [BridgeReady] Bridge 实例已检测到');
        setupBridgeListeners();
        return true;
      }

      if (checkCount >= maxChecks) {
        console.warn('⚠️ [BridgeReady] Bridge 加载超时，强制进入系统');
        if (progressInterval) clearInterval(progressInterval);
        updateProgress(100);
        setTimeout(() => setIsReady(true), 300);
        return true;
      }

      return false;
    };

    // 先启动模拟
    startProgressSimulation();

    // 立即检查
    checkBridge().then(done => {
      if (done) return;

      const interval = setInterval(async () => {
        const done = await checkBridge();
        if (done) clearInterval(interval);
      }, 300);

      const handleReady = () => {
        console.log('🎉 [BridgeReady] 收到 pyBridgeReady 事件');
        setupBridgeListeners();
        clearInterval(interval);
      };

      window.addEventListener('pyBridgeReady', handleReady);

      return () => {
        clearInterval(interval);
        if (progressInterval) clearInterval(progressInterval);
        if (backupTimeout) clearTimeout(backupTimeout);
        window.removeEventListener('pyBridgeReady', handleReady);
        
        const bridge = (window as any).pyBridge;
        if (bridge && listenersBound.current) {
          try { bridge.loadingProgress.disconnect(handleLoadingProgress); } catch (e) {}
          try { bridge.asyncOperationProgress.disconnect(handleAsyncOperationProgress); } catch (e) {}
        }
      };
    });

    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, []);

  return { isReady, progress };
};
