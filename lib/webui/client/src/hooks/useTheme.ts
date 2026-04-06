import { useEffect, useMemo, useState } from 'react';
import { applyTheme, getStoredThemePreference, getSystemTheme, type ThemePreference } from '../theme';

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => getStoredThemePreference());
  const [systemTheme, setSystemTheme] = useState(() => getSystemTheme());

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
      if (getStoredThemePreference() === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = useMemo(
    () => (preference === 'system' ? systemTheme : preference),
    [preference, systemTheme],
  );

  return {
    preference,
    resolvedTheme,
    setThemePreference: setPreference,
  };
}
