/**
 * 性能优化工具
 * 自动检测GPU支持并应用相应的优化策略
 */

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private gpuEnabled: boolean = true;
  private reducedMotion: boolean = false;
  private performanceMode: 'high' | 'balanced' | 'low' = 'balanced';

  private constructor() {
    this.detectCapabilities();
    this.applyOptimizations();
    this.setupListeners();
  }

  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  /**
   * 检测设备能力
   */
  private detectCapabilities(): void {
    // 检测 GPU 支持
    this.gpuEnabled = this.checkGPUSupport();

    // 检测用户偏好设置
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 根据设备性能自动选择模式
    this.performanceMode = this.detectPerformanceMode();

    console.log('🔍 [Performance] 设备能力检测:', {
      gpuEnabled: this.gpuEnabled,
      reducedMotion: this.reducedMotion,
      performanceMode: this.performanceMode
    });
  }

  /**
   * 检查 GPU 支持
   */
  private checkGPUSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

      if (!gl) {
        console.warn('⚠️ [Performance] WebGL 不可用，GPU 加速已禁用');
        return false;
      }

      // 检查是否强制禁用 GPU
      const forceDisable = localStorage.getItem('force_disable_gpu') === 'true';
      if (forceDisable) {
        console.warn('⚠️ [Performance] GPU 加速已被用户强制禁用');
        return false;
      }

      return true;
    } catch (e) {
      console.error('❌ [Performance] GPU 检测失败:', e);
      return false;
    }
  }

  /**
   * 检测性能模式
   */
  private detectPerformanceMode(): 'high' | 'balanced' | 'low' {
    // 检查用户设置
    const userMode = localStorage.getItem('performance_mode') as 'high' | 'balanced' | 'low';
    if (userMode) {
      return userMode;
    }

    // 自动检测
    const memory = (performance as any).memory;
    const cores = navigator.hardwareConcurrency || 2;

    // 低端设备：内存 < 4GB 或 CPU < 4 核
    if (memory && memory.jsHeapSizeLimit < 4 * 1024 * 1024 * 1024 || cores < 4) {
      return 'low';
    }

    // 高端设备：内存 > 8GB 且 CPU >= 8 核
    if (memory && memory.jsHeapSizeLimit > 8 * 1024 * 1024 * 1024 && cores >= 8) {
      return 'high';
    }

    return 'balanced';
  }

  /**
   * 应用优化策略
   */
  private applyOptimizations(): void {
    const html = document.documentElement;

    // 移除所有优化类
    html.classList.remove('gpu-enabled', 'gpu-disabled', 'reduced-motion', 'performance-high', 'performance-balanced', 'performance-low');

    // 应用 GPU 状态
    if (this.gpuEnabled) {
      html.classList.add('gpu-enabled');
    } else {
      html.classList.add('gpu-disabled');
    }

    // 应用动画偏好
    if (this.reducedMotion) {
      html.classList.add('reduced-motion');
    }

    // 应用性能模式
    html.classList.add(`performance-${this.performanceMode}`);

    // 应用具体优化
    this.applyModeSpecificOptimizations();
  }

  /**
   * 应用模式特定的优化
   */
  private applyModeSpecificOptimizations(): void {
    const root = document.documentElement;

    switch (this.performanceMode) {
      case 'low':
        // 低性能模式：最小化动画和效果
        root.style.setProperty('--animation-duration', '0.15s');
        root.style.setProperty('--transition-duration', '0.1s');
        root.style.setProperty('--blur-amount', '8px');
        break;

      case 'balanced':
        // 平衡模式：适中的动画和效果
        root.style.setProperty('--animation-duration', '0.3s');
        root.style.setProperty('--transition-duration', '0.2s');
        root.style.setProperty('--blur-amount', '16px');
        break;

      case 'high':
        // 高性能模式：完整的动画和效果
        root.style.setProperty('--animation-duration', '0.5s');
        root.style.setProperty('--transition-duration', '0.3s');
        root.style.setProperty('--blur-amount', '24px');
        break;
    }

    // GPU 禁用时的特殊优化
    if (!this.gpuEnabled) {
      root.style.setProperty('--blur-amount', '0px'); // 禁用模糊效果
      root.style.setProperty('--shadow-blur', '8px'); // 减少阴影模糊
    }
  }

  /**
   * 设置监听器
   */
  private setupListeners(): void {
    // 监听用户偏好变化
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this.reducedMotion = e.matches;
      this.applyOptimizations();
      console.log('🔄 [Performance] 动画偏好已更新:', this.reducedMotion);
    });

    // 监听性能变化
    if ('deviceMemory' in navigator) {
      // 定期检查内存使用情况
      setInterval(() => {
        const memory = (performance as any).memory;
        if (memory) {
          const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
          if (usageRatio > 0.9 && this.performanceMode !== 'low') {
            console.warn('⚠️ [Performance] 内存使用率过高，切换到低性能模式');
            this.setPerformanceMode('low');
          }
        }
      }, 30000); // 每 30 秒检查一次
    }
  }

  /**
   * 设置性能模式
   */
  setPerformanceMode(mode: 'high' | 'balanced' | 'low'): void {
    this.performanceMode = mode;
    localStorage.setItem('performance_mode', mode);
    this.applyOptimizations();
    console.log('✅ [Performance] 性能模式已设置:', mode);
  }

  /**
   * 切换 GPU 加速
   */
  toggleGPU(enabled: boolean): void {
    this.gpuEnabled = enabled;
    localStorage.setItem('force_disable_gpu', enabled ? 'false' : 'true');
    this.applyOptimizations();
    console.log('✅ [Performance] GPU 加速已', enabled ? '启用' : '禁用');

    // 需要刷新页面以完全应用更改
    if (confirm('更改 GPU 设置需要刷新页面才能生效，是否立即刷新？')) {
      window.location.reload();
    }
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      gpuEnabled: this.gpuEnabled,
      reducedMotion: this.reducedMotion,
      performanceMode: this.performanceMode
    };
  }

  /**
   * 优化大列表渲染
   */
  optimizeListRendering(container: HTMLElement, itemHeight: number): void {
    if (!this.gpuEnabled || this.performanceMode === 'low') {
      // 使用虚拟滚动
      container.style.contain = 'layout style paint';
      container.style.contentVisibility = 'auto';
    }
  }

  /**
   * 优化动画
   */
  optimizeAnimation(element: HTMLElement): void {
    if (!this.gpuEnabled) {
      // 禁用 GPU 加速相关属性
      element.style.willChange = 'auto';
      element.style.transform = 'none';
    } else {
      // 启用 GPU 加速
      element.style.willChange = 'transform, opacity';
      element.style.transform = 'translateZ(0)';
    }
  }

  /**
   * 节流函数
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    };
  }

  /**
   * 防抖函数
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  /**
   * 请求空闲回调
   */
  requestIdleCallback(callback: () => void, timeout: number = 1000): void {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(callback, { timeout });
    } else {
      setTimeout(callback, 1);
    }
  }
}

// 导出单例
export const performanceOptimizer = PerformanceOptimizer.getInstance();
