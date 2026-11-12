import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { errorMessage } from '../api/client';
import { api } from '../api/endpoints';
import { ADMIN_ROLES, AdminRole, Admin, Announcement, Audience, AUDIENCES, Plan } from '../api/types';
import { REASON_ERROR, ReasonField, reasonValid } from '../components/ReasonField';
import { Banner, Button, Choice, Dialog, Field, SwitchRow } from '../components/ui';
import { ROLE_LABELS } from '../navigation/modules';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import type { FormProps } from './types';

function FormDialog({
  visible,
  title,
  subtitle,
  onClose,
  onSubmit,
  busy,
  error,
  submitLabel,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
  submitLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog
      visible={visible}
      onClose={busy ? () => undefined : onClose}
      title={title}
      subtitle={subtitle}
      width={560}
      footer={
        <>
          <Button title="Cancel" variant="secondary" onPress={onClose} disabled={busy} />
          <Button title={submitLabel} icon="save-outline" onPress={onSubmit} loading={busy} />
        </>
      }
    >
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {children}
    </Dialog>
  );
}

const toInt = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN);
const Row = ({ children }: { children: React.ReactNode }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{children}</View>;
const half = { flex: 1, minWidth: 180 } as const;

/* ---------- Plans ---------- */

export function PlanForm({ visible, item, onClose, onSaved }: FormProps<Plan>) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [maxStaff, setMaxStaff] = useState('');
  const [maxListings, setMaxListings] = useState('');
  const [price, setPrice] = useState('');
  const [active, setActive] = useState(true);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(item?.name ?? '');
    setMaxStaff(item ? String(item.max_staff) : '');
    setMaxListings(item ? String(item.max_listings) : '');
    setPrice(item ? String(Math.round(Number(item.price_inr))) : '');
    setActive(item?.active ?? true);
    setReason('');
    setError(null);
  }, [visible, item]);

  const submit = async () => {
    const staff = toInt(maxStaff);
    const listings = toInt(maxListings);
    const priceInr = toInt(price);
    if (name.trim().length < 2) return setError('Plan name must be at least 2 characters.');
    if (Number.isNaN(staff) || staff > 100_000) return setError('Staff seats must be a whole number between 0 and 100,000.');
    if (Number.isNaN(listings) || listings > 1_000_000) return setError('Listing limit must be a whole number between 0 and 1,000,000.');
    if (Number.isNaN(priceInr) || priceInr > 100_000_000) return setError('Monthly price must be a whole number of rupees.');
    if (!reasonValid(reason)) return setError(REASON_ERROR);
    setBusy(true);
    setError(null);
    try {
      const saved = await api.savePlan({
        ...(item ? { id: item.id } : {}),
        name: name.trim(),
        max_staff: staff,
        max_listings: listings,
        price_inr: priceInr,
        active,
        reason: reason.trim(),
      });
      toast.success(item ? 'Plan updated' : 'Plan created');
      onSaved(saved);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog visible={visible} title={item ? 'Edit plan' : 'New plan'} subtitle="Changes apply to firms on this plan" onClose={onClose} onSubmit={submit} busy={busy} error={error} submitLabel={item ? 'Save changes' : 'Create plan'}>
      <Field label="Plan name" value={name} onChangeText={setName} maxLength={100} placeholder="e.g. Professional" />
      <Row>
        <Field label="Staff seats" value={maxStaff} onChangeText={setMaxStaff} keyboardType="number-pad" containerStyle={half} />
        <Field label="Listing limit" value={maxListings} onChangeText={setMaxListings} keyboardType="number-pad" containerStyle={half} />
      </Row>
      <Field label="Monthly price (₹)" value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="0 for free" />
      <SwitchRow label="Active" description="Inactive plans cannot be assigned to firms." value={active} onValueChange={setActive} />
      <ReasonField value={reason} onChange={setReason} />
    </FormDialog>
  );
}

