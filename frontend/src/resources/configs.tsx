import React from 'react';
import type {
  Account,
  Admin,
  AdminMutationResult,
  Announcement,
  AuditEntry,
  Case,
  CaseStatus,
  DocumentMeta,
  Firm,
  ImportBatch,
  Interest,
  Listing,
  ModerationStatus,
  ModuleKey,
  Plan,
  Summary,
} from '../api/types';
import { ADMIN_ROLES, CASE_STATUSES } from '../api/types';
import { Badge, T, Tone } from '../components/ui';
import { ROLE_LABELS } from '../navigation/modules';
import { font } from '../theme/theme';
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatINR,
  formatNumber,
  formatRelative,
  humanize,
  shortId,
  yesNo,
} from '../utils/format';
import { FirmPlan } from './FirmPlan';
import { AdminForm, AnnouncementForm, AUDIENCE_LABELS, PlanForm } from './forms';
import { ImportCreateFlow, ImportDetail, importLabel, importTone } from './Imports';
import type { ResourceConfig } from './types';

const Pre = ({ children }: { children: string }) => (
  <T variant="mono" selectable style={{ fontFamily: font.mono }}>
    {children}
  </T>
);
const Paragraph = ({ children }: { children: string | null | undefined }) => (
  <T selectable>{children?.trim() ? children : '—'}</T>
);

/* ---------- Firms ---------- */

export const firmsConfig: ResourceConfig<Firm> = {
  module: 'firms',
  noun: 'firm',
  searchPlaceholder: 'Search firms by name or ID',
  emptyIcon: 'business-outline',
  row: (f) => ({
    title: f.name,
    subtitle: `${formatNumber(f.activeUsers)} active users · ${formatNumber(f.listings)} listings`,
    icon: 'business-outline',
    badges: [
      f.suspended ? { label: 'Suspended', tone: 'danger', icon: 'ban' } : { label: 'Active', tone: 'success' },
      { label: f.plan?.name ?? 'No plan', tone: f.plan ? 'primary' : 'neutral' },
    ],
    meta: `Joined ${formatDate(f.created)}`,
  }),
  detailTitle: (f) => f.name,
  fields: (f) => [
    { label: 'Status', value: f.suspended ? <Badge label="Suspended" tone="danger" /> : <Badge label="Active" tone="success" /> },
    { label: 'Suspended at', value: formatDateTime(f.suspended_at), hidden: !f.suspended },
    { label: 'Active users', value: formatNumber(f.activeUsers) },
    { label: 'Listings', value: formatNumber(f.listings) },
    { label: 'Joined', value: formatDateTime(f.created) },
    { label: 'Firm ID', value: f.id, mono: true },
  ],
  DetailExtra: FirmPlan,
  actions: [
    {
      action: 'suspend',
      label: 'Suspend firm',
      icon: 'ban',
      variant: 'danger',
      sensitive: true,
      description: 'Staff lose access and listings are hidden from the marketplace.',
      visible: (f) => !f.suspended,
      successMessage: 'Firm suspended',
    },
    {
      action: 'restore',
      label: 'Restore firm',
      icon: 'refresh-circle-outline',
      variant: 'primary',
      description: 'Re-enables access for the firm and its staff.',
      visible: (f) => f.suspended,
      successMessage: 'Firm restored',
    },
  ],
};

/* ---------- Accounts ---------- */

