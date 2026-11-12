/**
 * End-to-end smoke test of the acceptance scenarios (spec section 11) against a RUNNING server
 * with seeded demo data. DEV DATABASE ONLY - it mutates data.
 *   npm run test:e2e   (needs API_URL, E2E_SUPER_EMAIL, E2E_SUPPORT_EMAIL, E2E_PASSWORD)
 */
const B = (process.env.API_URL || 'http://localhost:3000/api') + '/platform';
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${cond ? '' : extra}`); };
async function call(method, path, token, body, retry = true) {
  try { return await call1(method, path, token, body); } catch (e) { if (retry) return call(method, path, token, body, false); throw e; }
}
async function call1(method, path, token, body) {
  const r = await fetch(B + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, body: json };
}
(async () => {
  const SU = process.env.E2E_SUPER_EMAIL, SP = process.env.E2E_SUPPORT_EMAIL, PW = process.env.E2E_PASSWORD;
  if (!SU || !SP || !PW) throw new Error('Set E2E_SUPER_EMAIL, E2E_SUPPORT_EMAIL, E2E_PASSWORD (both admins share the password)');
  check('login rejects bad password', (await call('POST', '/auth/login', null, { email: SU, password: 'wrong-password' })).status === 401);
  let r = await call('POST', '/auth/login', null, { email: SU, password: PW });
  check('super_admin login ok', r.status === 200 && r.body.token, JSON.stringify(r.body));
  const T = r.body.token;
  check('login returns permissions', r.body.permissions?.admins === 'write');
  r = await call('GET', '/auth/me', T); check('me', r.status === 200 && r.body.user.role === 'super_admin');

  r = await call('GET', '/overview', T); check('overview 8 KPIs', r.body.kpis?.length === 8 && Array.isArray(r.body.pipeline), JSON.stringify(r.body).slice(0, 200));
  r = await call('GET', '/reports', T); check('reports 30 rows', r.body.rows?.length === 30, JSON.stringify(r.body).slice(0, 300));
  r = await call('GET', '/reports?format=csv', T); check('reports CSV header', typeof r.body === 'string' && r.body.startsWith('date,new_accounts,new_listings,new_interests,new_cases,admin_actions') && r.body.trim().split('\n').length === 31, String(r.body).slice(0, 200));

  r = await call('GET', '/firms?limit=2', T); check('firms paginated', r.body.items.length === 2 && r.body.total === 6 && 'activeUsers' in r.body.items[0], JSON.stringify(r.body).slice(0, 300));
  const firmId = r.body.items[0].id;
  r = await call('GET', '/firms?q=sample', T); check('firms search', r.body.total === 1);
  r = await call('GET', '/firms?offset=5', T); check('firms offset', r.body.items.length === 1);
  for (const m of ['accounts', 'listings', 'cases', 'interests', 'documents', 'summaries', 'plans', 'announcements', 'imports', 'admins', 'audit']) {
    r = await call('GET', `/${m}`, T); check(`list ${m}`, r.status === 200 && Array.isArray(r.body.items), JSON.stringify(r.body).slice(0, 200));
  }
  r = await call('GET', '/documents', T); check('documents hide storage key', !JSON.stringify(r.body).includes('storage'));

  r = await call('POST', `/firms/${firmId}/action`, T, { action: 'suspend', reason: 'ok' }); check('reason < 5 chars rejected', r.status === 400);
  r = await call('POST', `/firms/${firmId}/action`, T, { action: 'suspend', reason: 'Fraud investigation' }); check('suspend needs elevation (428)', r.status === 428 && r.body.code === 'ELEVATION_REQUIRED');
  r = await call('POST', '/auth/elevate', T, { password: 'wrong-password' }); check('elevate rejects wrong password', r.status === 403);
  r = await call('POST', '/auth/elevate', T, { password: PW }); check('elevate ok', r.status === 200 && r.body.elevatedUntil, JSON.stringify(r.body));
  r = await call('POST', `/firms/${firmId}/action`, T, { action: 'suspend', reason: 'Fraud investigation' }); check('retry after elevation ok', r.status === 200 && r.body.suspended === true, JSON.stringify(r.body));
  r = await call('GET', '/listings', T); const listingId = r.body.items[0].id;
  r = await call('POST', `/listings/${listingId}/action`, T, { action: 'request_info', reason: 'Need documents', note: 'Please upload title deed' }); check('listing request_info', r.body.moderation === 'info_requested');
  r = await call('GET', '/cases', T); const caseId = r.body.items[0].id;
  r = await call('POST', `/cases/${caseId}/action`, T, { action: 'set_status', status: 'investigating', reason: 'Looking into it' }); check('case set_status', r.body.status === 'investigating');
  r = await call('POST', `/cases/${caseId}/action`, T, { action: 'add_note', note: 'Called seller', reason: 'Internal note' }); check('case add_note appended', r.body.staff_note?.includes('Called seller'));
  r = await call('GET', '/plans', T); const planId = r.body.items.find((p) => p.name === 'Enterprise').id;
  r = await call('POST', '/subscriptions/assign', T, { firm_id: firmId, plan_id: planId, reason: 'Upgrade requested' }); check('assign plan', r.status === 200 && r.body.plan_name === 'Enterprise', JSON.stringify(r.body));
  r = await call('POST', '/plans/save', T, { name: 'Growth', max_staff: 5, max_listings: 50, price_inr: 1999, active: true, reason: 'New tier' }); check('plan create', r.status === 200 && r.body.max_staff === 5, JSON.stringify(r.body));
  r = await call('POST', '/announcements/save', T, { title: 'Maintenance', body: 'Sunday 2am', audience: 'all', active: true, reason: 'Scheduled maintenance' }); check('announcement create', r.status === 200, JSON.stringify(r.body));
  r = await call('POST', '/settings', T, { ai_generation_enabled: true, reason: 'Enable AI' }); check('settings update', r.body.settings?.ai_generation_enabled === true && r.body.providers.length === 7, JSON.stringify(r.body));
  r = await call('GET', '/summaries', T); r = await call('POST', `/summaries/${r.body.items[0].id}/action`, T, { action: 'block', reason: 'Inaccurate text' }); check('summary block', r.body.blocked === true);

  r = await call('POST', '/imports/preview', T, { filename: 'bad.json', features: [{ plot_code: 'bad code' }] }); check('import rejects invalid plot code', r.body.status === 'failed' && r.body.errors[0].field === 'plot_code', JSON.stringify(r.body));
  r = await call('POST', `/imports/${r.body.id}/commit`, T, { reason: 'Commit attempt' }); check('failed import cannot commit (422)', r.status === 422);
  r = await call('POST', '/imports/preview', T, { filename: 'big.json', features: Array.from({ length: 101 }, (_, i) => ({ plot_code: `AB-${i}` })) }); check('import rejects >100 features', r.status === 400);
  r = await call('POST', '/imports/preview', T, { filename: 'ok.geojson', features: [{ type: 'Feature', properties: { plot_code: 'HYD-SKP-001', area_sqm: 250, district: 'Rangareddy' }, geometry: { type: 'Point', coordinates: [78.4, 17.4] } }, { plot_code: 'HYD-SKP-002' }] });
  check('import preview ok', r.body.status === 'validated' && r.body.rows.length === 2, JSON.stringify(r.body));
  const impId = r.body.id;
  r = await call('POST', `/imports/${impId}/commit`, T, { reason: 'Reference data load' }); check('import commit', r.status === 200 && r.body.created === 2, JSON.stringify(r.body));
  r = await call('POST', `/imports/${impId}/commit`, T, { reason: 'Reference data load' }); check('repeat commit rejected (409)', r.status === 409);

  r = await call('POST', '/admins/save', T, { name: 'New Mod', email: 'mod@example.test', role: 'moderator', password: 'another-long-passphrase', reason: 'Hiring moderator' }); check('admin create ok', r.status === 200 && r.body.admin?.email === 'mod@example.test', JSON.stringify(r.body));
  r = await call('GET', '/admins', T); const me = r.body.items.find((a) => a.email === SU);
  r = await call('POST', `/admins/${me.id}/action`, T, { action: 'deactivate', reason: 'Self lockout attempt' }); check('cannot deactivate self', r.status === 400);

  r = await call('POST', '/auth/login', null, { email: SP, password: PW }); const ST = r.body.token; check('support login', !!ST, JSON.stringify(r.body));
  for (const m of ['documents', 'summaries', 'audit', 'imports', 'admins']) { r = await call('GET', `/${m}`, ST); check(`support blocked from ${m}`, r.status === 403); }
  r = await call('POST', `/listings/${listingId}/action`, ST, { action: 'block', reason: 'Support tries block' }); check('support cannot write listings', r.status === 403);
  r = await call('POST', `/cases/${caseId}/action`, ST, { action: 'set_status', status: 'resolved', reason: 'Resolved by support' }); check('support can write cases', r.status === 200);
  r = await call('GET', '/overview', ST); check('support overview hides audit', r.body.recent_audit?.length === 0);

  r = await call('GET', '/audit?q=firms.suspend', T); check('audit captured suspend w/ reason', r.body.items[0]?.reason === 'Fraud investigation', JSON.stringify(r.body).slice(0, 300));
  r = await call('POST', '/auth/logout', T); check('logout', r.status === 200);
  r = await call('GET', '/auth/me', T); check('token invalid after logout', r.status === 401);
  console.log(`\n${pass} passed, ${fail} failed`);
})().catch((e) => { console.error(e); process.exit(1); });
