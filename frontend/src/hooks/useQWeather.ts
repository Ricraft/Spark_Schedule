import { useState, useEffect } from 'react';
import { useSettingsBridge } from './useSettingsBridge';

// 🌟 全局缓存：切换页面不会丢失
interface WeatherCache {
  data: {
    temp: number;
    text: string;
    icon: string;
    color: string;
    city: string;
  };
  timestamp: number;
  city: string; // 记录缓存对应的城市
}

const CACHE_KEY = 'qweather_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30分钟缓存

// 从 localStorage 加载缓存
const loadCache = (): WeatherCache | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error('加载天气缓存失败:', e);
  }
  return null;
};

// 保存缓存到 localStorage
const saveCache = (cache: WeatherCache) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('保存天气缓存失败:', e);
  }
};

let globalWeatherCache: WeatherCache | null = loadCache();

export const useQWeather = () => {
  const { settings } = useSettingsBridge();
  
  // 从设置中获取默认城市，如果没有则使用"北京"
  const defaultCity = settings?.weather_location || '北京';
  
  // 初始化时尝试使用缓存
  const [weather, setWeather] = useState<WeatherCache['data'] | null>(
    globalWeatherCache?.data || null
  );
  const [loading, setLoading] = useState(!globalWeatherCache);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchWeather = async () => {
      if (settings && settings.weather_enabled === false) {
        setWeather(null);
        setLoading(false);
        return;
      }

      const userCity = settings?.weather_location || defaultCity;
      
      // 🌟 优先检查缓存，如果有效就不需要等待 Bridge
      const now = Date.now();
      if (
        globalWeatherCache &&
        globalWeatherCache.city === userCity &&
        now - globalWeatherCache.timestamp < CACHE_DURATION
      ) {
        setWeather(globalWeatherCache.data);
        setLoading(false);
        const remainingMinutes = Math.floor((CACHE_DURATION - (now - globalWeatherCache.timestamp)) / 60000);
        console.log(`[useQWeather] 使用缓存的天气数据（${remainingMinutes}分钟后过期）`);
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
          
          if (!bridge?.get_weather) {
            console.warn('[useQWeather] Bridge未就绪，跳过天气获取');
            setLoading(false);
            return;
          }

          const result = await bridge.get_weather(userCity);
          const response = JSON.parse(result);
          
          if (response.status === 'success' && response.data) {
            const newData = response.data;
            
            // 🌟 更新全局缓存和 localStorage
            globalWeatherCache = {
              data: newData,
              timestamp: Date.now(),
              city: userCity
            };
            saveCache(globalWeatherCache);
            
            setWeather(newData);
            console.log('[useQWeather] 天气获取成功（已缓存30分钟）:', newData);
          } else {
            console.error('[useQWeather] 天气获取失败:', response.message);
          }
        } catch (error) {
          console.error('[useQWeather] 天气获取异常:', error);
        } finally {
          setLoading(false);
        }
      };

      checkBridge();
    };

    fetchWeather();
    
    // 监听后端天气数据更新信号
    const handleWeatherUpdate = (jsonStr: string) => {
      try {
        console.log('[useQWeather] 收到后端天气数据更新信号');
        const response = JSON.parse(jsonStr);
        
        if (response.status === 'success' && response.data) {
          const newData = response.data;
          const userCity = settings?.weather_location || defaultCity;
          
          // 更新全局缓存
          globalWeatherCache = {
            data: newData,
            timestamp: Date.now(),
            city: userCity
          };
          saveCache(globalWeatherCache);
          
          setWeather(newData);
          console.log('[useQWeather] 天气数据已自动更新:', newData);
        }
      } catch (error) {
        console.error('[useQWeather] 处理天气更新信号失败:', error);
      }
    };
    
    // 绑定信号监听 - 使用重试机制确保连接成功
    let retryCount = 0;
    const maxRetries = 10;
    
    const connectSignal = () => {
      const bridge = (window as any).pyBridge;
      
      if (bridge?.weatherDataUpdated) {
        try {
          // 先尝试断开旧连接
          try {
            bridge.weatherDataUpdated.disconnect(handleWeatherUpdate);
          } catch (e) {
            // 忽略断开连接错误
          }
          
          // 连接新的信号处理器
          bridge.weatherDataUpdated.connect(handleWeatherUpdate);
          console.log('[useQWeather] 已连接天气数据更新信号');
          
          // 测试信号是否真的存在
          console.log('[useQWeather] Signal type:', typeof bridge.weatherDataUpdated);
          console.log('[useQWeather] Signal connect:', typeof bridge.weatherDataUpdated.connect);
          
        } catch (error) {
          console.error('[useQWeather] 连接信号失败:', error);
        }
      } else {
        retryCount++;
        if (retryCount < maxRetries) {
          console.warn(`[useQWeather] Bridge 或 weatherDataUpdated 信号不存在，${retryCount}/${maxRetries} 次重试...`);
          setTimeout(connectSignal, 1000);
        } else {
          console.error('[useQWeather] 信号连接失败，已达到最大重试次数');
        }
      }
    };
    
    // 延迟连接信号，确保 QWebChannel 完全初始化
    const connectTimer = setTimeout(connectSignal, 500);
    
    // 监听预加载完成事件
    const handlePreloadComplete = () => {
      console.log('[useQWeather] 收到预加载完成事件，刷新数据');
      setRefreshTrigger(prev => prev + 1);
    };

    // 🔒 监听位置更新事件（从 Settings 页面触发）
    const handleLocationUpdate = () => {
      console.log('[useQWeather] 收到位置更新事件，清除缓存并刷新天气');
      globalWeatherCache = null;
      localStorage.removeItem(CACHE_KEY);
      setRefreshTrigger(prev => prev + 1);
    };

    // 🔥 监听强制刷新事件（从 Dashboard 触发）
    const handleForceRefresh = () => {
      console.log('[useQWeather] 收到强制刷新事件，立即重新获取天气');
      globalWeatherCache = null;
      localStorage.removeItem(CACHE_KEY);
      setRefreshTrigger(prev => prev + 1);
    };

    window.addEventListener('dataPreloadComplete', handlePreloadComplete);
    window.addEventListener('refreshWeatherAndShici', handleLocationUpdate);
    window.addEventListener('forceRefreshWeather', handleForceRefresh);

    return () => {
      clearTimeout(connectTimer);
      window.removeEventListener('dataPreloadComplete', handlePreloadComplete);
      window.removeEventListener('refreshWeatherAndShici', handleLocationUpdate);
      window.removeEventListener('forceRefreshWeather', handleForceRefresh);

      // 断开信号连接
      const currentBridge = (window as any).pyBridge;
      if (currentBridge?.weatherDataUpdated) {
        try {
          currentBridge.weatherDataUpdated.disconnect(handleWeatherUpdate);
          console.log('[useQWeather] 已断开天气数据更新信号');
        } catch (e) {
          // 忽略断开连接错误
        }
      }
    };
  }, [defaultCity, refreshTrigger, settings?.weather_location, settings?.weather_enabled]); // 🔥 添加 settings?.weather_location 作为依赖

  // 🌟 提供手动刷新功能
  const refresh = async () => {
    if (settings && settings.weather_enabled === false) {
      setWeather(null);
      setLoading(false);
      return;
    }

    globalWeatherCache = null;
    localStorage.removeItem(CACHE_KEY);
    setLoading(true);
    
    try {
      const bridge = (window as any).pyBridge;
      if (!bridge?.get_weather) return;

      const userCity = settings?.weather_location || defaultCity;
      const result = await bridge.get_weather(userCity);
      const response = JSON.parse(result);
      
      if (response.status === 'success' && response.data) {
        globalWeatherCache = {
          data: response.data,
          timestamp: Date.now(),
          city: userCity
        };
        saveCache(globalWeatherCache);
        setWeather(response.data);
        console.log('[useQWeather] 天气刷新成功');
      }
    } catch (error) {
      console.error('[useQWeather] 天气刷新失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return { weather, loading, refresh };
};