export const accountsConfig: ResourceConfig<Account> = {
  module: 'accounts',
  noun: 'account',
  searchPlaceholder: 'Search by name, email or ID',
  emptyIcon: 'people-outline',
  row: (a) => ({
    title: a.name,
    subtitle: a.email,
    icon: a.role === 'seller' ? 'storefront-outline' : 'person-outline',
    badges: [{ label: humanize(a.role), tone: 'info' }, a.active ? { label: 'Enabled', tone: 'success' } : { label: 'Disabled', tone: 'danger' }],
    meta: `Last sign-in ${formatRelative(a.last_login).toLowerCase()}`,
  }),
  detailTitle: (a) => a.name,
  fields: (a) => [
    { label: 'Email', value: a.email },
    { label: 'Role', value: humanize(a.role) },
    { label: 'Status', value: a.active ? <Badge label="Enabled" tone="success" /> : <Badge label="Disabled" tone="danger" /> },
    { label: 'Firm ID', value: a.firm_id ?? '—', mono: !!a.firm_id },
    { label: 'Last sign-in', value: formatDateTime(a.last_login) },
    { label: 'Sessions revoked', value: formatDateTime(a.sessions_revoked_at) },
    { label: 'Created', value: formatDateTime(a.created) },
    { label: 'Account ID', value: a.id, mono: true },
  ],
  actions: [
    { action: 'enable', label: 'Enable account', icon: 'checkmark-circle-outline', variant: 'primary', visible: (a) => !a.active, successMessage: 'Account enabled' },
    {
      action: 'disable',
      label: 'Disable account',
      icon: 'close-circle-outline',
      variant: 'danger',
      sensitive: true,
      description: 'The user can no longer sign in to the marketplace.',
      visible: (a) => a.active,
      successMessage: 'Account disabled',
    },
    {
      action: 'revoke_sessions',
      label: 'Sign out everywhere',
      icon: 'log-out-outline',
      sensitive: true,
      description: 'Ends every active marketplace session for this user.',
      successMessage: 'All sessions revoked',
    },
  ],
};

/* ---------- Listings ---------- */

const moderationTone: Record<ModerationStatus, Tone> = { pending: 'warning', reviewed: 'success', blocked: 'danger', info_requested: 'info' };

export const listingsConfig: ResourceConfig<Listing> = {
  module: 'listings',
  noun: 'listing',
  searchPlaceholder: 'Search by title, city or ID',
  emptyIcon: 'home-outline',
  row: (l) => ({
    title: l.title,
    subtitle: [l.firm_name, l.city, humanize(l.type)].filter(Boolean).join(' · '),
    icon: 'home-outline',
    badges: [{ label: humanize(l.moderation), tone: moderationTone[l.moderation] }, ...(l.sellerPublished ? [] : [{ label: 'Unpublished', tone: 'neutral' as Tone }])],
    meta: formatINR(l.price),
  }),
  detailTitle: (l) => l.title,
  fields: (l) => [
    { label: 'Moderation', value: <Badge label={humanize(l.moderation)} tone={moderationTone[l.moderation]} /> },
    { label: 'Moderation note', value: <Paragraph>{l.moderation_note}</Paragraph>, hidden: !l.moderation_note },
    { label: 'Price', value: formatINR(l.price) },
    { label: 'Type', value: humanize(l.type) },
    { label: 'City', value: l.city },
    { label: 'Firm', value: l.firm_name ?? '—' },
    { label: 'Published by seller', value: yesNo(l.sellerPublished) },
    { label: 'Location', value: l.latitude !== null && l.longitude !== null ? `${l.latitude.toFixed(5)}, ${l.longitude.toFixed(5)}` : '—', mono: true },
    { label: 'Version', value: String(l.version) },
    { label: 'Updated', value: formatDateTime(l.updated) },
    { label: 'Created', value: formatDateTime(l.created) },
    { label: 'Listing ID', value: l.id, mono: true },
  ],
  actions: [
    { action: 'mark_reviewed', label: 'Mark reviewed', icon: 'checkmark-done-outline', variant: 'primary', visible: (l) => l.moderation !== 'reviewed', successMessage: 'Listing marked as reviewed' },
    {
      action: 'request_info',
      label: 'Request information',
      icon: 'help-circle-outline',
      note: 'required',
      noteLabel: 'Message to the firm',
      description: 'The firm is asked to provide more details or documents.',
      successMessage: 'Information requested',
    },
    {
      action: 'block',
      label: 'Block listing',
      icon: 'ban',
      variant: 'danger',
      note: 'optional',
      noteLabel: 'Note to the firm',
      description: 'The listing is removed from the marketplace.',
      visible: (l) => l.moderation !== 'blocked',
      successMessage: 'Listing blocked',
    },
  ],
};

/* ---------- Cases ---------- */

const caseTone: Record<CaseStatus, Tone> = { open: 'warning', investigating: 'info', resolved: 'success', dismissed: 'neutral' };

