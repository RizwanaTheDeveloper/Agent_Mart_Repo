import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { errorMessage } from '../api/client';
import { api } from '../api/endpoints';
import type { Firm, Plan } from '../api/types';
import { REASON_ERROR, ReasonField, reasonValid } from '../components/ReasonField';
import { Badge, Banner, Button, Choice, Dialog, Divider, Loading, T } from '../components/ui';
import { useToast } from '../state/toast';
import { spacing } from '../theme/theme';
import { formatINR } from '../utils/format';
import type { DetailExtraProps } from './types';

/** Firms detail section: current subscription plan + manual plan assignment. */
export function FirmPlan({ item, canWrite, onChange }: DetailExtraProps<Firm>) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: spacing.sm }}>
      <Divider />
      <T variant="label" muted>
        Subscription
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
        {item.plan ? <Badge label={item.plan.name} tone="primary" icon="pricetag-outline" /> : <Badge label="No plan assigned" />}
        {canWrite ? <Button title={item.plan ? 'Change plan' : 'Assign plan'} icon="swap-horizontal" small variant="secondary" onPress={() => setOpen(true)} /> : null}
      </View>
      {open ? (
        <AssignPlanDialog
          firm={item}
          onClose={() => setOpen(false)}
          onAssigned={(plan) => {
            setOpen(false);
            onChange({ ...item, plan });
          }}
        />
      ) : null}
    </View>
  );
}

function AssignPlanDialog({ firm, onClose, onAssigned }: { firm: Firm; onClose: () => void; onAssigned: (p: { id: string; name: string }) => void }) {
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [planId, setPlanId] = useState<string | null>(firm.plan?.id ?? null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .list<Plan>('plans', { limit: 100 })
      .then((p) => setPlans(p.items.filter((x) => x.active)))
      .catch((e) => setError(errorMessage(e)));
  }, []);

  const submit = async () => {
    if (!planId) return setError('Choose a plan.');
    if (planId === firm.plan?.id) return setError('The firm is already on this plan.');
    if (!reasonValid(reason)) return setError(REASON_ERROR);
    setBusy(true);
    setError(null);
    try {
      const sub = await api.assignPlan(firm.id, planId, reason.trim());
      toast.success(`${firm.name} moved to ${sub.plan_name}`);
      onAssigned({ id: sub.plan_id, name: sub.plan_name });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      visible
      onClose={busy ? () => undefined : onClose}
      title="Assign plan"
      subtitle={firm.name}
      width={500}
      footer={
        <>
          <Button title="Cancel" variant="secondary" onPress={onClose} disabled={busy} />
          <Button title="Assign plan" icon="checkmark" onPress={submit} loading={busy} disabled={!plans} />
        </>
      }
    >
      <Banner tone="warning" title="Sensitive action">
        Replaces the firm's current subscription immediately. You may be asked to confirm your identity.
      </Banner>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {!plans ? (
        error ? null : <Loading label="Loading plans…" style={{ minHeight: 100 }} />
      ) : plans.length === 0 ? (
        <T muted>There are no active plans. Create one in Plans first.</T>
      ) : (
        <Choice
          label="Plan"
          options={plans.map((p) => ({ value: p.id, label: `${p.name} · ${formatINR(p.price_inr)}/mo` }))}
          value={planId}
          onChange={setPlanId}
        />
      )}
      <ReasonField value={reason} onChange={setReason} />
    </Dialog>
  );
}
