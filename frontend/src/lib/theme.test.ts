import { beforeEach, describe, expect, it } from 'vitest';
import { THEME_KEY, loadThemeChoice, resolveTheme, saveThemeChoice, setThemeChoice } from './theme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('resolves the system choice by the device setting', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('defaults to system and persists an explicit choice', () => {
    expect(loadThemeChoice()).toBe('system');
    saveThemeChoice('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(loadThemeChoice()).toBe('dark');
    saveThemeChoice('system');
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(loadThemeChoice()).toBe('system');
  });

  it('ignores unknown stored values', () => {
    localStorage.setItem(THEME_KEY, 'sepia');
    expect(loadThemeChoice()).toBe('system');
  });

  it('applies the choice to the document and stores it', () => {
    setThemeChoice('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    setThemeChoice('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(loadThemeChoice()).toBe('light');
  });
});
