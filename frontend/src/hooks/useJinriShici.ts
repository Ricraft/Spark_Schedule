import { useState, useEffect } from 'react';

export interface ShiciData {
  content: string;
  title: string;
  author: string;
  dynasty: string;
}

// 🌟 全局缓存：切换页面不会丢失
interface ShiciCache {
  data: ShiciData;
  timestamp: number;
}

const CACHE_KEY = 'jinrishici_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30分钟缓存

// 从 localStorage 加载缓存
const loadCache = (): ShiciCache | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error('加载诗词缓存失败:', e);
  }
  return null;
};

// 保存缓存到 localStorage
const saveCache = (cache: ShiciCache) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('保存诗词缓存失败:', e);
  }
};

let globalShiciCache: ShiciCache | null = loadCache();

export const useJinriShici = () => {
  // 初始化时尝试使用缓存
  const [shici, setShici] = useState<ShiciData | null>(
    globalShiciCache?.data || null
  );
  const [loading, setLoading] = useState(!globalShiciCache);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchShici = async () => {
      // 🌟 优先检查缓存，如果有效就不需要等待 Bridge
      const now = Date.now();
      if (globalShiciCache && now - globalShiciCache.timestamp < CACHE_DURATION) {
        setShici(globalShiciCache.data);
        setLoading(false);
        const remainingMinutes = Math.floor((CACHE_DURATION - (now - globalShiciCache.timestamp)) / 60000);
        console.log(`✅ [useJinriShici] 使用缓存的诗词（${remainingMinutes}分钟后过期）`);
        return; // 🔥 直接返回，不等待 Bridge
      }

      // 只有缓存过期或不存在时，才等待 Bridge 并请求新数据
      const checkBridge = () => {
        if ((window as any).pyBridge) {
          fetchFromBridge();
        } else {
          setTimeout(checkBridge, 500);
        }
      };

      const fetchFromBridge = async () => {
        try {
          const bridge = (window as any).pyBridge;
          
          if (!bridge?.get_shici) {
            console.warn('⚠️ [useJinriShici] Bridge未就绪，使用默认诗词');
            setLoading(false);
            return;
          }

          const result = await bridge.get_shici();
          const response = JSON.parse(result);
          
          if (response.status === 'success' && response.data) {
            const newData = response.data;
            
            // 🌟 更新全局缓存和 localStorage
            globalShiciCache = {
              data: newData,
              timestamp: Date.now()
            };
            saveCache(globalShiciCache);
            
            setShici(newData);
            console.log('✅ [useJinriShici] 诗词获取成功（已缓存30分钟）');
          } else {
            console.error('❌ [useJinriShici] 诗词获取失败:', response.message);
          }
        } catch (error) {
          console.error('❌ [useJinriShici] 诗词获取异常:', error);
        } finally {
          setLoading(false);
        }
      };

      checkBridge();
    };

    fetchShici();
    
    // 监听后端诗词数据更新信号
    const handleShiciUpdate = (jsonStr: string) => {
      try {
        console.log('🔔 [useJinriShici] 收到后端诗词数据更新信号');
        const response = JSON.parse(jsonStr);
        
        if (response.status === 'success' && response.data) {
          const newData = response.data;
          
          // 更新全局缓存
          globalShiciCache = {
            data: newData,
            timestamp: Date.now()
          };
          saveCache(globalShiciCache);
          
          setShici(newData);
          console.log('✅ [useJinriShici] 诗词数据已自动更新:', newData);
        }
      } catch (error) {
        console.error('❌ [useJinriShici] 处理诗词更新信号失败:', error);
      }
    };
    
    // 绑定信号监听 - 使用重试机制确保连接成功
    let retryCount = 0;
    const maxRetries = 10;
    
    const connectSignal = () => {
      const bridge = (window as any).pyBridge;
      
      if (bridge?.shiciDataUpdated) {
        try {
          // 先尝试断开旧连接
          try {
            bridge.shiciDataUpdated.disconnect(handleShiciUpdate);
          } catch (e) {
            // 忽略断开连接错误
          }
          
          // 连接新的信号处理器
          bridge.shiciDataUpdated.connect(handleShiciUpdate);
          console.log('🔗 [useJinriShici] 已连接诗词数据更新信号');
          
          // 测试信号是否真的存在
          console.log('🔍 [useJinriShici] Signal type:', typeof bridge.shiciDataUpdated);
          console.log('🔍 [useJinriShici] Signal connect:', typeof bridge.shiciDataUpdated.connect);
          
        } catch (error) {
          console.error('❌ [useJinriShici] 连接信号失败:', error);
        }
      } else {
        retryCount++;
        if (retryCount < maxRetries) {
          console.warn(`⚠️ [useJinriShici] Bridge 或 shiciDataUpdated 信号不存在，${retryCount}/${maxRetries} 次重试...`);
          setTimeout(connectSignal, 1000);
        } else {
          console.error('❌ [useJinriShici] 信号连接失败，已达到最大重试次数');
        }
      }
    };
    
    // 延迟连接信号，确保 QWebChannel 完全初始化
    const connectTimer = setTimeout(connectSignal, 500);
    
    // 监听预加载完成事件
    const handlePreloadComplete = () => {
      console.log('🔄 [useJinriShici] 收到预加载完成事件，刷新数据');
      setRefreshTrigger(prev => prev + 1);
    };

    // 🔒 监听位置更新事件（从 Settings 页面触发）
    const handleLocationUpdate = () => {
      console.log('🔄 [useJinriShici] 收到位置更新事件，清除缓存并刷新诗词');
      globalShiciCache = null;
      localStorage.removeItem(CACHE_KEY);
      setRefreshTrigger(prev => prev + 1);
    };

    // 🔥 监听强制刷新事件（从 Dashboard 触发）
    const handleForceRefresh = () => {
      console.log('🔥 [useJinriShici] 收到强制刷新事件，立即重新获取诗词');
      globalShiciCache = null;
      localStorage.removeItem(CACHE_KEY);
      setRefreshTrigger(prev => prev + 1);
    };

    window.addEventListener('dataPreloadComplete', handlePreloadComplete);
    window.addEventListener('refreshWeatherAndShici', handleLocationUpdate);
    window.addEventListener('forceRefreshShici', handleForceRefresh);

    return () => {
      clearTimeout(connectTimer);
      window.removeEventListener('dataPreloadComplete', handlePreloadComplete);
      window.removeEventListener('refreshWeatherAndShici', handleLocationUpdate);
      window.removeEventListener('forceRefreshShici', handleForceRefresh);

      // 断开信号连接
      const currentBridge = (window as any).pyBridge;
      if (currentBridge?.shiciDataUpdated) {
        try {
          currentBridge.shiciDataUpdated.disconnect(handleShiciUpdate);
          console.log('🔌 [useJinriShici] 已断开诗词数据更新信号');
        } catch (e) {
          // 忽略断开连接错误
        }
      }
    };
  }, [refreshTrigger]);

  // 🌟 提供手动刷新功能
  const refresh = async () => {
    globalShiciCache = null;
    localStorage.removeItem(CACHE_KEY);
    setLoading(true);
    
    try {
      const bridge = (window as any).pyBridge;
      if (!bridge?.get_shici) return;

      const result = await bridge.get_shici();
      const response = JSON.parse(result);
      
      if (response.status === 'success' && response.data) {
        globalShiciCache = {
          data: response.data,
          timestamp: Date.now()
        };
        saveCache(globalShiciCache);
        setShici(response.data);
        console.log('✅ [useJinriShici] 诗词刷新成功');
      }
    } catch (error) {
      console.error('❌ [useJinriShici] 诗词刷新失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return { shici, loading, refresh };
};
