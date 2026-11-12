import { can, permissionsFor } from './permissions';

describe('role matrix', () => {
  it('super_admin can write everything including admins', () => {
    expect(can('super_admin', 'admins', 'write')).toBe(true);
    expect(can('super_admin', 'settings', 'write')).toBe(true);
  });

  it('moderator writes only listings, cases, summaries, imports', () => {
    expect(can('moderator', 'listings', 'write')).toBe(true);
    expect(can('moderator', 'imports', 'write')).toBe(true);
    expect(can('moderator', 'firms', 'write')).toBe(false);
    expect(can('moderator', 'firms', 'read')).toBe(true);
    expect(can('moderator', 'admins', 'read')).toBe(false);
  });

  it('support cannot see documents/summaries/audit/imports/admins', () => {
    for (const m of ['documents', 'summaries', 'audit', 'imports', 'admins'] as const) {
      expect(can('support', m, 'read')).toBe(false);
    }
    expect(can('support', 'cases', 'write')).toBe(true);
    expect(can('support', 'interests', 'write')).toBe(true);
    expect(can('support', 'listings', 'write')).toBe(false);
  });

  it('auditor is read-only and cannot see admins', () => {
    const p = permissionsFor('auditor');
    expect(Object.values(p).includes('write')).toBe(false);
    expect(p.admins).toBe('none');
    expect(p.audit).toBe('read');
  });
});
