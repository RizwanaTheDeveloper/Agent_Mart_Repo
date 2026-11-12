import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { errorMessage } from '../api/client';
import { api } from '../api/endpoints';
import { REASON_ERROR, ReasonField, reasonValid } from '../components/ReasonField';
import { Badge, Banner, Button, Card, Dialog, Divider, ErrorState, Loading, SwitchRow, T } from '../components/ui';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import { spacing, useLayout, useTheme } from '../theme/theme';
import { formatDateTime, humanize } from '../utils/format';
import { useAsync } from './useAsync';

type FlagKey = 'publication_enabled' | 'registration_enabled' | 'ai_generation_enabled';
const FLAGS: { key: FlagKey; label: string; description: string }[] = [
  { key: 'publication_enabled', label: 'Listing publication', description: 'Firms can publish new listings to the marketplace.' },
  { key: 'registration_enabled', label: 'New registrations', description: 'Buyers and firms can create new accounts.' },
  { key: 'ai_generation_enabled', label: 'AI summaries', description: 'Generate AI summaries for new and updated listings.' },
];

export function SettingsScreen() {
  const { c } = useTheme();
  const { gutter } = useLayout();
  const { can } = useAuth();
  const toast = useToast();
  const canWrite = can('settings', 'write');
  const { data, setData, error, loading, refreshing, reload, refresh } = useAsync(() => api.settings(), []);
  const [pending, setPending] = useState<{ key: FlagKey; value: boolean } | null>(null);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? 'Unable to load settings.'} onRetry={reload} />;

  const confirm = async () => {
    if (!pending) return;
    if (!reasonValid(reason)) return setFormError(REASON_ERROR);
    setBusy(true);
    setFormError(null);
    try {
      const next = await api.saveSettings({ [pending.key]: pending.value, reason: reason.trim() });
      setData(next);
      toast.success('Setting updated');
      setPending(null);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const flag = pending ? FLAGS.find((f) => f.key === pending.key)! : null;

  return (
    <ScrollView
      contentContainerStyle={{ padding: gutter, gap: spacing.lg, paddingBottom: spacing.xxl, maxWidth: 860, width: '100%', alignSelf: 'center' }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} />}
    >
      <Card style={{ gap: spacing.sm }}>
        <T variant="heading">Platform switches</T>
        <T variant="caption" muted>
          Last changed {formatDateTime(data.settings.updated)}. Every change is recorded in the audit log.
        </T>
        {!canWrite ? <Banner tone="info">Only super administrators can change these settings.</Banner> : null}
        {FLAGS.map((f, i) => (
          <View key={f.key}>
            {i > 0 ? <Divider /> : null}
            <SwitchRow
              label={f.label}
              description={f.description}
              value={data.settings[f.key]}
              disabled={!canWrite}
              onValueChange={(v) => {
                setReason('');
                setFormError(null);
                setPending({ key: f.key, value: v });
              }}
            />
          </View>
        ))}
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <T variant="heading">Service providers</T>
        <T variant="caption" muted>
          Integrations are configured on the server. This shows whether each one has credentials set.
        </T>
        {data.providers.map((p, i) => (
          <View key={p.key}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.provider}>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="subheading">{p.label}</T>
                <T variant="caption" muted>
                  {p.provider ? humanize(p.provider) : 'No provider selected'}
                </T>
              </View>
              <Badge label={p.configured ? 'Configured' : 'Not configured'} tone={p.configured ? 'success' : 'warning'} icon={p.configured ? 'checkmark-circle' : 'alert-circle'} />
            </View>
          </View>
        ))}
      </Card>

      <Dialog
        visible={!!pending}
        onClose={busy ? () => undefined : () => setPending(null)}
        title={`${pending?.value ? 'Turn on' : 'Turn off'} ${flag?.label.toLowerCase() ?? ''}`}
        subtitle={flag?.description}
        width={480}
        footer={
          <>
            <Button title="Cancel" variant="secondary" onPress={() => setPending(null)} disabled={busy} />
            <Button title="Apply change" icon="checkmark" variant={pending?.value ? 'primary' : 'danger'} onPress={confirm} loading={busy} />
          </>
        }
      >
        <Banner tone="warning" title="Affects the whole marketplace">
          This change takes effect immediately for all users. You may be asked to confirm your identity.
        </Banner>
        {formError ? <Banner tone="danger">{formError}</Banner> : null}
        <ReasonField value={reason} onChange={setReason} />
      </Dialog>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  provider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
});
