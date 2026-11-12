import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorMessage } from '../api/client';
import { Banner, Button, Card, Field, T } from '../components/ui';
import { APP_NAME, APP_SUBTITLE } from '../config';
import { useAuth } from '../state/auth';
import { radius, spacing, useLayout, useTheme } from '../theme/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginScreen() {
  const { c } = useTheme();
  const { isPhone } = useLayout();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid work email address.');
    if (!password) return setError('Enter your password.');
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, { padding: isPhone ? spacing.lg : spacing.xxl }]} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={[styles.logo, { backgroundColor: c.primary }]}>
              <Ionicons name="business" size={22} color="#fff" />
            </View>
            <View>
              <T variant="title">{APP_NAME}</T>
              <T muted>{APP_SUBTITLE}</T>
            </View>
          </View>

          <Card style={styles.card}>
            <View style={{ gap: 4 }}>
              <T variant="heading">Sign in</T>
              <T variant="caption" muted>
                Restricted to authorised platform administrators.
              </T>
            </View>
            {error ? <Banner tone="danger">{error}</Banner> : null}
            <Field
              label="Work email"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="username"
              returnKeyType="next"
              placeholder="name@company.com"
            />
            <Field
              label="Password"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <Button title="Sign in" icon="log-in-outline" onPress={submit} loading={busy} />
          </Card>

          <View style={styles.footer}>
            <Ionicons name="shield-checkmark-outline" size={14} color={c.textFaint} />
            <T variant="caption" faint style={{ textAlign: 'center' }}>
              All activity is recorded in the audit log. Need access? Contact your super administrator.
            </T>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.xl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', maxWidth: 420, gap: spacing.lg, padding: spacing.xl },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 420, paddingHorizontal: spacing.sm },
});