export const casesConfig: ResourceConfig<Case> = {
  module: 'cases',
  noun: 'case',
  searchPlaceholder: 'Search by category, description or ID',
  emptyIcon: 'flag-outline',
  row: (k) => ({
    title: `${humanize(k.category)} · ${k.property_title}`,
    subtitle: k.description,
    icon: 'flag-outline',
    badges: [{ label: humanize(k.status), tone: caseTone[k.status] }],
    meta: `Reported ${formatRelative(k.created).toLowerCase()}`,
  }),
  detailTitle: (k) => humanize(k.category),
  fields: (k) => [
    { label: 'Status', value: <Badge label={humanize(k.status)} tone={caseTone[k.status]} /> },
    { label: 'Property', value: k.property_title },
    { label: 'Description', value: <Paragraph>{k.description}</Paragraph> },
    { label: 'Report', value: <Paragraph>{k.report}</Paragraph>, hidden: !k.report },
    { label: 'Staff notes', value: <Paragraph>{k.staff_note}</Paragraph> },
    { label: 'Reporter ID', value: k.reporter_id ?? '—', mono: !!k.reporter_id },
    { label: 'Property ID', value: k.property_id, mono: true },
    { label: 'Updated', value: formatDateTime(k.updated) },
    { label: 'Reported', value: formatDateTime(k.created) },
    { label: 'Case ID', value: k.id, mono: true },
  ],
  actions: [
    {
      action: 'set_status',
      label: 'Change status',
      icon: 'swap-horizontal',
      variant: 'primary',
      status: { options: CASE_STATUSES.map((s) => ({ value: s, label: humanize(s) })), initial: (k) => k.status },
      successMessage: 'Case status updated',
    },
    { action: 'add_note', label: 'Add staff note', icon: 'create-outline', note: 'required', noteLabel: 'Staff note', description: 'Internal only. Appended to the case history.', successMessage: 'Note added' },
  ],
};

/* ---------- Interests ---------- */

export const interestsConfig: ResourceConfig<Interest> = {
  module: 'interests',
  noun: 'interest',
  searchPlaceholder: 'Search by property, stage or ID',
  emptyIcon: 'chatbubbles-outline',
  row: (i) => ({
    title: i.property_title,
    subtitle: `${humanize(i.stage)} · ${formatNumber(i.messages)} message${i.messages === 1 ? '' : 's'}`,
    icon: 'chatbubbles-outline',
    badges: [i.status === 'open' ? { label: 'Open', tone: 'info' } : { label: 'Closed', tone: 'neutral' }],
    meta: i.site_visit_at ? `Site visit ${formatDateTime(i.site_visit_at)}` : `Started ${formatDate(i.created)}`,
  }),
  detailTitle: (i) => i.property_title,
  fields: (i) => [
    { label: 'Status', value: i.status === 'open' ? <Badge label="Open" tone="info" /> : <Badge label="Closed" /> },
    { label: 'Stage', value: humanize(i.stage) },
    { label: 'Messages', value: `${formatNumber(i.messages)} (content is private)` },
    { label: 'Site visit', value: formatDateTime(i.site_visit_at) },
    { label: 'Closed', value: formatDateTime(i.closed_at), hidden: !i.closed_at },
    { label: 'Buyer ID', value: i.buyer_id, mono: true },
    { label: 'Property ID', value: i.property_id, mono: true },
    { label: 'Started', value: formatDateTime(i.created) },
    { label: 'Interest ID', value: i.id, mono: true },
  ],
  actions: [
    { action: 'close', label: 'Close interest', icon: 'lock-closed-outline', variant: 'danger', visible: (i) => i.status === 'open', description: 'Ends the enquiry for both parties.', successMessage: 'Interest closed' },
  ],
};

/* ---------- Documents ---------- */

