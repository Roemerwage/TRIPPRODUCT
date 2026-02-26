import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { Theme } from '@/constants/colors';

const STORAGE_KEY_THEME = '@theme_mode';

export type ThemeMode = 'system' | 'light' | 'dark';

export const [ThemeProvider, useThemeMode] = createContextHook(() => {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_THEME).then(saved => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setMode(saved);
      }
    });
  }, []);

  const setThemeMode = async (value: ThemeMode) => {
    setMode(value);
    await AsyncStorage.setItem(STORAGE_KEY_THEME, value);
  };

  const resolvedMode = mode === 'system' ? systemScheme || 'light' : mode;
  const colors = useMemo(() => Theme[resolvedMode] || Theme.light, [resolvedMode]);

  return {
    mode,
    setThemeMode,
    resolvedMode,
    colors,
  };
});
