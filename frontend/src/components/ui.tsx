import { Ionicons } from '@expo/vector-icons';
import React, { forwardRef, ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputInstance,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { font, radius, spacing, useLayout, useTheme } from '../theme/theme';

export type IconName = keyof typeof Ionicons.glyphMap;
export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

/* ---------- Text ---------- */

type TextVariant = 'title' | 'heading' | 'subheading' | 'body' | 'label' | 'caption' | 'mono';
export function T({
  variant = 'body',
  muted,
  faint,
  color,
  style,
  children,
  numberOfLines,
  selectable,
}: {
  variant?: TextVariant;
  muted?: boolean;
  faint?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  const { c } = useTheme();
  const v = textVariants[variant];
  return (
    <Text
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={[
        { color: color ?? (faint ? c.textFaint : muted ? c.textMuted : c.text), fontFamily: variant === 'mono' ? font.mono : font.family },
        v,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
const textVariants: Record<TextVariant, TextStyle> = {
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '600' },
  subheading: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16 },
  mono: { fontSize: 12.5 },
};

/* ---------- Button ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  small,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const isDisabled = disabled || loading;
  const palette = {
    primary: { bg: c.primary, pressed: c.primaryPressed, fg: c.primaryText, border: c.primary },
    danger: { bg: c.danger, pressed: c.danger, fg: '#ffffff', border: c.danger },
    secondary: { bg: c.surface, pressed: c.surfaceAlt, fg: c.text, border: c.borderStrong },
    ghost: { bg: 'transparent', pressed: c.surfaceAlt, fg: c.primary, border: 'transparent' },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: pressed ? palette.pressed : palette.bg, borderColor: palette.border, opacity: isDisabled ? 0.55 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : icon ? (
        <Ionicons name={icon} size={small ? 15 : 17} color={palette.fg} />
      ) : null}
      <Text style={{ color: palette.fg, fontWeight: '600', fontSize: small ? 13 : 14, fontFamily: font.family }} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color,
  size = 20,
  style,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: pressed ? c.surfaceAlt : 'transparent' }, style]}
    >
      <Ionicons name={icon} size={size} color={color ?? c.textMuted} />
    </Pressable>
  );
}

/* ---------- Inputs ---------- */

export const Field = forwardRef<
  TextInputInstance,
  TextInputProps & { label?: string; hint?: string; error?: string | null; icon?: IconName; containerStyle?: StyleProp<ViewStyle> }
>(function Field({ label, hint, error, icon, containerStyle, style, multiline, secureTextEntry, ...rest }, ref) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? <T variant="label">{label}</T> : null}
      <View
        style={[
          styles.inputWrap,
          {
            borderColor: error ? c.danger : focused ? c.focus : c.borderStrong,
            backgroundColor: c.surface,
            minHeight: multiline ? 96 : 44,
            alignItems: multiline ? 'flex-start' : 'center',
          },
        ]}
      >
        {icon ? <Ionicons name={icon} size={17} color={c.textFaint} style={{ marginTop: multiline ? 12 : 0 }} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={c.textFaint}
          multiline={multiline}
          secureTextEntry={secureTextEntry && !reveal}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            styles.input,
            { color: c.text, fontFamily: font.family, textAlignVertical: multiline ? 'top' : 'center', paddingTop: multiline ? 11 : 0 },
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
            style,
          ]}
          {...rest}
        />
        {secureTextEntry ? (
          <IconButton icon={reveal ? 'eye-off-outline' : 'eye-outline'} label={reveal ? 'Hide' : 'Show'} size={18} onPress={() => setReveal((r) => !r)} />
        ) : null}
      </View>
      {error ? (
        <T variant="caption" color={c.danger}>
          {error}
        </T>
      ) : hint ? (
        <T variant="caption" faint>
          {hint}
        </T>
      ) : null}
    </View>
  );
});

export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="subheading">{label}</T>
        {description ? (
          <T variant="caption" muted>
            {description}
          </T>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ true: c.primary, false: c.borderStrong }}
        thumbColor={Platform.OS === 'android' ? (value ? '#ffffff' : '#f1f1f1') : undefined}
        {...(Platform.OS === 'web' ? ({ activeThumbColor: '#ffffff' } as object) : {})}
      />
    </View>
  );
}

/** Wrapping chip group used for selects (roles, statuses, audiences, time ranges). */
export function Choice<V extends string | number>({
  options,
  value,
  onChange,
  label,
  disabled,
}: {
  options: { value: V; label: string }[];
  value: V | null | undefined;
  onChange: (v: V) => void;
  label?: string;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <T variant="label">{label}</T> : null}
      <View style={styles.choiceRow} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              style={({ pressed }) => [
                styles.choice,
                {
                  borderColor: selected ? c.primary : c.borderStrong,
                  backgroundColor: selected ? c.primarySoft : pressed ? c.surfaceAlt : c.surface,
                  opacity: disabled ? 0.55 : 1,
                },
              ]}
            >
              <Text style={{ color: selected ? c.primary : c.text, fontWeight: selected ? '600' : '500', fontSize: 13, fontFamily: font.family }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ---------- Display ---------- */

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { c } = useTheme();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, padded && { padding: spacing.lg }, style]}>{children}</View>;
}

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const { c } = useTheme();
  const map: Record<Tone, [string, string]> = {
    neutral: [c.surfaceAlt, c.textMuted],
    primary: [c.primarySoft, c.primary],
    success: [c.successSoft, c.success],
    warning: [c.warningSoft, c.warning],
    danger: [c.dangerSoft, c.danger],
    info: [c.infoSoft, c.info],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: tone === 'neutral' ? c.border : 'transparent' }]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 11.5, fontWeight: '600', fontFamily: font.family }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }, style]} />;
}

