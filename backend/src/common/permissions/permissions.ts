import { AdminRole } from '@prisma/client';

/** The 15 sidebar modules of the admin app (spec section 3). */
export const MODULES = [
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

export type ModuleKey = (typeof MODULES)[number];
export type Access = 'read' | 'write';
export type AccessLevel = 'none' | 'read' | 'write';

const allExcept = (...hidden: ModuleKey[]): ModuleKey[] => MODULES.filter((m) => !hidden.includes(m));

/**
 * Role matrix (spec section 4). This is the server-side source of truth;
 * the frontend should render navigation from GET /api/platform/auth/me -> permissions.
 */
const MATRIX: Record<AdminRole, { read: readonly ModuleKey[]; write: readonly ModuleKey[] }> = {
  super_admin: { read: MODULES, write: MODULES },
  moderator: { read: allExcept('admins'), write: ['listings', 'cases', 'summaries', 'imports'] },
  support: {
    read: allExcept('documents', 'summaries', 'audit', 'imports', 'admins'),
    write: ['cases', 'interests'],
  },
  auditor: { read: allExcept('admins'), write: [] },
};

export function can(role: AdminRole, module: ModuleKey, access: Access): boolean {
  const entry = MATRIX[role];
  if (!entry || !entry.read.includes(module)) return false;
  return access === 'read' || entry.write.includes(module);
}

export function permissionsFor(role: AdminRole): Record<ModuleKey, AccessLevel> {
  return Object.fromEntries(
    MODULES.map((m) => [m, can(role, m, 'write') ? 'write' : can(role, m, 'read') ? 'read' : 'none']),
  ) as Record<ModuleKey, AccessLevel>;
}