export const documentsConfig: ResourceConfig<DocumentMeta> = {
  module: 'documents',
  noun: 'document',
  searchPlaceholder: 'Search by label, type or ID',
  emptyIcon: 'document-lock-outline',
  row: (d) => ({
    title: d.label,
    subtitle: `${d.mime} · ${formatBytes(d.size)}`,
    icon: d.mime.includes('pdf') ? 'document-text-outline' : d.mime.startsWith('image/') ? 'image-outline' : 'document-outline',
    badges: [{ label: 'Encrypted', tone: 'neutral', icon: 'lock-closed' }],
    meta: formatDate(d.created),
  }),
  detailTitle: (d) => d.label,
  fields: (d) => [
    { label: 'Type', value: d.mime },
    { label: 'Size', value: formatBytes(d.size) },
    { label: 'Property ID', value: d.property_id, mono: true },
    { label: 'Firm ID', value: d.firm_id ?? '—', mono: !!d.firm_id },
    { label: 'Uploaded', value: formatDateTime(d.created) },
    { label: 'Document ID', value: d.id, mono: true },
    { label: 'Access', value: 'Contents are encrypted and are not available in the admin console.' },
  ],
};

/* ---------- Summaries ---------- */

const summaryBadge = (s: Summary) =>
  s.blocked ? { label: 'Blocked', tone: 'danger' as Tone } : s.approved ? { label: 'Approved', tone: 'success' as Tone } : { label: 'Awaiting approval', tone: 'warning' as Tone };

export const summariesConfig: ResourceConfig<Summary> = {
  module: 'summaries',
  noun: 'summary',
  searchPlaceholder: 'Search summary text or property ID',
  emptyIcon: 'sparkles-outline',
  row: (s) => ({
    title: s.summary,
    subtitle: `${humanize(s.kind)} · ${s.language.toUpperCase()} · v${s.source_version}`,
    icon: 'sparkles-outline',
    badges: [summaryBadge(s)],
    meta: formatDate(s.updated),
  }),
  detailTitle: () => 'Listing summary',
  fields: (s) => [
    { label: 'Status', value: <Badge {...summaryBadge(s)} /> },
    { label: 'Summary', value: <Paragraph>{s.summary}</Paragraph> },
    { label: 'Kind', value: humanize(s.kind) },
    { label: 'Language', value: s.language.toUpperCase() },
    { label: 'Listing version', value: String(s.source_version) },
    { label: 'Property ID', value: s.property_id, mono: true },
    { label: 'Updated', value: formatDateTime(s.updated) },
    { label: 'Summary ID', value: s.id, mono: true },
  ],
  actions: [
    { action: 'approve', label: 'Approve', icon: 'checkmark-circle-outline', variant: 'primary', visible: (s) => !s.approved && !s.blocked, successMessage: 'Summary approved' },
    { action: 'block', label: 'Block', icon: 'ban', variant: 'danger', visible: (s) => !s.blocked, description: 'Hides the summary from the marketplace.', successMessage: 'Summary blocked' },
    { action: 'unblock', label: 'Unblock', icon: 'refresh-circle-outline', visible: (s) => s.blocked, successMessage: 'Summary unblocked' },
  ],
};

/* ---------- Plans ---------- */

export const plansConfig: ResourceConfig<Plan> = {
  module: 'plans',
  noun: 'plan',
  searchPlaceholder: 'Search plans',
  emptyIcon: 'pricetags-outline',
  createLabel: 'New plan',
  Form: PlanForm,
  row: (p) => ({
    title: p.name,
    subtitle: `${formatINR(p.price_inr)} / month · ${formatNumber(p.max_staff)} staff · ${formatNumber(p.max_listings)} listings`,
    icon: 'pricetag-outline',
    badges: [p.active ? { label: 'Active', tone: 'success' } : { label: 'Inactive', tone: 'neutral' }],
  }),
  detailTitle: (p) => p.name,
  fields: (p) => [
    { label: 'Monthly price', value: formatINR(p.price_inr) },
    { label: 'Staff seats', value: formatNumber(p.max_staff) },
    { label: 'Listing limit', value: formatNumber(p.max_listings) },
    { label: 'Status', value: p.active ? <Badge label="Active" tone="success" /> : <Badge label="Inactive" /> },
    { label: 'Updated', value: formatDateTime(p.updated) },
    { label: 'Created', value: formatDateTime(p.created) },
    { label: 'Plan ID', value: p.id, mono: true },
  ],
};

