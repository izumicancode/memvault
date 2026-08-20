import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AccentTheme, applyAccentTheme } from './theme';
import { getAccentTheme, setAccentTheme } from './storage';

interface ThemeState {
  accentTheme: AccentTheme;
  selectAccentTheme: (theme: AccentTheme) => Promise<void>;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accentTheme, setAccentThemeState] = useState<AccentTheme>('blue');

  useEffect(() => {
    getAccentTheme().then((theme) => {
      applyAccentTheme(theme);
      setAccentThemeState(theme);
    });
  }, []);

  const selectAccentTheme = async (theme: AccentTheme) => {
    applyAccentTheme(theme);
    setAccentThemeState(theme);
    await setAccentTheme(theme);
  };

  return <ThemeContext.Provider value={{ accentTheme, selectAccentTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}