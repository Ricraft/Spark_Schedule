import { useEffect, useState } from 'react';

// pyBridge is provided by the desktop host after a QWebChannel connection.
declare global {
  interface Window {
    pyBridge?: any;
  }
}

interface WebChannelProviderProps {
  children: React.ReactNode;
}

export const WebChannelProvider = ({ children }: WebChannelProviderProps) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let initTimer: number;
    let maxRetries = 10;
    let retryCount = 0;

    const initWebChannel = () => {
      console.log(`🔄 WebChannel 初始化尝试 ${retryCount + 1}/${maxRetries}`);
      
      // 检查必要的对象是否存在
      if (typeof window.qt !== 'undefined' && 
          window.qt.webChannelTransport && 
          typeof window.QWebChannel !== 'undefined') {
        
        console.log('✅ WebChannel 环境就绪，开始初始化...');
        
        try {
          new window.QWebChannel(window.qt.webChannelTransport, (channel: any) => {
            console.log('✅ WebChannel 连接成功');
            window.pyBridge = channel.objects.pyBridge;
            console.log('✅ pyBridge 对象已设置:', typeof window.pyBridge);
            
            // 设置就绪状态
            setIsReady(true);
            
            // 触发自定义事件通知其他组件
            window.dispatchEvent(new CustomEvent('webChannelReady', {
              detail: { pyBridge: window.pyBridge }
            }));
          });
        } catch (error) {
          console.error('❌ WebChannel 初始化失败:', error);
          retryAfterDelay();
        }
      } else {
        console.log('⏳ WebChannel 环境未就绪，等待中...');
        console.log('- window.qt:', typeof window.qt);
        console.log('- webChannelTransport:', typeof window.qt?.webChannelTransport);
        console.log('- QWebChannel:', typeof window.QWebChannel);
        
        retryAfterDelay();
      }
    };

    const retryAfterDelay = () => {
      retryCount++;
      if (retryCount < maxRetries) {
        initTimer = window.setTimeout(initWebChannel, 500);
      } else {
        console.warn('⚠️ WebChannel 初始化超时，将使用本地存储模式');
        setIsReady(true); // 允许应用继续运行，使用本地存储
      }
    };

    // 立即开始初始化
    initWebChannel();

    return () => {
      if (initTimer) {
        clearTimeout(initTimer);
      }
    };
  }, []);

  // 在 WebChannel 就绪之前显示加载状态
  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">正在初始化应用...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};