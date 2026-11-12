import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { errorMessage } from '../api/client';
import { api } from '../api/endpoints';
import { Badge, Button, Dialog, Divider, EmptyState, ErrorState, Field, IconButton, KeyValue, Loading, T } from '../components/ui';
import { PAGE_SIZE } from '../config';
import { useAuth } from '../state/auth';
import { useToast } from '../state/toast';
import { radius, spacing, useLayout, useTheme } from '../theme/theme';
import { formatNumber } from '../utils/format';
import { ActionDialog } from './ActionDialog';
import type { ActionDef, ActionOutcome, ResourceConfig } from './types';

const SEARCH_DEBOUNCE_MS = 300;

export function ResourceScreen<T extends { id: string }>({ config }: { config: ResourceConfig<T> }) {
  const { c } = useTheme();
  const { hasSidePanel, gutter, isPhone } = useLayout();
  const { can } = useAuth();
  const toast = useToast();
  const canWrite = can(config.module, 'write');

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<T | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionDef<T> | null>(null);
  const [formItem, setFormItem] = useState<T | null | undefined>(undefined); // undefined = closed, null = create
  const [createOpen, setCreateOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList<T>>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'more', offset = 0) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      try {
        const page = await api.list<T>(config.module, { q: debounced || undefined, offset, limit: PAGE_SIZE }, controller.signal);
        setItems((prev) => (mode === 'more' ? [...prev, ...page.items.filter((n) => !prev.some((p) => p.id === n.id))] : page.items));
        setTotal(page.total);
        setError(null);
      } catch (e) {
        if (controller.signal.aborted) return;
        if (mode === 'more') toast.error(errorMessage(e));
        else setError(errorMessage(e));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [config.module, debounced, toast],
  );

  // New search → back to the first page and top of the list.
  useEffect(() => {
    void load('initial', 0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [load]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const replaceItem = useCallback((next: T) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === next.id);
      if (idx === -1) return [next, ...prev];
      const copy = prev.slice();
      copy[idx] = next;
      return copy;
    });
    setSelected((s) => (s && s.id === next.id ? next : s));
  }, []);

  const open = useCallback(
    async (item: T) => {
      setSelected(item);
      try {
        const fresh = await api.detail<T>(config.module, item.id);
        setSelected((s) => (s && s.id === fresh.id ? fresh : s));
        setItems((prev) => prev.map((p) => (p.id === fresh.id ? { ...p, ...fresh } : p)));
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [config.module, toast],
  );

  const onActionDone = (def: ActionDef<T>, outcome: ActionOutcome<T>) => {
    setPendingAction(null);
    replaceItem(outcome.item);
    toast.success(def.successMessage);
  };

  const hasMore = items.length < total;
  const visibleActions = useMemo(
    () => (selected && canWrite ? (config.actions ?? []).filter((a) => !a.visible || a.visible(selected)) : []),
    [selected, canWrite, config.actions],
  );

  const showCreate = canWrite && (config.Form || config.CreateFlow) && config.createLabel;

  const header = (
    <View style={[styles.toolbar, { paddingHorizontal: gutter }]}>
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder={config.searchPlaceholder}
        icon="search"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        containerStyle={{ flex: 1, minWidth: 200 }}
        accessibilityLabel={`Search ${config.noun}s`}
      />
      {showCreate ? (
        <Button
          title={isPhone ? 'New' : config.createLabel!}
          icon="add"
          onPress={() => (config.CreateFlow ? setCreateOpen(true) : setFormItem(null))}
        />
      ) : null}
    </View>
  );

  const detail = selected ? (
    <DetailView
      config={config}
      item={selected}
      canWrite={canWrite}
      actions={visibleActions}
      onAction={setPendingAction}
      onEdit={config.Form && config.editable !== false && canWrite ? () => setFormItem(selected) : undefined}
      onChange={replaceItem}
      onClose={() => setSelected(null)}
      embedded={hasSidePanel}
    />
  ) : null;

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {header}
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={() => load('initial')} />
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: spacing.xxl, gap: spacing.sm, flexGrow: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={c.primary} />}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (hasMore && !loadingMore && !loading) void load('more', items.length);
            }}
            ListHeaderComponent={
              <T variant="caption" muted style={{ paddingBottom: 4 }}>
                {total === 0 ? '' : `Showing ${formatNumber(items.length)} of ${formatNumber(total)}`}
              </T>
            }
            ListEmptyComponent={
              <EmptyState
                icon={debounced ? 'search' : config.emptyIcon}
                title={debounced ? 'No matches' : `No ${config.noun}s yet`}
                message={debounced ? `Nothing matches “${debounced}”. Try a name, email or ID.` : undefined}
              />
            }
            ListFooterComponent={
              hasMore ? (
                <View style={{ alignItems: 'center', paddingTop: spacing.md }}>
                  <Button title="Load more" variant="secondary" small loading={loadingMore} onPress={() => load('more', items.length)} />
                </View>
              ) : undefined
            }
            renderItem={({ item }) => <RowCard row={config.row(item)} selected={selected?.id === item.id} onPress={() => open(item)} />}
          />
        )}
      </View>

      {hasSidePanel && detail ? <View style={[styles.sidePanel, { borderLeftColor: c.border, backgroundColor: c.surface }]}>{detail}</View> : null}
      {!hasSidePanel && selected ? (
        <Dialog visible onClose={() => setSelected(null)} title={config.detailTitle(selected)} subtitle={config.noun.charAt(0).toUpperCase() + config.noun.slice(1)} width={640}>
          {detail}
        </Dialog>
      ) : null}

      <ActionDialog
        module={config.module}
        item={pendingAction ? selected : null}
        def={pendingAction}
        unwrap={config.unwrapAction}
        onClose={() => setPendingAction(null)}
        onDone={(o) => pendingAction && onActionDone(pendingAction, o)}
      />

      {config.Form ? (
        <config.Form
          visible={formItem !== undefined}
          item={formItem ?? null}
          onClose={() => setFormItem(undefined)}
          onSaved={(saved) => {
            setFormItem(undefined);
            replaceItem(saved);
            if (formItem === null) setTotal((t) => t + 1);
          }}
        />
      ) : null}
      {config.CreateFlow ? (
        <config.CreateFlow
          visible={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(created) => {
            replaceItem(created);
            setTotal((t) => t + 1);
          }}
          onUpdated={replaceItem}
        />
      ) : null}
    </View>
  );
}