export function KeyValue({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <View style={styles.kv}>
      <T variant="caption" muted style={styles.kvLabel}>
        {label}
      </T>
      <View style={{ flex: 1, minWidth: 160 }}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <T variant={mono ? 'mono' : 'body'} selectable>
            {value}
          </T>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

export function Banner({ tone = 'info', icon, title, children }: { tone?: Tone; icon?: IconName; title?: string; children?: ReactNode }) {
  const { c } = useTheme();
  const map: Record<Tone, [string, string]> = {
    neutral: [c.surfaceAlt, c.textMuted],
    primary: [c.primarySoft, c.primary],
    success: [c.successSoft, c.success],
    warning: [c.warningSoft, c.warning],
    danger: [c.dangerSoft, c.danger],
    info: [c.infoSoft, c.info],
  };
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.banner, { backgroundColor: bg }]} accessibilityRole={tone === 'danger' ? 'alert' : undefined}>
      <Ionicons name={icon ?? (tone === 'danger' ? 'alert-circle' : tone === 'success' ? 'checkmark-circle' : tone === 'warning' ? 'warning' : 'information-circle')} size={18} color={fg} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? (
          <T variant="label" color={fg}>
            {title}
          </T>
        ) : null}
        {typeof children === 'string' ? <T variant="caption">{children}</T> : children}
      </View>
    </View>
  );
}

/* ---------- States ---------- */

export function Loading({ label = 'Loading…', style }: { label?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[styles.center, style]} accessibilityLabel={label}>
      <ActivityIndicator color={c.primary} />
      <T variant="caption" muted>
        {label}
      </T>
    </View>
  );
}

export function ErrorState({ message, onRetry, style }: { message: string; onRetry?: () => void; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[styles.center, style]}>
      <Ionicons name="cloud-offline-outline" size={30} color={c.textFaint} />
      <T muted style={{ textAlign: 'center', maxWidth: 420 }}>
        {message}
      </T>
      {onRetry ? <Button title="Try again" icon="refresh" variant="secondary" small onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ icon = 'file-tray-outline', title, message, style }: { icon?: IconName; title: string; message?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[styles.center, style]}>
      <Ionicons name={icon} size={30} color={c.textFaint} />
      <T variant="subheading">{title}</T>
      {message ? (
        <T variant="caption" muted style={{ textAlign: 'center', maxWidth: 360 }}>
          {message}
        </T>
      ) : null}
    </View>
  );
}

/* ---------- Dialog ---------- */

/**
 * Responsive modal: centred dialog on tablets/desktop, full-height sheet on phones.
 */
export function Dialog({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 520,
  dismissable = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  dismissable?: boolean;
}) {
  const { c } = useTheme();
  const { isPhone, height } = useLayout();
  return (
    <Modal visible={visible} transparent animationType={isPhone ? 'slide' : 'fade'} onRequestClose={dismissable ? onClose : () => undefined} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.overlay, { backgroundColor: c.overlay }, isPhone && { justifyContent: 'flex-end', padding: 0 }]}>
        {dismissable ? <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close dialog" /> : null}
        <SafeAreaView
          edges={isPhone ? ['bottom'] : []}
          style={[
            styles.dialog,
            { backgroundColor: c.surface, borderColor: c.border },
            isPhone ? { width: '100%', maxHeight: height * 0.94, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : { width, maxWidth: '100%', maxHeight: height * 0.9 },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.dialogHeader}>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="heading">{title}</T>
              {subtitle ? (
                <T variant="caption" muted>
                  {subtitle}
                </T>
              ) : null}
            </View>
            {dismissable ? <IconButton icon="close" label="Close" onPress={onClose} /> : null}
          </View>
          <Divider />
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? (
            <>
              <Divider />
              <View style={styles.dialogFooter}>{footer}</View>
            </>
          ) : null}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonSmall: { minHeight: 34, paddingHorizontal: 12, borderRadius: radius.sm },
  iconButton: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, gap: 8 },
  input: { flex: 1, fontSize: 15, minHeight: 42, paddingVertical: 0 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { paddingHorizontal: 12, minHeight: 34, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1 },
  card: { borderWidth: 1, borderRadius: radius.lg },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  kv: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: 6 },
  kvLabel: { width: 150, paddingTop: 2 },
  banner: { flexDirection: 'row', gap: 10, padding: spacing.md, borderRadius: radius.md, alignItems: 'flex-start' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, minHeight: 200 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  dialog: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  dialogHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  dialogFooter: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.md },
});
