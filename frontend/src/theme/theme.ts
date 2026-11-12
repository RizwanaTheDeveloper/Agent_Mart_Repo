import { createContext, useContext } from 'react';
import { Platform, useColorScheme, useWindowDimensions } from 'react-native';

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryPressed: string;
  primaryText: string;
  primarySoft: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  sidebar: string;
  sidebarText: string;
  sidebarMuted: string;
  sidebarActive: string;
  overlay: string;
  chart: string;
  focus: string;
};

const light: Palette = {
  bg: '#f4f5f7',
  surface: '#ffffff',
  surfaceAlt: '#f8f9fb',
  border: '#e4e6eb',
  borderStrong: '#cfd3db',
  text: '#13161c',
  textMuted: '#525866',
  textFaint: '#8a909c',
  primary: '#1f5fbf',
  primaryPressed: '#184c99',
  primaryText: '#ffffff',
  primarySoft: '#e8f0fc',
  danger: '#c62f2f',
  dangerSoft: '#fdecec',
  success: '#17804a',
  successSoft: '#e6f5ec',
  warning: '#9a6200',
  warningSoft: '#fdf3df',
  info: '#2a5db0',
  infoSoft: '#e8eefa',
  sidebar: '#11161f',
  sidebarText: '#e9ecf2',
  sidebarMuted: '#8d96a8',
  sidebarActive: '#1f2938',
  overlay: 'rgba(10,14,20,0.45)',
  chart: '#2a78d6',
  focus: '#1f5fbf',
};

const dark: Palette = {
  bg: '#0d1015',
  surface: '#161a21',
  surfaceAlt: '#1b2028',
  border: '#272d37',
  borderStrong: '#3a424f',
  text: '#eef0f4',
  textMuted: '#a9b0bd',
  textFaint: '#737b89',
  primary: '#4d8ff0',
  primaryPressed: '#3b7ad8',
  primaryText: '#ffffff',
  primarySoft: '#17263d',
  danger: '#f06a6a',
  dangerSoft: '#3a1b1d',
  success: '#4cc483',
  successSoft: '#132d20',
  warning: '#e5aa3c',
  warningSoft: '#352812',
  info: '#79a7f2',
  infoSoft: '#18243a',
  sidebar: '#0a0d12',
  sidebarText: '#e9ecf2',
  sidebarMuted: '#7c8597',
  sidebarActive: '#1a2230',
  overlay: 'rgba(0,0,0,0.6)',
  chart: '#3987e5',
  focus: '#79a7f2',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;
export const font = {
  family: Platform.select({
    web: 'Inter, "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif',
    default: undefined,
  }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }),
};

export type Theme = { c: Palette; dark: boolean };

export const ThemeContext = createContext<Theme>({ c: light, dark: false });
export const useTheme = () => useContext(ThemeContext);

export function useSystemTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? { c: dark, dark: true } : { c: light, dark: false };
}

/** Layout breakpoints shared by every screen. */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    isPhone: width < 640,
    hasSidebar: width >= 1024,
    hasSidePanel: width >= 1280,
    gutter: width < 640 ? spacing.lg : spacing.xl,
  };
}
