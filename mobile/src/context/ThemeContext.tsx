import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, styles as lightS, darkStyles, type ThemeMode } from '@/theme';

type Ctx = { mode: ThemeMode; colors: typeof lightColors; styles: typeof lightS; toggle: () => void; setMode: (m: ThemeMode) => void };
const ThemeContext = createContext<Ctx | null>(null);
const KEY = 'edubridge-mobile-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  useEffect(() => { (async () => { try { const v = await AsyncStorage.getItem(KEY); if (v === 'light' || v === 'dark') setMode(v); } catch {} })(); }, []);
  const toggle = () => setMode((m) => { const n = m === 'light' ? 'dark' : 'light'; AsyncStorage.setItem(KEY, n).catch(() => {}); return n; });
  const c = mode === 'dark' ? darkColors : lightColors;
  const s = mode === 'dark' ? darkStyles : lightS;
  return <ThemeContext.Provider value={{ mode, colors: c, styles: s, toggle, setMode }}>{children}</ThemeContext.Provider>;
}
export function useTheme() { const v = useContext(ThemeContext); if (!v) throw new Error('ThemeProvider missing'); return v; }
