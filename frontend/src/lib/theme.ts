import { useSyncExternalStore } from 'react';

/**
 * 화면 밝기(야간모드) 설정.
 * 시스템(기본, 기기 설정을 따름) · 밝게 · 어둡게 중 하나를 이 브라우저에 남긴다.
 * 첫 화면이 깜빡이지 않도록 index.html 의 작은 스크립트가 같은 키로 먼저 적용한다.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'sagak.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** 고른 값과 기기 설정으로 실제 화면 밝기를 정한다 */
export function resolveTheme(choice: ThemeChoice, systemDark: boolean): Theme {
  if (choice === 'light' || choice === 'dark') return choice;
  return systemDark ? 'dark' : 'light';
}

export function loadThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function saveThemeChoice(choice: ThemeChoice) {
  try {
    // 시스템은 기본값이라 따로 남기지 않는다
    if (choice === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // 저장할 수 없는 브라우저(사생활 보호 창 등)면 이번 방문에만 적용한다
  }
}

function darkQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(DARK_QUERY);
}

export function systemPrefersDark(): boolean {
  return darkQuery()?.matches ?? false;
}

// ---------- 화면 전체가 함께 쓰는 상태 ----------
export interface ThemeState {
  choice: ThemeChoice;
  theme: Theme;
}

const initialChoice = loadThemeChoice();
let state: ThemeState = { choice: initialChoice, theme: resolveTheme(initialChoice, systemPrefersDark()) };
const listeners = new Set<() => void>();

function apply() {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = state.theme;
}

function update(choice: ThemeChoice) {
  const theme = resolveTheme(choice, systemPrefersDark());
  if (choice === state.choice && theme === state.theme) return;
  state = { choice, theme };
  apply();
  listeners.forEach((l) => l());
}

/** 화면 밝기를 고른다 (이 브라우저에 남긴다) */
export function setThemeChoice(choice: ThemeChoice) {
  saveThemeChoice(choice);
  update(choice);
}

// 시스템을 따르는 동안 기기 설정이 바뀌면 바로 반영한다
darkQuery()?.addEventListener?.('change', () => {
  if (state.choice === 'system') update('system');
});
apply();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getState = () => state;

/** 지금 고른 값(choice)과 실제 화면 밝기(theme) */
export function useTheme(): ThemeState {
  return useSyncExternalStore(subscribe, getState, getState);
}
