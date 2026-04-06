export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'agent-task-theme';
const THEME_META_ID = 'theme-color-meta';
const THEME_COLORS = {
  light: '#ffffff',
  dark: '#121926',
};

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? getSystemTheme() : preference;
}

function updateThemeColorMeta(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  let meta = document.querySelector(`meta[name="theme-color"]#${THEME_META_ID}`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('id', THEME_META_ID);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', THEME_COLORS[resolved]);
}

export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference);
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    updateThemeColorMeta(resolved);
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, preference);
  }
  return resolved;
}
