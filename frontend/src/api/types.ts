export const MODULE_KEYS = [
  'overview',
  'reports',
  'firms',
  'accounts',
  'listings',
  'cases',
  'interests',
  'documents',
  'summaries',
  'plans',
  'announcements',
  'imports',
  'settings',
  'admins',
  'audit',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export type AccessLevel = 'none' | 'read' | 'write';
export type Permissions = Record<ModuleKey, AccessLevel>;
export type AdminRole = 'super_admin' | 'moderator' | 'support' | 'auditor';
export const ADMIN_ROLES: AdminRole[] = ['super_admin', 'moderator', 'support', 'auditor'];

export type ISODate = string;

export type AdminUser = { id: string; name: string; email: string; role: AdminRole };

export type LoginResponse = { token: string; expiresAt: ISODate; user: AdminUser; permissions: Permissions };
export type MeResponse = {
  user: AdminUser;
  permissions: Permissions;
  session: { expiresAt: ISODate; elevatedUntil: ISODate | null };
};

export type Page<T> = { items: T[]; total: number; offset: number; limit: number };

export type Firm = {
  id: string;
  name: string;
  activeUsers: number;
  listings: number;
  suspended: boolean;
  suspended_at: ISODate | null;
  plan: { id: string; name: string } | null;
  created: ISODate;
};

export type Account = {
  id: string;
  name: string;
  email: string;
  role: 'buyer' | 'seller';
  firm_id: string | null;
  active: boolean;
  sessions_revoked_at: ISODate | null;
  last_login: ISODate | null;
  created: ISODate;
};

export type ModerationStatus = 'pending' | 'reviewed' | 'blocked' | 'info_requested';
export type Listing = {
  id: string;
  title: string;
  firm_id: string | null;
  firm_name: string | null;
  type: string;
  city: string;
  price: number;
  version: number;
  latitude: number | null;
  longitude: number | null;
  sellerPublished: boolean;
  moderation: ModerationStatus;
  moderation_note: string | null;
  created: ISODate;
  updated: ISODate;
};

export type CaseStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';
export const CASE_STATUSES: CaseStatus[] = ['open', 'investigating', 'resolved', 'dismissed'];
export type Case = {
  id: string;
  property_id: string;
  property_title: string;
  reporter_id: string | null;
  category: string;
  description: string;
  report: string | null;
  status: CaseStatus;
  staff_note: string | null;
  created: ISODate;
  updated: ISODate;
};

export type Interest = {
  id: string;
  property_id: string;
  property_title: string;
  buyer_id: string;
  status: 'open' | 'closed';
  stage: string;
  messages: number;
  site_visit_at: ISODate | null;
  closed_at: ISODate | null;
  created: ISODate;
};

export type DocumentMeta = {
  id: string;
  firm_id: string | null;
  property_id: string;
  label: string;
  mime: string;
  size: number;
  created: ISODate;
};

export type Summary = {
  id: string;
  property_id: string;
  source_version: number;
  language: string;
  kind: string;
  summary: string;
  approved: boolean;
  blocked: boolean;
  created: ISODate;
  updated: ISODate;
};

export type Plan = {
  id: string;
  name: string;
  max_staff: number;
  max_listings: number;
  price_inr: number | string;
  active: boolean;
  created: ISODate;
  updated: ISODate;
};

export type Audience = 'all' | 'buyers' | 'sellers' | 'firms';
export const AUDIENCES: Audience[] = ['all', 'buyers', 'sellers', 'firms'];
export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  active: boolean;
  created: ISODate;
  updated: ISODate;
};

export type ParcelRow = Record<string, string | number | null>;
export type ImportRowError = { index: number; field: string; message: string };
export type ImportBatch = {
  id: string;
  filename: string | null;
  status: 'validated' | 'failed' | 'committed';
  features: number;
  valid: number;
  invalid: number;
  created: ISODate;
  committed: ISODate | null;
  rows?: ParcelRow[];
  errors?: ImportRowError[];
};
export type ImportCommitResult = { id: string; status: 'committed'; created: number; updated: number; committed: ISODate };

export type Admin = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  active: boolean;
  locked: boolean;
  last_login: ISODate | null;
  created: ISODate;
};
export type AdminMutationResult = { admin: Admin };

export type AuditEntry = {
  id: string;
  admin_id: string | null;
  admin: string | null;
  role: AdminRole | null;
  module: string;
  action: string;
  target_id: string | null;
  reason: string | null;
  metadata: unknown;
  ip: string | null;
  created: ISODate;
};

export type Overview = {
  kpis: { key: string; label: string; value: number }[];
  pipeline: { stage: string; count: number }[];
  recent_audit: AuditEntry[];
};

export type ReportRow = {
  date: string;
  new_accounts: number;
  new_listings: number;
  new_interests: number;
  new_cases: number;
  admin_actions: number;
};
export type Report = { days: number; rows: ReportRow[] };

export type PlatformSettings = {
  settings: {
    publication_enabled: boolean;
    registration_enabled: boolean;
    ai_generation_enabled: boolean;
    updated: ISODate | null;
    updated_by: string | null;
  };
  providers: { key: string; label: string; provider: string | null; configured: boolean; connectivity: string }[];
};

export type Subscription = { id: string; firm_id: string; plan_id: string; plan_name: string; active: boolean; starts_at: ISODate };

export type ElevationResponse = { elevatedUntil: ISODate };
