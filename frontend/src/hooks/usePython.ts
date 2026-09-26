import { useEffect, useState } from 'react';

// 🔥 全局单例变量 (放在组件外面，永远不会被重置)
let g_bridge: any = null;
let g_initPromise: Promise<any> | null = null;

// 🔧 超时包装函数
const withTimeout = <T,>(p: Promise<T>, ms: number, label: string) => {
  let t: any;
  const timeout = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} 超时(${ms}ms)`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
};

// 🩺 Bridge 健康检查
const isBridgeAlive = async (py: any) => {
  try {
    if (!py?.ping) return false;
    const r = await withTimeout(py.ping(), 800, "ping");
    return r === "pong";
  } catch {
    return false;
  }
};

// 🌍 全局信号绑定函数（单例级别，确保信号永不丢失）
const ensureGlobalSignals = (py: any) => {
  if (!py) return;
  if (py.__globalScheduleSignalsBound) return;
  py.__globalScheduleSignalsBound = true;
  
  console.log('🌍 [Singleton] 绑定全局 scheduleLoaded/dataStateChanged 信号...');
  
  py.scheduleLoaded?.connect?.((jsonStr: string) => {
    console.log('📡 [Singleton] 收到 scheduleLoaded，JSON 长度:', jsonStr?.length, '类型:', typeof jsonStr);
    console.log('📡 [Singleton] JSON 前100字符:', jsonStr?.substring(0, 100));
    try {
      const data = JSON.parse(jsonStr);
      console.log('📡 [Singleton] 解析成功，课程数量:', Array.isArray(data) ? data.length : '非数组');
      window.dispatchEvent(new CustomEvent('scheduleDataUpdated', {
        detail: { action: 'signal_update', courses: data }
      }));
    } catch (e) {
      console.error('❌ [Singleton] scheduleLoaded parse error:', e);
      console.error('❌ [Singleton] 原始数据:', jsonStr);
    }
  });
  
  py.dataStateChanged?.connect?.((state: string) => {
    console.log('📡 [Singleton] dataStateChanged:', state);
    if (typeof state === 'string' && state.includes('schedule_cleared')) {
      window.dispatchEvent(new CustomEvent('scheduleDataUpdated', {
        detail: { action: 'clear', courses: [] }
      }));
    }
    // ✅ 文件导入（Excel/JSON/HTML）完成后触发刷新
    if (typeof state === 'string' && state.includes('imported_instant')) {
      console.log('📁 [Singleton] 检测到文件导入完成，触发 refresh_request');
      window.dispatchEvent(new CustomEvent('scheduleDataUpdated', {
        detail: { action: 'refresh_request' }
      }));
    }
  });
  
  // 绑定完成后让后端再主动发一次（避免"绑定前 emit"丢信号）
  if (py.init_frontend) {
    py.init_frontend();
  }
};

export function usePython() {
  const [isReady, setIsReady] = useState(!!g_bridge);
  const [bridge, setBridge] = useState<any>(g_bridge);

  useEffect(() => {
    // 初始化函数
    const initBridge = async () => {
      if (g_bridge) return g_bridge;
      if (g_initPromise) return g_initPromise; // 防止并发初始化

      g_initPromise = new Promise((resolve, reject) => {
        const checkQt = setInterval(() => {
          // 检查 qt 环境注入
          if ((window as any).qt && (window as any).qt.webChannelTransport && (window as any).QWebChannel) {
            clearInterval(checkQt);
            try {
              new (window as any).QWebChannel((window as any).qt.webChannelTransport, (channel: any) => {
                const py = channel.objects.bridge; // ✅ 统一使用 bridge
                
                // 挂载到全局
                g_bridge = py;
                (window as any).pyBridge = py; // 保持全局变量名方便调试
                
                console.log("🚀 [Singleton] Python Bridge 连接成功!");
                
                // ✅ 立即绑定全局信号（单例级别）
                ensureGlobalSignals(py);
                
                // 🧪 测试信号连接：调用 init_app 触发一次数据发送
                setTimeout(() => {
                  if (py.init_app) {
                    console.log('🧪 [Test] 调用 init_app() 测试信号连接...');
                    py.init_app();
                  }
                }, 1000);
                
                resolve(py);
              });
            } catch (e) {
              console.error("QWebChannel 初始化失败", e);
              reject(e);
            }
          }
        }, 100); // 每 100ms 检查一次
      });

      return g_initPromise;
    };

    // 即使 g_bridge 存在，也要先确认通道还活着（否则是假 ready）
    const reuseOrReconnect = async () => {
      if (g_bridge) {
        const alive = await isBridgeAlive(g_bridge);
        if (alive) {
          console.log('✅ [Singleton] Bridge 健康检查通过，复用现有连接');
          setBridge(g_bridge);
          setIsReady(true);
          return;
        }
        
        console.warn("🔌 [Singleton] 检测到 Bridge 已失效，准备重连...");
        // 关键：清空全局，允许重新初始化
        g_bridge = null;
        g_initPromise = null;
        setBridge(null);
        setIsReady(false);
      }
      
      // 没有 bridge 或 bridge 已失效 → 走 initBridge
      const py = await initBridge();
      if (py) {
        setBridge(py);
        setIsReady(true);
      }
    };

    reuseOrReconnect();
  }, []); // 空依赖数组，确保只运行一次

  return { isReady, bridge };
}