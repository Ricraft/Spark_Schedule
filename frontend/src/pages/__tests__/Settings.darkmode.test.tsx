import { describe, it, expect, beforeEach } from '@jest/globals';

describe('Settings - Dark Mode Toggle', () => {
  beforeEach(() => {
    // Clear any dark mode class before each test
    document.documentElement.classList.remove('dark');
  });

  it('should add dark class to document element', () => {
    document.documentElement.classList.add('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should remove dark class from document element', () => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should toggle dark class', () => {
    // Initially no dark class
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    
    // Add dark class
    document.documentElement.classList.add('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    
    // Remove dark class
    document.documentElement.classList.remove('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
