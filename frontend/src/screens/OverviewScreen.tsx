import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { api } from '../api/endpoints';
import type { ModuleKey } from '../api/types';
import { Badge, Card, EmptyState, ErrorState, IconName, Loading, T } from '../components/ui';
import { useAuth } from '../state/auth';
import { radius, spacing, useLayout, useTheme } from '../theme/theme';
import { formatNumber, formatRelative, humanize } from '../utils/format';
import { useAsync } from './useAsync';

const KPI_META: Record<string, { icon: IconName; module: ModuleKey; attention?: boolean }> = {
  firms: { icon: 'business-outline', module: 'firms' },
  suspended_firms: { icon: 'ban', module: 'firms', attention: true },
  active_accounts: { icon: 'people-outline', module: 'accounts' },
  listings: { icon: 'home-outline', module: 'listings' },
  listings_pending_review: { icon: 'hourglass-outline', module: 'listings', attention: true },
  open_cases: { icon: 'flag-outline', module: 'cases', attention: true },
  open_interests: { icon: 'chatbubbles-outline', module: 'interests' },
  blocked_summaries: { icon: 'sparkles-outline', module: 'summaries', attention: true },
};

export function OverviewScreen({ onNavigate }: { onNavigate: (k: ModuleKey) => void }) {
  const { c } = useTheme();
  const { width, gutter, hasSidebar } = useLayout();
  const { can, user } = useAuth();
  const { data, error, loading, refreshing, reload, refresh } = useAsync(() => api.overview(), []);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? 'Unable to load the overview.'} onRetry={reload} />;

  const contentWidth = width - (hasSidebar ? 248 : 0) - gutter * 2;
  const cols = contentWidth >= 1000 ? 4 : contentWidth >= 320 ? 2 : 1;
  const tileWidth = (contentWidth - spacing.md * (cols - 1)) / cols;
  const maxStage = Math.max(1, ...data.pipeline.map((p) => p.count));
  const pipelineTotal = data.pipeline.reduce((s, p) => s + p.count, 0);
  const wide = contentWidth >= 900;

  return (
    <ScrollView
      contentContainerStyle={{ padding: gutter, gap: spacing.lg, paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} />}
    >
      <T variant="heading">Welcome back{user ? `, ${user.name.split(' ')[0]}` : ''}</T>

      <View style={styles.grid}>
        {data.kpis.map((k) => {
          const meta = KPI_META[k.key] ?? { icon: 'stats-chart-outline' as IconName, module: 'overview' as ModuleKey };
          const linkable = meta.module !== 'overview' && can(meta.module);
          const flagged = meta.attention && k.value > 0;
          return (
            <Pressable
              key={k.key}
              disabled={!linkable}
              onPress={() => onNavigate(meta.module)}
              accessibilityRole={linkable ? 'link' : undefined}
              accessibilityLabel={`${k.label}: ${k.value}`}
              style={({ pressed }) => [
                styles.kpi,
                { width: tileWidth, backgroundColor: pressed ? c.surfaceAlt : c.surface, borderColor: c.border },
              ]}
            >
              <View style={styles.kpiHead}>
                <T variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
                  {k.label}
                </T>
                <Ionicons name={meta.icon} size={16} color={flagged ? c.warning : c.textFaint} />
              </View>
              <T style={{ fontSize: 28, fontWeight: '700', letterSpacing: -0.5 }}>{formatNumber(k.value)}</T>
              {flagged ? <Badge label="Needs attention" tone="warning" /> : <View style={{ height: 20 }} />}
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: spacing.lg, alignItems: 'flex-start' }}>
        <Card style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: spacing.md }}>
          <View>
            <T variant="heading">Interest pipeline</T>
            <T variant="caption" muted>
              {formatNumber(pipelineTotal)} open enquiries by stage
            </T>
          </View>
          {data.pipeline.map((p) => (
            <View key={p.stage} style={{ gap: 4 }} accessibilityLabel={`${humanize(p.stage)}: ${p.count}`}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T variant="caption">{humanize(p.stage)}</T>
                <T variant="caption" style={{ fontWeight: '600' }}>
                  {formatNumber(p.count)}
                </T>
              </View>
              <View style={[styles.track, { backgroundColor: c.surfaceAlt }]}>
                {p.count > 0 ? <View style={[styles.bar, { width: `${(p.count / maxStage) * 100}%`, backgroundColor: c.chart }]} /> : null}
              </View>
            </View>
          ))}
        </Card>

        {can('audit') ? (
          <Card style={{ flex: wide ? 1.2 : undefined, width: wide ? undefined : '100%', gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T variant="heading" style={{ flex: 1 }}>
                Recent activity
              </T>
              <Pressable onPress={() => onNavigate('audit')} accessibilityRole="link" hitSlop={8}>
                <T variant="label" color={c.primary}>
                  View audit log
                </T>
              </Pressable>
            </View>
            {data.recent_audit.length === 0 ? (
              <EmptyState icon="receipt-outline" title="No activity yet" style={{ minHeight: 120 }} />
            ) : (
              data.recent_audit.map((e) => (
                <View key={e.id} style={[styles.activity, { borderTopColor: c.border }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="body" numberOfLines={1}>
                      <T variant="body" style={{ fontWeight: '600' }}>
                        {e.admin ?? 'System'}
                      </T>{' '}
                      · {e.action}
                    </T>
                    {e.reason ? (
                      <T variant="caption" muted numberOfLines={1}>
                        “{e.reason}”
                      </T>
                    ) : null}
                  </View>
                  <T variant="caption" faint>
                    {formatRelative(e.created)}
                  </T>
                </View>
              ))
            )}
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  kpi: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: 6 },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  activity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