/* ---------- Announcements ---------- */

const AUDIENCE_LABELS: Record<Audience, string> = { all: 'Everyone', buyers: 'Buyers', sellers: 'Sellers', firms: 'Firms' };

export function AnnouncementForm({ visible, item, onClose, onSaved }: FormProps<Announcement>) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [active, setActive] = useState(true);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(item?.title ?? '');
    setBody(item?.body ?? '');
    setAudience(item?.audience ?? 'all');
    setActive(item?.active ?? true);
    setReason('');
    setError(null);
  }, [visible, item]);

  const submit = async () => {
    if (title.trim().length < 3) return setError('Title must be at least 3 characters.');
    if (!body.trim()) return setError('Write the announcement text.');
    if (!reasonValid(reason)) return setError(REASON_ERROR);
    setBusy(true);
    setError(null);
    try {
      const saved = await api.saveAnnouncement({
        ...(item ? { id: item.id } : {}),
        title: title.trim(),
        body: body.trim(),
        audience,
        active,
        reason: reason.trim(),
      });
      toast.success(item ? 'Announcement updated' : 'Announcement published');
      onSaved(saved);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog visible={visible} title={item ? 'Edit announcement' : 'New announcement'} onClose={onClose} onSubmit={submit} busy={busy} error={error} submitLabel={item ? 'Save changes' : 'Publish'}>
      <Field label="Title" value={title} onChangeText={setTitle} maxLength={200} />
      <Field label="Message" value={body} onChangeText={setBody} multiline maxLength={5000} />
      <Choice label="Audience" options={AUDIENCES.map((a) => ({ value: a, label: AUDIENCE_LABELS[a] }))} value={audience} onChange={setAudience} />
      <SwitchRow label="Active" description="Only active announcements are shown in the marketplace apps." value={active} onValueChange={setActive} />
      <ReasonField value={reason} onChange={setReason} />
    </FormDialog>
  );
}
export { AUDIENCE_LABELS };

/* ---------- Administrators ---------- */

export function AdminForm({ visible, item, onClose, onSaved }: FormProps<Admin>) {
  const toast = useToast();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('support');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSelf = !!item && item.id === user?.id;

  useEffect(() => {
    if (!visible) return;
    setName(item?.name ?? '');
    setEmail(item?.email ?? '');
    setRole(item?.role ?? 'support');
    setPassword('');
    setReason('');
    setError(null);
  }, [visible, item]);

  const submit = async () => {
    if (name.trim().length < 2) return setError('Name must be at least 2 characters.');
    if (!item && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (!item && password.length < 12) return setError('Initial password must be at least 12 characters.');
    if (!reasonValid(reason)) return setError(REASON_ERROR);
    setBusy(true);
    setError(null);
    try {
      const res = await api.saveAdmin(
        item
          ? { id: item.id, name: name.trim(), role, reason: reason.trim() }
          : { name: name.trim(), email: email.trim().toLowerCase(), role, password, reason: reason.trim() },
      );
      toast.success(item ? 'Administrator updated' : 'Administrator created');
      onSaved(res.admin);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      visible={visible}
      title={item ? 'Edit administrator' : 'New administrator'}
      subtitle={item ? item.email : 'They will sign in with this email and password'}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      error={error}
      submitLabel={item ? 'Save changes' : 'Create administrator'}
    >
      <Field label="Full name" value={name} onChangeText={setName} maxLength={200} />
      {!item ? (
        <>
          <Field label="Work email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
          <Field
            label="Initial password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            hint="At least 12 characters. Share it with the administrator through a secure channel."
          />
        </>
      ) : null}
      <Choice
        label="Role"
        options={ADMIN_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
        value={role}
        onChange={setRole}
        disabled={isSelf}
      />
      {isSelf ? <Banner tone="info">You cannot change your own role.</Banner> : null}
      <ReasonField value={reason} onChange={setReason} />
    </FormDialog>
  );
}