/* ---------- Announcements ---------- */

export const announcementsConfig: ResourceConfig<Announcement> = {
  module: 'announcements',
  noun: 'announcement',
  searchPlaceholder: 'Search announcements',
  emptyIcon: 'megaphone-outline',
  createLabel: 'New announcement',
  Form: AnnouncementForm,
  row: (a) => ({
    title: a.title,
    subtitle: a.body,
    icon: 'megaphone-outline',
    badges: [a.active ? { label: 'Live', tone: 'success' } : { label: 'Inactive', tone: 'neutral' }, { label: AUDIENCE_LABELS[a.audience], tone: 'info' }],
    meta: formatDate(a.updated),
  }),
  detailTitle: (a) => a.title,
  fields: (a) => [
    { label: 'Message', value: <Paragraph>{a.body}</Paragraph> },
    { label: 'Audience', value: AUDIENCE_LABELS[a.audience] },
    { label: 'Status', value: a.active ? <Badge label="Live" tone="success" /> : <Badge label="Inactive" /> },
    { label: 'Updated', value: formatDateTime(a.updated) },
    { label: 'Created', value: formatDateTime(a.created) },
  ],
};

/* ---------- Imports ---------- */

export const importsConfig: ResourceConfig<ImportBatch> = {
  module: 'imports',
  noun: 'import',
  searchPlaceholder: 'Search by file name or ID',
  emptyIcon: 'cloud-upload-outline',
  createLabel: 'New import',
  CreateFlow: ImportCreateFlow,
  DetailExtra: ImportDetail,
  row: (b) => ({
    title: b.filename ?? 'Untitled import',
    subtitle: `${formatNumber(b.features)} parcels · ${formatNumber(b.valid)} valid · ${formatNumber(b.invalid)} with errors`,
    icon: 'cloud-upload-outline',
    badges: [{ label: importLabel(b.status), tone: importTone(b.status) }],
    meta: formatDateTime(b.created),
  }),
  detailTitle: (b) => b.filename ?? 'Import',
  fields: (b) => [
    { label: 'Status', value: <Badge label={importLabel(b.status)} tone={importTone(b.status)} /> },
    { label: 'Parcels', value: formatNumber(b.features) },
    { label: 'Uploaded', value: formatDateTime(b.created) },
    { label: 'Committed', value: formatDateTime(b.committed), hidden: !b.committed },
    { label: 'Import ID', value: b.id, mono: true },
  ],
};

/* ---------- Administrators ---------- */

const unwrapAdmin = (res: unknown) => {
  const r = res as AdminMutationResult;
  return { item: r.admin };
};

export const adminsConfig: ResourceConfig<Admin> = {
  module: 'admins',
  noun: 'administrator',
  searchPlaceholder: 'Search by name or email',
  emptyIcon: 'shield-half-outline',
  createLabel: 'New administrator',
  Form: AdminForm,
  unwrapAction: unwrapAdmin,
  row: (a) => ({
    title: a.name,
    subtitle: a.email,
    icon: 'person-circle-outline',
    badges: [
      { label: ROLE_LABELS[a.role], tone: 'primary' },
      a.active ? { label: 'Active', tone: 'success' } : { label: 'Deactivated', tone: 'neutral' },
      ...(a.locked ? [{ label: 'Locked', tone: 'danger' as Tone, icon: 'lock-closed' as const }] : []),
    ],
    meta: `Last sign-in ${formatRelative(a.last_login).toLowerCase()}`,
  }),
  detailTitle: (a) => a.name,
  fields: (a) => [
    { label: 'Email', value: a.email },
    { label: 'Role', value: ROLE_LABELS[a.role] },
    { label: 'Status', value: a.active ? <Badge label="Active" tone="success" /> : <Badge label="Deactivated" /> },
    { label: 'Sign-in lock', value: a.locked ? <Badge label="Locked after failed attempts" tone="danger" /> : 'Not locked' },
    { label: 'Last sign-in', value: formatDateTime(a.last_login) },
    { label: 'Created', value: formatDateTime(a.created) },
    { label: 'Admin ID', value: a.id, mono: true },
  ],
  actions: [
    { action: 'activate', label: 'Activate', icon: 'checkmark-circle-outline', variant: 'primary', sensitive: true, visible: (a) => !a.active, successMessage: 'Administrator activated' },
    {
      action: 'set_role',
      label: 'Change role',
      icon: 'swap-horizontal',
      sensitive: true,
      role: { options: ADMIN_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })), initial: (a) => a.role },
      successMessage: 'Role updated',
    },
    { action: 'unlock', label: 'Unlock sign-in', icon: 'lock-open-outline', sensitive: true, visible: (a) => a.locked, successMessage: 'Sign-in unlocked' },
    { action: 'revoke_sessions', label: 'Sign out everywhere', icon: 'log-out-outline', sensitive: true, description: 'Ends all of this administrator’s sessions.', successMessage: 'Sessions revoked' },
    {
      action: 'deactivate',
      label: 'Deactivate',
      icon: 'person-remove-outline',
      variant: 'danger',
      sensitive: true,
      visible: (a) => a.active,
      description: 'Blocks sign-in and ends all sessions. The last active super admin cannot be deactivated.',
      successMessage: 'Administrator deactivated',
    },
  ],
};

