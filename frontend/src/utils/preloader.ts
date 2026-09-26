/**
 * 数据预加载器
 * 在应用启动时预加载天气和古诗数据
 */

const CACHE_DURATION = 30 * 60 * 1000; // 30分钟

// 检查缓存是否有效
const isCacheValid = (cacheKey: string, city?: string): boolean => {
  try {
    const cached = localStorage.getItem(cacheKey);
    console.log(`[Preloader] 检查缓存 ${cacheKey}:`, cached ? '存在' : '不存在');
    
    if (!cached) {
      console.log(`[Preloader] ${cacheKey} 缓存不存在`);
      return false;
    }
    
    const cache = JSON.parse(cached);
    const now = Date.now();
    const age = now - cache.timestamp;
    const ageMinutes = Math.floor(age / 60000);
    
    console.log(`[Preloader] ${cacheKey} 缓存年龄: ${ageMinutes} 分钟`);
    
    // 检查时间是否过期
    if (now - cache.timestamp >= CACHE_DURATION) {
      console.log(`[Preloader] ${cacheKey} 缓存已过期 (${ageMinutes} 分钟)`);
      return false;
    }
    
    // 如果是天气缓存，还要检查城市是否匹配
    if (city && cache.city !== city) {
      console.log(`[Preloader] ${cacheKey} 城市不匹配: ${cache.city} !== ${city}`);
      return false;
    }
    
    console.log(`[Preloader] ${cacheKey} 缓存有效 (剩余 ${30 - ageMinutes} 分钟)`);
    return true;
  } catch (e) {
    console.error(`[Preloader] ${cacheKey} 缓存检查失败:`, e);
    return false;
  }
};

// 预加载天气数据
export const preloadWeather = async () => {
  const userCity = localStorage.getItem('userCity') || '北京';
  
  // 如果缓存有效，跳过预加载
  if (isCacheValid('qweather_cache', userCity)) {
    console.log('[Preloader] 天气缓存有效，跳过预加载');
    return;
  }
  
  console.log('[Preloader] 开始预加载天气数据');
  
  // 等待 Bridge 就绪（最多等待5秒）
  const waitForBridge = () => {
    return new Promise<any>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5秒
      
      const check = () => {
        const bridge = (window as any).pyBridge;
        if (bridge && bridge.get_weather) {
          resolve(bridge);
        } else {
          attempts++;
          if (attempts >= maxAttempts) {
            reject(new Error('Bridge 超时'));
          } else {
            setTimeout(check, 100);
          }
        }
      };
      check();
    });
  };

  try {
    const bridge = await waitForBridge();
    const result = await bridge.get_weather(userCity);
    const response = JSON.parse(result);
    
    console.log('[Preloader] 天气API响应:', response);
    
    if (response.status === 'success' && response.data) {
      // 保存到缓存
      const cache = {
        data: response.data,
        timestamp: Date.now(),
        city: userCity
      };
      localStorage.setItem('qweather_cache', JSON.stringify(cache));
      console.log('[Preloader] 天气数据预加载成功并已缓存:', response.data);
      console.log('[Preloader] 缓存内容:', cache);
      
      // 验证缓存是否保存成功
      const savedCache = localStorage.getItem('qweather_cache');
      if (savedCache) {
        console.log('[Preloader] 缓存验证成功，已保存到 localStorage');
      } else {
        console.error('[Preloader] 缓存验证失败，localStorage 保存失败');
      }
    } else {
      console.warn('[Preloader] 天气数据获取失败:', response);
    }
  } catch (error) {
    console.error('[Preloader] 天气数据预加载失败:', error);
  }
};

// 预加载古诗数据
export const preloadShici = async () => {
  // 如果缓存有效，跳过预加载
  if (isCacheValid('jinrishici_cache')) {
    console.log('[Preloader] 古诗缓存有效，跳过预加载');
    return;
  }
  
  console.log('[Preloader] 开始预加载古诗数据');
  
  // 等待 Bridge 就绪（最多等待5秒）
  const waitForBridge = () => {
    return new Promise<any>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5秒
      
      const check = () => {
        const bridge = (window as any).pyBridge;
        if (bridge && bridge.get_shici) {
          resolve(bridge);
        } else {
          attempts++;
          if (attempts >= maxAttempts) {
            reject(new Error('Bridge 超时'));
          } else {
            setTimeout(check, 100);
          }
        }
      };
      check();
    });
  };

  try {
    const bridge = await waitForBridge();
    const result = await bridge.get_shici();
    const response = JSON.parse(result);
    
    console.log('[Preloader] 古诗API响应:', response);
    
    if (response.status === 'success' && response.data) {
      // 保存到缓存
      const cache = {
        data: response.data,
        timestamp: Date.now()
      };
      localStorage.setItem('jinrishici_cache', JSON.stringify(cache));
      console.log('[Preloader] 古诗数据预加载成功并已缓存:', response.data);
      console.log('[Preloader] 缓存内容:', cache);
      
      // 验证缓存是否保存成功
      const savedCache = localStorage.getItem('jinrishici_cache');
      if (savedCache) {
        console.log('[Preloader] 缓存验证成功，已保存到 localStorage');
      } else {
        console.error('[Preloader] 缓存验证失败，localStorage 保存失败');
      }
    } else {
      console.warn('[Preloader] 古诗数据获取失败:', response);
    }
  } catch (error) {
    console.error('[Preloader] 古诗数据预加载失败:', error);
  }
};
