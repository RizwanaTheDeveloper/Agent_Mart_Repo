import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { errorMessage } from '../api/client';
import { api } from '../api/endpoints';
import type { ReportRow } from '../api/types';
import { Button, Card, Choice, ErrorState, Loading, T } from '../components/ui';
import { useToast } from '../state/toast';
import { font, radius, spacing, useLayout, useTheme } from '../theme/theme';
import { formatDay, formatNumber } from '../utils/format';
import { saveTextFile } from '../utils/files';
import { useAsync } from './useAsync';

type Metric = Exclude<keyof ReportRow, 'date'>;
const METRICS: { key: Metric; label: string }[] = [
  { key: 'new_accounts', label: 'New accounts' },
  { key: 'new_listings', label: 'New listings' },
  { key: 'new_interests', label: 'New interests' },
  { key: 'new_cases', label: 'New cases' },
  { key: 'admin_actions', label: 'Admin actions' },
];
const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

export function ReportsScreen() {
  const { c } = useTheme();
  const { gutter, width, hasSidebar } = useLayout();
  const toast = useToast();
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<Metric>('new_accounts');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [exporting, setExporting] = useState(false);
  const { data, error, loading, refreshing, reload, refresh } = useAsync(() => api.reports(days), [days]);

  const totals = useMemo(() => {
    const t = Object.fromEntries(METRICS.map((m) => [m.key, 0])) as Record<Metric, number>;
    data?.rows.forEach((r) => METRICS.forEach((m) => (t[m.key] += r[m.key])));
    return t;
  }, [data]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const csv = await api.reportsCsv(days);
      const stamp = new Date().toISOString().slice(0, 10);
      await saveTextFile(`agentmart-activity-${days}d-${stamp}.csv`, csv, 'text/csv');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const contentWidth = width - (hasSidebar ? 248 : 0) - gutter * 2;
  const tileCols = contentWidth >= 900 ? 5 : contentWidth >= 520 ? 3 : 2;
  const tileWidth = (contentWidth - spacing.sm * (tileCols - 1)) / tileCols;

  return (
    <ScrollView
      contentContainerStyle={{ padding: gutter, gap: spacing.lg, paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} />}
    >
      {/* Filters in one row above the charts */}
      <View style={styles.filters}>
        <Choice options={RANGES} value={days} onChange={setDays} />
        <View style={{ flex: 1 }} />
        <Button title="Export CSV" icon="download-outline" variant="secondary" small onPress={exportCsv} loading={exporting} disabled={!data} />
      </View>

      {loading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState message={error ?? 'Unable to load reports.'} onRetry={reload} />
      ) : (
        <>
          <View style={styles.tiles}>
            {METRICS.map((m) => {
              const active = m.key === metric;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setMetric(m.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.tile, { width: tileWidth, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primarySoft : c.surface }]}
                >
                  <T variant="caption" muted numberOfLines={1}>
                    {m.label}
                  </T>
                  <T style={{ fontSize: 22, fontWeight: '700' }}>{formatNumber(totals[m.key])}</T>
                  <T variant="caption" faint>
                    last {days} days
                  </T>
                </Pressable>
              );
            })}
          </View>

          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }}>
              <View style={{ flex: 1, minWidth: 180 }}>
                <T variant="heading">{METRICS.find((m) => m.key === metric)!.label} per day</T>
                <T variant="caption" muted>
                  {formatDay(data.rows[0]?.date ?? '')} – {formatDay(data.rows[data.rows.length - 1]?.date ?? '')} (UTC)
                </T>
              </View>
              <Choice
                options={[
                  { value: 'chart', label: 'Chart' },
                  { value: 'table', label: 'Table' },
                ]}
                value={view}
                onChange={(v) => setView(v as 'chart' | 'table')}
              />
            </View>
            {view === 'chart' ? <ColumnChart rows={data.rows} metric={metric} /> : <ReportTable rows={data.rows} />}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const CHART_HEIGHT = 200;

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** Single-series column chart: thin columns, 2px gaps, rounded data-ends, hover/press tooltip. */
function ColumnChart({ rows, metric }: { rows: ReportRow[]; metric: Metric }) {
  const { c } = useTheme();
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...rows.map((r) => r[metric])));
  const ticks = [max, max / 2, 0];
  const labelEvery = Math.ceil(rows.length / 6);
  const sel = active !== null ? rows[active] : null;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ height: 22, justifyContent: 'center' }}>
        {sel ? (
          <T variant="caption">
            <T variant="caption" style={{ fontWeight: '700' }}>
              {formatNumber(sel[metric])}
            </T>{' '}
            on {formatDay(sel.date)}
          </T>
        ) : (
          <T variant="caption" faint>
            Hover or tap a column for the exact value
          </T>
        )}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ height: CHART_HEIGHT, justifyContent: 'space-between', paddingRight: 8 }}>
          {ticks.map((t) => (
            <T key={t} variant="caption" faint style={{ fontVariant: ['tabular-nums'], textAlign: 'right', minWidth: 24, marginVertical: -7 }}>
              {formatNumber(t)}
            </T>
          ))}
        </View>
        <View style={{ flex: 1, height: CHART_HEIGHT }}>
          {ticks.map((t, i) => (
            <View key={t} style={[styles.gridLine, { top: (i / (ticks.length - 1)) * CHART_HEIGHT, backgroundColor: c.border }]} />
          ))}
          <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', alignItems: 'flex-end', gap: 2 }]}>
            {rows.map((r, i) => {
              const v = r[metric];
              const h = max ? (v / max) * CHART_HEIGHT : 0;
              return (
                <Pressable
                  key={r.date}
                  onPress={() => setActive(i === active ? null : i)}
                  onHoverIn={() => setActive(i)}
                  onHoverOut={() => setActive((a) => (a === i ? null : a))}
                  accessibilityLabel={`${formatDay(r.date)}: ${v}`}
                  style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
                >
                  {v > 0 ? (
                    <View
                      style={{
                        height: Math.max(h, 2),
                        backgroundColor: c.chart,
                        borderTopLeftRadius: 4,
                        borderTopRightRadius: 4,
                        opacity: active === null || active === i ? 1 : 0.45,
                        maxWidth: 28,
                        alignSelf: 'center',
                        width: '100%',
                      }}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginLeft: 32 }}>
        {rows.map((r, i) => (
          <View key={r.date} style={{ flex: 1, alignItems: 'center', overflow: 'visible' }}>
            {i % labelEvery === 0 ? (
              <T variant="caption" faint numberOfLines={1} style={{ width: 60, textAlign: 'center' }}>
                {formatDay(r.date)}
              </T>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function ReportTable({ rows }: { rows: ReportRow[] }) {
  const { c } = useTheme();
  const cell = { width: 112, paddingVertical: 8, paddingHorizontal: 10 } as const;
  return (
    <ScrollView horizontal style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.md }}>
      <View>
        <View style={{ flexDirection: 'row', backgroundColor: c.surfaceAlt }}>
          <T variant="caption" style={[cell, { fontWeight: '700' }]}>
            Date
          </T>
          {METRICS.map((m) => (
            <T key={m.key} variant="caption" style={[cell, { fontWeight: '700', textAlign: 'right' }]}>
              {m.label}
            </T>
          ))}
        </View>
        {rows
          .slice()
          .reverse()
          .map((r) => (
            <View key={r.date} style={{ flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }}>
              <T variant="caption" style={cell}>
                {formatDay(r.date)}
              </T>
              {METRICS.map((m) => (
                <T key={m.key} variant="caption" style={[cell, { textAlign: 'right', fontFamily: font.mono }]}>
                  {formatNumber(r[m.key])}
                </T>
              ))}
            </View>
          ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
});
