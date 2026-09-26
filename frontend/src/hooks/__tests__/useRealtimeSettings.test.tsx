import { cleanup, renderHook } from '@testing-library/react';
import { useRealtimeSettings } from '../useRealtimeSettings';

let mockSettings: any;
jest.mock('../useSettingsBridge', () => ({
  useSettingsBridge: () => ({ settings: mockSettings }),
}));

const clearRuntimeState = () => {
  document.documentElement.className = '';
  document.documentElement.removeAttribute('style');
  document.body.removeAttribute('style');
};

afterEach(() => {
  cleanup();
  clearRuntimeState();
});

describe('useRealtimeSettings startup styling', () => {
  it('applies no-transition and reduced-motion preferences immediately from settings', () => {
    mockSettings = {
      dark_mode: true,
      midnight_mode: true,
      ui_transitions: false,
      ui_animations: false,
      gpu_acceleration: true,
      acrylic_opacity: 72,
      background_image: '',
    };

    renderHook(() => useRealtimeSettings());

    expect(document.documentElement).toHaveClass('dark', 'midnight', 'no-transitions', 'reduce-motion');
    expect(document.documentElement.style.getPropertyValue('--transition-duration')).toBe('0ms');
    expect(document.documentElement.style.getPropertyValue('will-change')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--acrylic-opacity')).toBe('0.72');
  });

  it('marks the shared custom background and clears stale wallpaper styles when disabled', () => {
    mockSettings = {
      dark_mode: false,
      midnight_mode: false,
      ui_transitions: true,
      ui_animations: true,
      gpu_acceleration: false,
      acrylic_opacity: 80,
      background_image: 'D:\\wallpapers\\spark.png',
    };

    renderHook(() => useRealtimeSettings());
    expect(document.documentElement).toHaveClass('has-custom-background', 'gpu-disabled');
    expect(document.body.style.backgroundImage).toContain('file:///D:/wallpapers/spark.png');

    cleanup();
    mockSettings = { ...mockSettings, background_image: '', gpu_acceleration: true };
    renderHook(() => useRealtimeSettings());
    expect(document.documentElement).not.toHaveClass('has-custom-background', 'gpu-disabled');
    expect(document.body.style.backgroundImage).toBe('');
  });
});
