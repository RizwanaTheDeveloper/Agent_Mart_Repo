import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { errorMessage } from '../api/client';
import { api } from '../api/endpoints';
import type { ImportBatch, ParcelRow } from '../api/types';
import { REASON_ERROR, ReasonField, reasonValid } from '../components/ReasonField';
import { Badge, Banner, Button, Choice, Dialog, Divider, Field, T } from '../components/ui';
import { MAX_IMPORT_BYTES, MAX_IMPORT_FEATURES } from '../config';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import { font, radius, spacing, useTheme } from '../theme/theme';
import { formatBytes, formatNumber } from '../utils/format';
import { extractFeatures, pickJsonFile } from '../utils/files';
import type { DetailExtraProps } from './types';

export const PERMITTED_FIELDS = [
  'plot_code',
  'plot_no',
  'lu_desc',
  'extn_sqyrd',
  'area_sqm',
  'rd_width_m',
  'district',
  'mandal',
  'village',
  'rs_no',
  'zoning',
  'latitude',
  'longitude',
] as const;
const PREVIEW_COLUMNS = ['plot_code', 'plot_no', 'village', 'mandal', 'district', 'area_sqm', 'zoning', 'latitude', 'longitude'] as const;
const PREVIEW_ROWS = 25;

export const importTone = (s: ImportBatch['status']) => (s === 'committed' ? 'success' : s === 'validated' ? 'info' : 'danger');
export const importLabel = (s: ImportBatch['status']) => (s === 'committed' ? 'Committed' : s === 'validated' ? 'Ready to commit' : 'Has errors');

