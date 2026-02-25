import { useContext } from 'react';
import { ThemeContext, ThemeContextProps } from '~/app/context/ThemeContext';

export const useThemeContext = (): ThemeContextProps => useContext(ThemeContext);
