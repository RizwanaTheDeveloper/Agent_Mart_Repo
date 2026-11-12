import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { errorMessage, registerApiHandlers } from '../api/client';
import { api } from '../api/endpoints';
import { Banner, Button, Dialog, Field, T } from '../components/ui';
import { useAuth } from './auth';

/**
 * Handles HTTP 428 (ELEVATION_REQUIRED) for the whole app.
 * The API client pauses the original request, this modal asks for the password,
 * calls POST /auth/elevate and resolves; the client then retries the original request unchanged.
 */
export function ElevationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    registerApiHandlers({
      requestElevation: () =>
        new Promise<boolean>((resolve) => {
          resolver.current = resolve;
          setPassword('');
          setError(null);
          setVisible(true);
        }),
    });
  }, []);

  const finish = useCallback((ok: boolean) => {
    setVisible(false);
    setPassword('');
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  const submit = async () => {
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.auth.elevate(password);
      finish(true);
    } catch (e) {
      setError(errorMessage(e));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {children}
      {/* Mounted only while needed so it stacks above the dialog that triggered the 428. */}
      {visible ? (
        <Dialog
          visible
          onClose={() => finish(false)}
          title="Confirm it's you"
          subtitle="This is a sensitive action. Re-enter your password to continue."
          width={440}
          footer={
            <>
              <Button title="Cancel" variant="secondary" onPress={() => finish(false)} disabled={busy} />
              <Button title="Confirm and continue" icon="shield-checkmark" onPress={submit} loading={busy} />
            </>
          }
        >
          <View style={{ gap: 14 }}>
            {user ? (
              <T variant="caption" muted>
                Signed in as {user.email}. Confirmation stays valid for 10 minutes.
              </T>
            ) : null}
            {error ? <Banner tone="danger">{error}</Banner> : null}
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={submit}
              autoFocus
            />
          </View>
        </Dialog>
      ) : null}
    </>
  );
}
