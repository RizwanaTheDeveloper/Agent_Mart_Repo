import type { ModuleKey } from '../api/types';
import type { IconName } from '../components/ui';

export type ModuleMeta = { key: ModuleKey; label: string; icon: IconName; description: string; group: 'Monitor' | 'Marketplace' | 'Content' | 'Platform' };

export const MODULES: ModuleMeta[] = [
  { key: 'overview', label: 'Overview', icon: 'grid-outline', description: 'Platform health at a glance', group: 'Monitor' },
  { key: 'reports', label: 'Reports', icon: 'bar-chart-outline', description: 'Daily activity and CSV export', group: 'Monitor' },
  { key: 'firms', label: 'Firms', icon: 'business-outline', description: 'Real-estate firms, plans and suspension', group: 'Marketplace' },
  { key: 'accounts', label: 'Accounts', icon: 'people-outline', description: 'Buyer and seller accounts', group: 'Marketplace' },
  { key: 'listings', label: 'Listings', icon: 'home-outline', description: 'Property listing moderation', group: 'Marketplace' },
  { key: 'cases', label: 'Cases', icon: 'flag-outline', description: 'Buyer reports and investigations', group: 'Marketplace' },
  { key: 'interests', label: 'Interests', icon: 'chatbubbles-outline', description: 'Enquiries and site visits', group: 'Marketplace' },
  { key: 'documents', label: 'Documents', icon: 'document-lock-outline', description: 'Listing document metadata', group: 'Content' },
  { key: 'summaries', label: 'Summaries', icon: 'sparkles-outline', description: 'AI-generated listing summaries', group: 'Content' },
  { key: 'announcements', label: 'Announcements', icon: 'megaphone-outline', description: 'Notices shown to marketplace users', group: 'Content' },
  { key: 'imports', label: 'Imports', icon: 'cloud-upload-outline', description: 'Parcel reference data imports', group: 'Content' },
  { key: 'plans', label: 'Plans', icon: 'pricetags-outline', description: 'Subscription plans for firms', group: 'Platform' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline', description: 'Platform switches and providers', group: 'Platform' },
  { key: 'admins', label: 'Administrators', icon: 'shield-half-outline', description: 'Admin users and roles', group: 'Platform' },
  { key: 'audit', label: 'Audit log', icon: 'receipt-outline', description: 'Every administrative action', group: 'Platform' },
];

export const MODULE_BY_KEY = Object.fromEntries(MODULES.map((m) => [m.key, m])) as Record<ModuleKey, ModuleMeta>;
export const GROUPS: ModuleMeta['group'][] = ['Monitor', 'Marketplace', 'Content', 'Platform'];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  moderator: 'Moderator',
  support: 'Support',
  auditor: 'Auditor',
};