function RowCard({ row, selected, onPress }: { row: ReturnType<ResourceConfig<{ id: string }>['row']>; selected: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.title}${row.subtitle ? `, ${row.subtitle}` : ''}`}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.row,
        {
          backgroundColor: selected ? c.primarySoft : pressed || hovered ? c.surfaceAlt : c.surface,
          borderColor: selected ? c.primary : c.border,
        },
      ]}
    >
      {row.icon ? (
        <View style={[styles.rowIcon, { backgroundColor: c.surfaceAlt }]}>
          <Ionicons name={row.icon} size={18} color={c.textMuted} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <T variant="subheading" numberOfLines={1}>
          {row.title}
        </T>
        {row.subtitle ? (
          <T variant="caption" muted numberOfLines={2}>
            {row.subtitle}
          </T>
        ) : null}
        {row.badges?.length || row.meta ? (
          <View style={styles.rowMeta}>
            {row.badges?.map((b) => <Badge key={b.label} {...b} />)}
            {row.meta ? (
              <T variant="caption" faint numberOfLines={1}>
                {row.meta}
              </T>
            ) : null}
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
    </Pressable>
  );
}

function DetailView<T extends { id: string }>({
  config,
  item,
  canWrite,
  actions,
  onAction,
  onEdit,
  onChange,
  onClose,
  embedded,
}: {
  config: ResourceConfig<T>;
  item: T;
  canWrite: boolean;
  actions: ActionDef<T>[];
  onAction: (a: ActionDef<T>) => void;
  onEdit?: () => void;
  onChange: (item: T) => void;
  onClose: () => void;
  embedded: boolean;
}) {
  const { c } = useTheme();
  const fields = config.fields(item).filter((f) => !f.hidden);
  const Extra = config.DetailExtra;
  const body = (
    <View style={{ gap: spacing.lg }}>
      <View>
        {fields.map((f) => (
          <KeyValue key={f.label} label={f.label} value={f.value ?? '—'} mono={f.mono} />
        ))}
      </View>
      {Extra ? <Extra item={item} canWrite={canWrite} onChange={onChange} /> : null}
      {actions.length || onEdit ? (
        <View style={{ gap: spacing.sm }}>
          <Divider />
          <T variant="label" muted>
            Actions
          </T>
          <View style={styles.actions}>
            {onEdit ? <Button title="Edit" icon="create-outline" variant="secondary" small onPress={onEdit} /> : null}
            {actions.map((a) => (
              <Button key={a.action} title={a.label} icon={a.icon} small variant={a.variant ?? 'secondary'} onPress={() => onAction(a)} />
            ))}
          </View>
        </View>
      ) : !canWrite ? (
        <T variant="caption" faint>
          Your role has read-only access to {config.noun}s.
        </T>
      ) : null}
    </View>
  );
  if (!embedded) return body;
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.panelHeader}>
        <View style={{ flex: 1 }}>
          <T variant="caption" muted>
            {config.noun.charAt(0).toUpperCase() + config.noun.slice(1)}
          </T>
          <T variant="heading" numberOfLines={2}>
            {config.detailTitle(item)}
          </T>
        </View>
        <IconButton icon="close" label="Close details" onPress={onClose} />
      </View>
      <Divider />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} style={{ backgroundColor: c.surface }}>
        {body}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  rowIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 },
  sidePanel: { width: 460, borderLeftWidth: StyleSheet.hairlineWidth },
  panelHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
