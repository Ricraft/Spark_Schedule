import { useEffect } from 'react';
import { useSettingsBridge } from './useSettingsBridge';

/**
 * 实时应用设置的 Hook
 * 监听设置变化并立即应用到 UI
 */
export const useRealtimeSettings = () => {
  const { settings } = useSettingsBridge();

  useEffect(() => {
    if (!settings) return;

    console.log('[useRealtimeSettings] Settings updated:', {
      midnight_mode: settings.midnight_mode,
      dark_mode: settings.dark_mode,
      background_image: settings.background_image,
      acrylic_opacity: settings.acrylic_opacity
    });

    // 1. 深色/深邃模式：避免反复 remove/connect 导致状态抖动
    const useDark = Boolean(settings.dark_mode || settings.midnight_mode);
    const useMidnight = Boolean(settings.midnight_mode);
    document.documentElement.classList.toggle('dark', useDark);
    document.documentElement.classList.toggle('midnight', useMidnight);

    const root = document.documentElement;

    // 2. UI 过渡开关在首份设置到达后立即落到根节点，禁用时无需等 CSS 重新载入。
    const transitionsEnabled = settings.ui_transitions !== false;
    root.classList.toggle('no-transitions', !transitionsEnabled);
    if (transitionsEnabled) {
      root.style.removeProperty('--transition-duration');
    } else {
      root.style.setProperty('--transition-duration', '0ms');
    }

    // 3. 毛玻璃透明度
    const opacityValue = Number(settings.acrylic_opacity ?? 80);
    const opacity = Number.isFinite(opacityValue) ? Math.min(100, Math.max(0, opacityValue)) : 80;
    root.style.setProperty('--acrylic-opacity', `${opacity / 100}`);
    root.style.setProperty('--glass-bg-opacity', `${opacity / 100}`);

    // 4. 背景图片：由 body 统一承载，页面自身不覆盖用户壁纸。
    const backgroundPath = String(settings.background_image || '').trim();
    root.classList.toggle('has-custom-background', Boolean(backgroundPath));
    if (backgroundPath) {
      const imagePath = backgroundPath.replace(/\\/g, '/');
      document.body.style.backgroundImage = `url(${JSON.stringify(`file:///${imagePath}`)})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
    } else {
      document.body.style.backgroundImage = '';
      document.body.style.backgroundSize = '';
      document.body.style.backgroundPosition = '';
      document.body.style.backgroundAttachment = '';
    }

    // 5. GPU acceleration should not force a permanent layer on the document root.
    root.classList.toggle('gpu-disabled', settings.gpu_acceleration === false);

    // 6. 界面动效
    root.classList.toggle('reduce-motion', settings.ui_animations === false);

  }, [settings]);

  return settings;
};