/** Validation results + commit. Used both in the import detail panel and right after preview. */
function ImportResult({ batch, canWrite, onCommitted }: { batch: ImportBatch; canWrite: boolean; onCommitted: (b: ImportBatch) => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errors = batch.errors ?? [];
  const rows = batch.rows ?? [];

  const commit = async () => {
    if (!reasonValid(reason)) return setError(REASON_ERROR);
    setBusy(true);
    setError(null);
    try {
      const res = await api.commitImport(batch.id, reason.trim());
      toast.success(`Committed: ${res.created} new, ${res.updated} updated parcel references`);
      onCommitted({ ...batch, status: 'committed', committed: res.committed });
      setReason('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Badge label={importLabel(batch.status)} tone={importTone(batch.status)} />
        <Badge label={`${formatNumber(batch.valid)} valid`} tone="success" />
        {batch.invalid ? <Badge label={`${formatNumber(batch.invalid)} with errors`} tone="danger" /> : null}
      </View>

      {errors.length ? (
        <View style={{ gap: 6 }}>
          <T variant="label">Errors ({errors.length})</T>
          <ErrorList errors={errors} />
          <T variant="caption" muted>
            Fix these in the source file and upload it again. Imports with errors cannot be committed.
          </T>
        </View>
      ) : null}

      {rows.length ? (
        <View style={{ gap: 6 }}>
          <T variant="label">
            Parcels {rows.length > PREVIEW_ROWS ? `(first ${PREVIEW_ROWS} of ${rows.length})` : `(${rows.length})`}
          </T>
          <RowsTable rows={rows.slice(0, PREVIEW_ROWS)} />
        </View>
      ) : null}

      {batch.status === 'validated' && canWrite ? (
        <View style={{ gap: spacing.md }}>
          <Divider />
          <Banner tone="info" title="Commit creates parcel references only">
            Committing adds or updates reference records keyed by plot code. It never creates marketplace listings.
          </Banner>
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <ReasonField value={reason} onChange={setReason} />
          <Button title="Commit import" icon="cloud-done-outline" onPress={commit} loading={busy} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}
    </View>
  );
}

function ErrorList({ errors }: { errors: NonNullable<ImportBatch['errors']> }) {
  const { c } = useTheme();
  return (
    <View style={[styles.box, { borderColor: c.border, backgroundColor: c.dangerSoft }]}>
      {errors.slice(0, 100).map((e, i) => (
        <T key={`${e.index}-${e.field}-${i}`} variant="caption">
          <T variant="caption" style={{ fontWeight: '700' }}>
            Row {e.index + 1}
          </T>{' '}
          · {e.field}: {e.message}
        </T>
      ))}
      {errors.length > 100 ? (
        <T variant="caption" muted>
          …and {errors.length - 100} more
        </T>
      ) : null}
    </View>
  );
}

function RowsTable({ rows }: { rows: ParcelRow[] }) {
  const { c } = useTheme();
  const cell = { width: 110, paddingVertical: 6, paddingHorizontal: 8 } as const;
  return (
    <ScrollView horizontal style={[styles.box, { borderColor: c.border, padding: 0 }]} contentContainerStyle={{ flexDirection: 'column' }}>
      <View style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt }}>
        {PREVIEW_COLUMNS.map((col) => (
          <T key={col} variant="caption" style={[cell, { fontWeight: '700' }]} numberOfLines={1}>
            {col}
          </T>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
          {PREVIEW_COLUMNS.map((col) => (
            <T key={col} variant="caption" style={[cell, { fontFamily: font.mono }]} numberOfLines={1}>
              {r[col] === null || r[col] === undefined ? '—' : String(r[col])}
            </T>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

export function ImportDetail({ item, canWrite, onChange }: DetailExtraProps<ImportBatch>) {
  if (!item.rows && !item.errors) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Divider />
      <ImportResult batch={item} canWrite={canWrite} onCommitted={onChange} />
    </View>
  );
}

type Source = 'file' | 'paste';

export function ImportCreateFlow({ visible, onClose, onCreated, onUpdated }: { visible: boolean; onClose: () => void; onCreated: (b: ImportBatch) => void; onUpdated: (b: ImportBatch) => void }) {
  const { c } = useTheme();
  const { can } = useAuth();
  const [source, setSource] = useState<Source>('file');
  const [filename, setFilename] = useState('');
  const [fileInfo, setFileInfo] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportBatch | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSource('file');
    setFilename('');
    setFileInfo(null);
    setText('');
    setError(null);
    setResult(null);
  }, [visible]);

  const choose = async () => {
    setError(null);
    try {
      const picked = await pickJsonFile();
      if (!picked) return;
      const features = extractFeatures(picked.text);
      setFilename(picked.name);
      setText(picked.text);
      setFileInfo(`${formatBytes(picked.size)} · ${features.length} parcel${features.length === 1 ? '' : 's'}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const validate = async () => {
    setError(null);
    try {
      if (!text.trim()) throw new Error(source === 'file' ? 'Choose a file first.' : 'Paste the JSON first.');
      if (new Blob([text]).size >= MAX_IMPORT_BYTES) throw new Error('The data must be smaller than 750 KB.');
      const features = extractFeatures(text);
      if (features.length < 1 || features.length > MAX_IMPORT_FEATURES)
        throw new Error(`An import must contain between 1 and ${MAX_IMPORT_FEATURES} parcels (found ${features.length}).`);
      setBusy(true);
      const batch = await api.previewImport(filename.trim() || 'pasted.json', features);
      setResult(batch);
      onCreated(batch);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      onClose={busy ? () => undefined : onClose}
      title={result ? 'Validation results' : 'New parcel import'}
      subtitle={result ? result.filename ?? undefined : 'JSON or GeoJSON, under 750 KB, 1–100 parcels'}
      width={720}
      footer={
        result ? (
          <Button title="Close" variant="secondary" onPress={onClose} />
        ) : (
          <>
            <Button title="Cancel" variant="secondary" onPress={onClose} disabled={busy} />
            <Button title="Validate" icon="checkmark-circle-outline" onPress={validate} loading={busy} />
          </>
        )
      }
    >
      {result ? (
        <ImportResult batch={result} canWrite={can('imports', 'write')} onCommitted={(b) => { setResult(b); onUpdated(b); }} />
      ) : (
        <>
          <Choice<Source>
            options={[
              { value: 'file', label: 'Upload file' },
              { value: 'paste', label: 'Paste JSON' },
            ]}
            value={source}
            onChange={(s) => {
              setSource(s);
              setText('');
              setFilename('');
              setFileInfo(null);
            }}
          />
          {error ? <Banner tone="danger">{error}</Banner> : null}
          {source === 'file' ? (
            <View style={[styles.drop, { borderColor: c.borderStrong, backgroundColor: c.surfaceAlt }]}>
              <Button title={filename ? 'Choose a different file' : 'Choose file'} icon="document-attach-outline" variant="secondary" onPress={choose} />
              {filename ? (
                <View style={{ alignItems: 'center' }}>
                  <T variant="subheading">{filename}</T>
                  <T variant="caption" muted>
                    {fileInfo}
                  </T>
                </View>
              ) : (
                <T variant="caption" muted>
                  .json or .geojson
                </T>
              )}
            </View>
          ) : (
            <>
              <Field label="File name (for the audit trail)" value={filename} onChangeText={setFilename} placeholder="e.g. hmda-layout-2026-11.json" autoCapitalize="none" />
              <Field
                label="JSON"
                value={text}
                onChangeText={setText}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                style={{ minHeight: 180, fontFamily: font.mono, fontSize: 12.5 }}
                placeholder='[{ "plot_code": "…", "village": "…" }]'
              />
            </>
          )}
          <T variant="caption" muted>
            Accepted fields: {PERMITTED_FIELDS.join(', ')}. Other fields are ignored. GeoJSON Point coordinates are used when latitude/longitude are not given.
          </T>
        </>
      )}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 4, maxHeight: 320 },
  drop: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, padding: spacing.xl, alignItems: 'center', gap: spacing.md },
});
