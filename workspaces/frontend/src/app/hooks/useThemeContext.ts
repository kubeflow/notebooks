import * as React from 'react';
import { ThemeContext } from '~/app/context/ThemeContext';

export const useThemeContext = () => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};
