import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ApiError, errorMessage } from '../api/client';
import { api } from '../api/endpoints';
import type { AdminRole, CaseStatus, ModuleKey } from '../api/types';
import { Banner, Button, Choice, Dialog, Field, T } from '../components/ui';
import { MIN_REASON_LENGTH } from '../config';
import type { ActionDef, ActionOutcome } from './types';

type Props<T extends { id: string }> = {
  module: ModuleKey;
  item: T | null;
  def: ActionDef<T> | null;
  onClose: () => void;
  onDone: (outcome: ActionOutcome<T>) => void;
  unwrap?: (res: unknown) => ActionOutcome<T>;
};

/** Every mutation asks for an audit reason (≥ 5 chars); the server records it with the change. */
export function ActionDialog<T extends { id: string }>({ module, item, def, onClose, onDone, unwrap }: Props<T>) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<CaseStatus | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!def || !item) return;
    setReason('');
    setNote('');
    setError(null);
    setStatus(def.status ? def.status.initial(item) : null);
    setRole(def.role ? def.role.initial(item) : null);
  }, [def, item]);

  if (!def || !item) return null;

  const reasonOk = reason.trim().length >= MIN_REASON_LENGTH;
  const noteOk = def.note !== 'required' || note.trim().length > 0;

  const submit = async () => {
    if (!reasonOk) return setError(`Give a reason of at least ${MIN_REASON_LENGTH} characters. It is stored in the audit log.`);
    if (!noteOk) return setError(`${def.noteLabel ?? 'Note'} is required.`);
    setBusy(true);
    setError(null);
    try {
      const res = await api.action<unknown>(module, item.id, {
        action: def.action,
        reason: reason.trim(),
        ...(def.note && note.trim() ? { note: note.trim() } : {}),
        ...(def.status && status ? { status } : {}),
        ...(def.role && role ? { role } : {}),
      });
      onDone(unwrap ? unwrap(res) : { item: res as T });
    } catch (e) {
      if (e instanceof ApiError && e.status === 428) setError('Identity confirmation is required for this action.');
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      visible
      onClose={busy ? () => undefined : onClose}
      title={def.label}
      subtitle={def.description}
      width={480}
      footer={
        <>
          <Button title="Cancel" variant="secondary" onPress={onClose} disabled={busy} />
          <Button title={def.label} icon={def.icon} variant={def.variant === 'danger' ? 'danger' : 'primary'} onPress={submit} loading={busy} />
        </>
      }
    >
      {def.sensitive ? (
        <Banner tone="warning" title="Sensitive action">
          You may be asked to confirm your password again.
        </Banner>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {def.status ? <Choice label="New status" options={def.status.options} value={status} onChange={setStatus} /> : null}
      {def.role ? <Choice label="Role" options={def.role.options} value={role} onChange={setRole} /> : null}
      {def.note ? (
        <Field
          label={`${def.noteLabel ?? 'Note'}${def.note === 'required' ? '' : ' (optional)'}`}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={2000}
          placeholder={def.note === 'required' ? 'Visible to the firm / stored on the record' : undefined}
        />
      ) : null}
      <View>
        <Field
          label="Reason for audit log"
          value={reason}
          onChangeText={setReason}
          multiline
          maxLength={500}
          placeholder="Why are you making this change?"
          hint={`At least ${MIN_REASON_LENGTH} characters. Recorded with your name and the time.`}
        />
        <T variant="caption" faint style={{ textAlign: 'right', marginTop: 4 }}>
          {reason.trim().length}/500
        </T>
      </View>
    </Dialog>
  );
}
