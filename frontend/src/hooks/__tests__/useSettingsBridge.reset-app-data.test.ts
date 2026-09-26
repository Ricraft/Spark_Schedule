/**
 * Unit tests for reset_app_data method in useSettingsBridge hook
 * 
 * Tests the implementation of Task 3.4:
 * - reset_app_data method calls bridge.reset_app_data()
 * - Handles success: reloads settings from backend
 * - Handles error: throws error with error message
 * - Returns Promise for proper async handling
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useSettingsBridge } from '../useSettingsBridge';

// Mock window.pyBridge
const mockPyBridge = {
  get_global_settings: jest.fn(),
  update_settings: jest.fn(),
  reset_app_data: jest.fn(),
  settingsUpdated: {
    connect: jest.fn(),
    disconnect: jest.fn(),
  },
};

describe('useSettingsBridge - reset_app_data method', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (window as any).pyBridge = mockPyBridge;
    
    // Default mock for get_global_settings
    mockPyBridge.get_global_settings.mockResolvedValue(JSON.stringify({
      version: '1.0.0',
      last_modified: '2024-01-01',
      dark_mode: false,
      gpu_acceleration: true,
    }));
  });

  afterEach(() => {
    delete (window as any).pyBridge;
  });

  test('reset_app_data calls bridge.reset_app_data() and reloads settings', async () => {
    const resetResult = { status: 'success', message: '应用数据已重置' };
    mockPyBridge.reset_app_data.mockResolvedValue(JSON.stringify(resetResult));

    const { result } = renderHook(() => useSettingsBridge());

    // Wait for initial settings to load
    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });

    // Clear the mock to track calls after initial load
    mockPyBridge.get_global_settings.mockClear();

    // Call reset_app_data
    let resetResponse;
    await act(async () => {
      resetResponse = await result.current.reset_app_data();
    });

    // Verify bridge method was called
    expect(mockPyBridge.reset_app_data).toHaveBeenCalledTimes(1);

    // Verify success response
    expect(resetResponse).toEqual({
      success: true,
      result: JSON.stringify(resetResult),
    });

    // Verify settings were reloaded
    await waitFor(() => {
      expect(mockPyBridge.get_global_settings).toHaveBeenCalled();
    });
  });

  test('reset_app_data handles error when bridge method fails', async () => {
    const errorMessage = 'Failed to reset app data';
    mockPyBridge.reset_app_data.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useSettingsBridge());

    // Wait for initial settings to load
    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });

    // Call reset_app_data and expect error
    await act(async () => {
      await expect(result.current.reset_app_data()).rejects.toThrow(errorMessage);
    });

    // Verify bridge method was called
    expect(mockPyBridge.reset_app_data).toHaveBeenCalledTimes(1);
  });

  test('reset_app_data throws error when bridge is not available', async () => {
    delete (window as any).pyBridge;

    const { result } = renderHook(() => useSettingsBridge());

    // Wait a bit for initialization attempts
    await new Promise(resolve => setTimeout(resolve, 100));

    // Call reset_app_data and expect error
    await act(async () => {
      await expect(result.current.reset_app_data()).rejects.toThrow('Bridge not available');
    });
  });

  test('reset_app_data returns Promise for proper async handling', async () => {
    const resetResult = { status: 'success', message: '应用数据已重置' };
    mockPyBridge.reset_app_data.mockResolvedValue(JSON.stringify(resetResult));

    const { result } = renderHook(() => useSettingsBridge());

    // Wait for initial settings to load
    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });

    // Call reset_app_data and verify it returns a Promise
    let resetPromise;
    await act(async () => {
      resetPromise = result.current.reset_app_data();
      expect(resetPromise).toBeInstanceOf(Promise);
      await resetPromise;
    });
  });

  test('resetApp (legacy method) works as alias for reset_app_data', async () => {
    const resetResult = { status: 'success', message: '应用数据已重置' };
    mockPyBridge.reset_app_data.mockResolvedValue(JSON.stringify(resetResult));

    const { result } = renderHook(() => useSettingsBridge());

    // Wait for initial settings to load
    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });

    // Call resetApp (legacy method)
    let resetResponse;
    await act(async () => {
      resetResponse = await result.current.resetApp();
    });

    // Verify bridge method was called
    expect(mockPyBridge.reset_app_data).toHaveBeenCalledTimes(1);

    // Verify success response
    expect(resetResponse).toEqual({
      success: true,
      result: JSON.stringify(resetResult),
    });
  });
});