/* ---------- Audit ---------- */

const auditTone = (action: string): Tone =>
  /failed|suspend|block|disable|deactivate|revoke|reset/.test(action) ? 'danger' : /login|logout|elevate/.test(action) ? 'neutral' : 'info';

export const auditConfig: ResourceConfig<AuditEntry> = {
  module: 'audit',
  noun: 'audit entry',
  searchPlaceholder: 'Search action, email, reason or record ID',
  emptyIcon: 'receipt-outline',
  row: (e) => ({
    title: humanize(e.action.includes('.') ? e.action.split('.').slice(1).join(' ') : e.action) + ` · ${humanize(e.module)}`,
    subtitle: e.reason ?? undefined,
    icon: 'receipt-outline',
    badges: [{ label: e.action, tone: auditTone(e.action) }],
    meta: `${e.admin ?? 'System'} · ${formatDateTime(e.created)}`,
  }),
  detailTitle: (e) => e.action,
  fields: (e) => [
    { label: 'When', value: formatDateTime(e.created) },
    { label: 'Administrator', value: e.admin ?? 'System' },
    { label: 'Role', value: e.role ? ROLE_LABELS[e.role] : '—' },
    { label: 'Module', value: humanize(e.module) },
    { label: 'Action', value: e.action, mono: true },
    { label: 'Reason', value: <Paragraph>{e.reason}</Paragraph> },
    { label: 'Record ID', value: e.target_id ?? '—', mono: !!e.target_id },
    { label: 'IP address', value: e.ip ?? '—', mono: !!e.ip },
    { label: 'Details', value: <Pre>{e.metadata ? JSON.stringify(e.metadata, null, 2) : '—'}</Pre> },
    { label: 'Entry ID', value: shortId(e.id), mono: true },
  ],
};

export const RESOURCE_CONFIGS: Partial<Record<ModuleKey, ResourceConfig<{ id: string }>>> = {
  firms: firmsConfig as unknown as ResourceConfig<{ id: string }>,
  accounts: accountsConfig as unknown as ResourceConfig<{ id: string }>,
  listings: listingsConfig as unknown as ResourceConfig<{ id: string }>,
  cases: casesConfig as unknown as ResourceConfig<{ id: string }>,
  interests: interestsConfig as unknown as ResourceConfig<{ id: string }>,
  documents: documentsConfig as unknown as ResourceConfig<{ id: string }>,
  summaries: summariesConfig as unknown as ResourceConfig<{ id: string }>,
  plans: plansConfig as unknown as ResourceConfig<{ id: string }>,
  announcements: announcementsConfig as unknown as ResourceConfig<{ id: string }>,
  imports: importsConfig as unknown as ResourceConfig<{ id: string }>,
  admins: adminsConfig as unknown as ResourceConfig<{ id: string }>,
  audit: auditConfig as unknown as ResourceConfig<{ id: string }>,
};
