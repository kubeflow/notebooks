import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  createContext,
  FC,
  ReactNode,
} from 'react';
import { createTheme, ThemeProvider as MUIThemeProvider } from '@mui/material/styles';
import { Theme } from 'mod-arch-kubeflow';
import '~/style/MUI-theme.scss';

export type ThemeContextProps = {
  isMUITheme: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
};

export const ThemeContext = createContext<ThemeContextProps>({
  isMUITheme: false,
  isDarkMode: false,
  toggleDarkMode: () => {
    throw new Error('toggleDarkMode must be used within ThemeProvider');
  },
});

const DARK_MODE_STORAGE_KEY = 'kubeflow-dark-mode';

export const ThemeProvider: FC<{ theme?: Theme; children: ReactNode }> = ({
  theme = Theme.Patternfly,
  children,
}) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(DARK_MODE_STORAGE_KEY);
    return saved === 'true';
  });

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const newVal = !prev;
      localStorage.setItem(DARK_MODE_STORAGE_KEY, String(newVal));
      return newVal;
    });
  }, []);

  const muiTheme = useMemo(
    () =>
      createTheme({
        cssVariables: true,
        palette: {
          mode: isDarkMode ? 'dark' : 'light',
        },
      }),
    [isDarkMode],
  );

  useEffect(() => {
    const html = document.documentElement;

    if (theme === Theme.MUI) {
      html.classList.add(Theme.MUI);
    } else {
      html.classList.remove(Theme.MUI);
    }

    if (isDarkMode) {
      html.classList.add('pf-v6-theme-dark');
    } else {
      html.classList.remove('pf-v6-theme-dark');
    }
  }, [theme, isDarkMode]);

  const value = useMemo(
    () => ({
      isMUITheme: theme === Theme.MUI,
      isDarkMode,
      toggleDarkMode,
    }),
    [theme, isDarkMode, toggleDarkMode],
  );

  return (
    <ThemeContext.Provider value={value}>
      {theme === Theme.MUI ? (
        <MUIThemeProvider theme={muiTheme}>{children}</MUIThemeProvider>
      ) : (
        children
      )}
    </ThemeContext.Provider>
  );
};
