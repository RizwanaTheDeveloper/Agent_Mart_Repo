import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MODULE_KEYS, ModuleKey } from './src/api/types';
import { Loading } from './src/components/ui';
import { AppShell } from './src/navigation/AppShell';
import { MODULE_BY_KEY } from './src/navigation/modules';
import { useModuleRoute } from './src/navigation/useModuleRoute';
import { RESOURCE_CONFIGS } from './src/resources/configs';
import { ResourceScreen } from './src/resources/ResourceScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { OverviewScreen } from './src/screens/OverviewScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AuthProvider, useAuth } from './src/state/auth';
import { ElevationProvider } from './src/state/elevation';
import { ToastProvider } from './src/state/toast';
import { ThemeContext, useSystemTheme } from './src/theme/theme';
import { APP_NAME } from './src/config';

export default function App() {
  const theme = useSystemTheme();
  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={theme}>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        <View style={{ flex: 1, backgroundColor: theme.c.bg }}>
          <ToastProvider>
            <AuthProvider>
              <ElevationProvider>
                <Root />
              </ElevationProvider>
            </AuthProvider>
          </ToastProvider>
        </View>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { status } = useAuth();
  if (status === 'loading') return <Loading label="Checking your session…" />;
  if (status === 'signedOut') return <LoginScreen />;
  return <Console />;
}

function Console() {
  const { can } = useAuth();
  const allowed = useMemo(() => MODULE_KEYS.filter((k) => can(k)), [can]);
  const [current, navigate] = useModuleRoute(allowed);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.title = `${MODULE_BY_KEY[current].label} · ${APP_NAME} Admin`;
  }, [current]);

  return (
    <AppShell current={current} onNavigate={navigate}>
      <Screen key={current} module={current} onNavigate={navigate} />
    </AppShell>
  );
}

function Screen({ module, onNavigate }: { module: ModuleKey; onNavigate: (k: ModuleKey) => void }) {
  switch (module) {
    case 'overview':
      return <OverviewScreen onNavigate={onNavigate} />;
    case 'reports':
      return <ReportsScreen />;
    case 'settings':
      return <SettingsScreen />;
    default: {
      const config = RESOURCE_CONFIGS[module];
      return config ? <ResourceScreen config={config} /> : null;
    }
  }
}
