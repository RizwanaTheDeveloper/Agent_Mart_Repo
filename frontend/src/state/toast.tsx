import { Ionicons } from '@expo/vector-icons';
import React, { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, radius, spacing, useTheme } from '../theme/theme';

type ToastKind = 'success' | 'error' | 'info';
type ToastItem = { id: number; kind: ToastKind; message: string };
type ToastApi = { show: (message: string, kind?: ToastKind) => void; success: (m: string) => void; error: (m: string) => void };

const ToastContext = createContext<ToastApi>({ show: () => undefined, success: () => undefined, error: () => undefined });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = ++seq.current;
      setItems((all) => [...all.slice(-2), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(() => ({ show, success: (m) => show(m, 'success'), error: (m) => show(m, 'error') }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + spacing.lg }]}>
        {items.map((t) => (
          <ToastView key={t.id} item={t} onDismiss={() => dismiss(t.id)} colors={c} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastView({ item, onDismiss, colors }: { item: ToastItem; onDismiss: () => void; colors: ReturnType<typeof useTheme>['c'] }) {
  const opacity = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  }, [opacity]);
  const icon = item.kind === 'success' ? 'checkmark-circle' : item.kind === 'error' ? 'alert-circle' : 'information-circle';
  const tint = item.kind === 'success' ? '#4cc483' : item.kind === 'error' ? '#ff8a8a' : '#9cc0ff';
  return (
    <Animated.View style={{ opacity, width: '100%', alignItems: 'center' }}>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: '#1b2230', borderColor: colors.borderStrong }]}
      >
        <Ionicons name={icon} size={18} color={tint} />
        <Text style={{ color: '#f2f4f8', flex: 1, fontSize: 14, fontFamily: font.family }}>{item.message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center', gap: spacing.sm, zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    maxWidth: 480,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
