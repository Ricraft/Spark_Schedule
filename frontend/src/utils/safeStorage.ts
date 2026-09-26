/**
 * 安全的 localStorage 封装
 * 处理 quota 超限、JSON 解析错误等异常情况
 */

export class SafeStorage {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 100;

  /**
   * 安全地获取 localStorage 数据
   */
  static getItem<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }

      const parsed = JSON.parse(item);
      return parsed as T;
    } catch (e) {
      if (e instanceof SyntaxError) {
        console.error(`❌ [SafeStorage] JSON 解析失败: ${key}`, e);
      } else {
        console.error(`❌ [SafeStorage] 读取失败: ${key}`, e);
      }
      return defaultValue;
    }
  }

  /**
   * 安全地设置 localStorage 数据
   * 自动处理 quota 超限问题
   */
  static setItem<T>(key: string, value: T): boolean {
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const serialized = JSON.stringify(value);
        localStorage.setItem(key, serialized);
        return true;
      } catch (e: any) {
        // Quota 超限错误
        if (e.name === 'QuotaExceededError' || e.code === 22) {
          console.warn(`⚠️ [SafeStorage] Quota 超限 (尝试 ${attempt + 1}/${this.MAX_RETRIES})`);

          if (attempt < this.MAX_RETRIES - 1) {
            // 尝试清理旧数据
            this.cleanupOldData();
          } else {
            console.error('❌ [SafeStorage] Quota 超限，清理后仍无法保存');
            return false;
          }
        } else {
          console.error(`❌ [SafeStorage] 保存失败: ${key}`, e);
          return false;
        }
      }
    }
    return false;
  }

  /**
   * 安全地删除数据
   */
  static removeItem(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error(`❌ [SafeStorage] 删除失败: ${key}`, e);
      return false;
    }
  }

  /**
   * 清理旧数据（基于时间戳）
   */
  private static cleanupOldData(): void {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

      // 查找带时间戳的缓存数据
      const cacheKeys = keys.filter(k => k.includes('_cache_') || k.includes('_timestamp'));

      for (const key of cacheKeys) {
        try {
          const item = localStorage.getItem(key);
          if (!item) continue;

          const data = JSON.parse(item);
          const timestamp = data.timestamp || data.updated_at || data.created_at;

          if (timestamp && now - new Date(timestamp).getTime() > ONE_WEEK) {
            localStorage.removeItem(key);
            console.log(`🧹 [SafeStorage] 清理过期数据: ${key}`);
          }
        } catch {
          // 忽略解析错误
        }
      }

      // 如果还是不够，清理最大的项
      if (cacheKeys.length === 0) {
        this.cleanupLargestItems(3);
      }
    } catch (e) {
      console.error('❌ [SafeStorage] 清理失败:', e);
    }
  }

  /**
   * 清理最大的几个项
   */
  private static cleanupLargestItems(count: number): void {
    try {
      const keys = Object.keys(localStorage);
      const sizes = keys.map(key => ({
        key,
        size: (localStorage.getItem(key) || '').length
      }));

      // 按大小排序
      sizes.sort((a, b) => b.size - a.size);

      // 删除最大的几个
      for (let i = 0; i < Math.min(count, sizes.length); i++) {
        localStorage.removeItem(sizes[i].key);
        console.log(`🧹 [SafeStorage] 清理大项: ${sizes[i].key} (${sizes[i].size} bytes)`);
      }
    } catch (e) {
      console.error('❌ [SafeStorage] 清理大项失败:', e);
    }
  }

  /**
   * 获取存储使用情况
   */
  static getStorageInfo(): { used: number; total: number; percentage: number } {
    try {
      let used = 0;
      const keys = Object.keys(localStorage);

      for (const key of keys) {
        const item = localStorage.getItem(key);
        if (item) {
          used += item.length + key.length;
        }
      }

      // 大多数浏览器限制为 5-10MB
      const total = 5 * 1024 * 1024; // 假设 5MB
      const percentage = (used / total) * 100;

      return { used, total, percentage };
    } catch (e) {
      console.error('❌ [SafeStorage] 获取存储信息失败:', e);
      return { used: 0, total: 0, percentage: 0 };
    }
  }

  /**
   * 检查是否可用
   */
  static isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
}
