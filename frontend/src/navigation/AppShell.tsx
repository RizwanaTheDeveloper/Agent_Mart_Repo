import { Ionicons } from '@expo/vector-icons';
import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ModuleKey } from '../api/types';
import { Badge, Button, Dialog, IconButton, T } from '../components/ui';
import { APP_NAME, APP_SUBTITLE } from '../config';
import { useAuth } from '../state/auth';
import { radius, spacing, useLayout, useTheme } from '../theme/theme';
import { formatDateTime } from '../utils/format';
import { GROUPS, MODULE_BY_KEY, MODULES, ROLE_LABELS } from './modules';

type Props = { current: ModuleKey; onNavigate: (key: ModuleKey) => void; children: ReactNode };

export function AppShell({ current, onNavigate, children }: Props) {
  const { c } = useTheme();
  const { hasSidebar } = useLayout();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const meta = MODULE_BY_KEY[current];

  useEffect(() => {
    if (hasSidebar) setDrawerOpen(false);
  }, [hasSidebar]);

  const go = (key: ModuleKey) => {
    onNavigate(key);
    setDrawerOpen(false);
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      {hasSidebar ? <Sidebar current={current} onNavigate={go} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <TopBar title={meta.label} description={meta.description} onMenu={hasSidebar ? undefined : () => setDrawerOpen(true)} />
        <View style={{ flex: 1 }}>{children}</View>
      </View>
      {!hasSidebar ? <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} current={current} onNavigate={go} /> : null}
    </View>
  );
}

function TopBar({ title, description, onMenu }: { title: string; description: string; onMenu?: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { isPhone, gutter } = useLayout();
  const { user } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  return (
    <View style={[styles.topBar, { paddingTop: insets.top + 10, paddingHorizontal: gutter, backgroundColor: c.surface, borderBottomColor: c.border }]}>
      {onMenu ? <IconButton icon="menu" label="Open navigation" onPress={onMenu} color={c.text} size={22} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T variant={isPhone ? 'heading' : 'title'} numberOfLines={1} style={isPhone ? undefined : { fontSize: 20 }}>
          {title}
        </T>
        {!isPhone ? (
          <T variant="caption" muted numberOfLines={1}>
            {description}
          </T>
        ) : null}
      </View>
      {user ? (
        <Pressable
          onPress={() => setAccountOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Account and session"
          style={({ pressed }) => [styles.userChip, { borderColor: c.border, backgroundColor: pressed ? c.surfaceAlt : c.surface }]}
        >
          <Avatar name={user.name} />
          {!isPhone ? (
            <View style={{ maxWidth: 180 }}>
              <T variant="label" numberOfLines={1}>
                {user.name}
              </T>
              <T variant="caption" muted numberOfLines={1}>
                {ROLE_LABELS[user.role]}
              </T>
            </View>
          ) : null}
          <Ionicons name="chevron-down" size={14} color={c.textFaint} />
        </Pressable>
      ) : null}
      <AccountDialog visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </View>
  );
}

function AccountDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, expiresAt, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title={user.name}
      subtitle={user.email}
      width={400}
      footer={
        <>
          <Button title="Close" variant="secondary" onPress={onClose} />
          <Button
            title="Sign out"
            icon="log-out-outline"
            variant="danger"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              await signOut();
              setBusy(false);
              onClose();
            }}
          />
        </>
      }
    >
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <T variant="caption" muted>
            Role
          </T>
          <Badge label={ROLE_LABELS[user.role]} tone="primary" icon="shield-half-outline" />
        </View>
        <T variant="caption" muted>
          Session expires {formatDateTime(expiresAt)}. Sessions last a maximum of 2 hours, after which you will need to sign in again.
        </T>
      </View>
    </Dialog>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const { c } = useTheme();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <T variant="label" color={c.primary} style={{ fontSize: size * 0.4 }}>
        {initials || '?'}
      </T>
    </View>
  );
}

function NavList({ current, onNavigate }: { current: ModuleKey; onNavigate: (k: ModuleKey) => void }) {
  const { c } = useTheme();
  const { can } = useAuth();
  return (
    <ScrollView contentContainerStyle={{ paddingVertical: spacing.sm, gap: spacing.md }}>
      {GROUPS.map((group) => {
        const items = MODULES.filter((m) => m.group === group && can(m.key));
        if (!items.length) return null;
        return (
          <View key={group} style={{ gap: 2 }}>
            <T variant="caption" color={c.sidebarMuted} style={styles.groupLabel}>
              {group.toUpperCase()}
            </T>
            {items.map((m) => {
              const active = m.key === current;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => onNavigate(m.key)}
                  accessibilityRole="link"
                  accessibilityLabel={m.label}
                  accessibilityState={{ selected: active }}
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                    styles.navItem,
                    { backgroundColor: active ? c.sidebarActive : pressed || hovered ? 'rgba(255,255,255,0.04)' : 'transparent' },
                  ]}
                >
                  {active ? <View style={[styles.navIndicator, { backgroundColor: c.primary }]} /> : null}
                  <Ionicons name={m.icon} size={18} color={active ? '#ffffff' : c.sidebarMuted} />
                  <T variant="body" color={active ? '#ffffff' : c.sidebarText} style={{ fontWeight: active ? '600' : '400' }}>
                    {m.label}
                  </T>
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

function Brand() {
  const { c } = useTheme();
  return (
    <View style={styles.brand}>
      <View style={[styles.logo, { backgroundColor: c.primary }]}>
        <Ionicons name="business" size={17} color="#fff" />
      </View>
      <View>
        <T variant="subheading" color="#ffffff">
          {APP_NAME}
        </T>
        <T variant="caption" color={c.sidebarMuted}>
          {APP_SUBTITLE}
        </T>
      </View>
    </View>
  );
}

function Sidebar({ current, onNavigate }: { current: ModuleKey; onNavigate: (k: ModuleKey) => void }) {
  const { c } = useTheme();
  return (
    <SafeAreaView edges={['top', 'bottom', 'left']} style={[styles.sidebar, { backgroundColor: c.sidebar }]}>
      <Brand />
      <NavList current={current} onNavigate={onNavigate} />
    </SafeAreaView>
  );
}

function Drawer({ open, onClose, current, onNavigate }: { open: boolean; onClose: () => void } & Pick<Props, 'current' | 'onNavigate'>) {
  const { c } = useTheme();
  const slide = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(slide, { toValue: open ? 1 : 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, slide]);

  useEffect(() => {
    if (!open || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay, opacity: slide }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close navigation" />
      </Animated.View>
      <Animated.View
        style={[
          styles.drawer,
          { backgroundColor: c.sidebar, transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [-300, 0] }) }] },
        ]}
      >
        <SafeAreaView edges={['top', 'bottom', 'left']} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Brand />
            </View>
            <IconButton icon="close" label="Close navigation" onPress={onClose} color={c.sidebarText} style={{ marginRight: spacing.sm }} />
          </View>
          <NavList current={current} onNavigate={onNavigate} />
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  userChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.pill, paddingVertical: 4, paddingLeft: 4, paddingRight: 10 },
  sidebar: { width: 248, paddingHorizontal: spacing.md },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 280, maxWidth: '86%', paddingHorizontal: spacing.md },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.sm, paddingVertical: spacing.lg },
  logo: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  groupLabel: { paddingHorizontal: spacing.md, paddingVertical: 6, letterSpacing: 0.6, fontSize: 11 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.md, minHeight: 40, borderRadius: radius.sm, overflow: 'hidden' },
  navIndicator: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },
});
