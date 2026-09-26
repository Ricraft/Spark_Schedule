import { useEffect, useRef, useState } from 'react';

interface LoadingScreenProps {
  progress: number;
  disableMotion?: boolean;
}

// 加载步骤定义
const loadingSteps = [
  { progress: 5, status: '正在初始化系统...', log: '正在准备本地服务' },
  { progress: 10, status: '正在初始化系统...', log: '正在载入应用设置' },
  { progress: 15, status: '正在初始化系统...', log: '正在连接桌面功能' },
  { progress: 20, status: '正在加载数据...', log: '正在加载课程' },
  { progress: 25, status: '正在加载数据...', log: '正在加载任务' },
  { progress: 30, status: '正在加载数据...', log: '正在读取个性化设置' },
  { progress: 35, status: '正在加载数据...', log: '正在准备课程配色' },
  { progress: 40, status: '正在连接服务...', log: '正在连接天气服务' },
  { progress: 45, status: '正在连接服务...', log: '正在载入每日诗词' },
  { progress: 50, status: '正在连接服务...', log: '正在检查网络状态' },
  { progress: 55, status: '正在连接服务...', log: '正在准备实时更新' },
  { progress: 60, status: '正在加载界面...', log: '正在加载界面组件' },
  { progress: 65, status: '正在加载界面...', log: '正在准备仪表盘' },
  { progress: 70, status: '正在加载界面...', log: '正在准备任务列表' },
  { progress: 75, status: '正在加载界面...', log: '正在应用你的主题' },
  { progress: 80, status: '即将完成...', log: '正在同步交互功能' },
  { progress: 85, status: '即将完成...', log: '正在启动后台服务' },
  { progress: 90, status: '即将完成...', log: '正在整理缓存数据' },
  { progress: 95, status: '即将完成...', log: '正在完成最后检查' },
  { progress: 100, status: '加载完成！', log: '✓ 系统启动成功' }
];

export const LoadingScreen = ({ progress, disableMotion = false }: LoadingScreenProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
  const motionDisabled = disableMotion || prefersReducedMotion;

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mediaQuery) return;

    const updatePreference = (event: MediaQueryListEvent | MediaQueryList) => {
      setPrefersReducedMotion(event.matches);
    };
    updatePreference(mediaQuery);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updatePreference);
      return () => mediaQuery.removeEventListener('change', updatePreference);
    }
    mediaQuery.addListener?.(updatePreference);
    return () => mediaQuery.removeListener?.(updatePreference);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || motionDisabled) return;

    const playVideo = () => {
      video.play().catch(err => {
        console.error('视频播放失败:', err);
      });
    };
    const handleLoadedData = () => {
      console.log('✓ 视频加载成功');
      playVideo();
    };
    const handleError = (e: Event) => {
      console.error('❌ 视频加载失败:', e);
      console.log('视频路径:', video.currentSrc || video.src);
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) playVideo();

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      video.pause();
    };
  }, [motionDisabled]);

  // 根据进度获取当前步骤
  const getCurrentStep = () => {
    for (let i = loadingSteps.length - 1; i >= 0; i--) {
      if (progress >= loadingSteps[i].progress) {
        return loadingSteps[i];
      }
    }
    return loadingSteps[0];
  };

  const currentStep = getCurrentStep();

  return (
    <div className={`loading-screen${motionDisabled ? ' motion-disabled' : ''}`}>
      {/* Do not even request the startup video when the user prefers reduced motion. */}
      {!motionDisabled && (
        <video
          ref={videoRef}
          loop
          muted
          playsInline
          preload="auto"
          className="loading-video"
          onLoadStart={() => console.log('📹 视频开始加载')}
          onCanPlay={() => console.log('✓ 视频可以播放')}
          onPlaying={() => console.log('▶️ 视频正在播放')}
        >
          <source src="./loading-video.webm" type="video/webm" />
          <source src="./loading-video.mp4" type="video/mp4" />
          您的浏览器不支持视频播放
        </video>
      )}

      {/* 备用背景（如果视频不加载） */}
      <div className="loading-fallback-bg"></div>

      {/* 顶部 Logo */}
      <div className="loading-logo">SPARK</div>

      {/* 底部加载信息 */}
      <div className="loading-overlay">
        <div className="loading-container">
          {/* 当前加载步骤（大字） */}
          <div className="loading-step">
            {currentStep.log}
          </div>

          {/* 进度条 */}
          <div className="loading-progress-wrapper">
            <div className="loading-progress-bar">
              <div 
                className="loading-progress-fill"
                style={{ inset: `0 ${100 - progress}% 0 0` }}
              />
            </div>
          </div>

          {/* 状态文字（小字） */}
          <div className="loading-status">
            {currentStep.status}
          </div>
        </div>
      </div>
    </div>
  );
};
