# Frontend integration guide (React Native + Expo)

The contract between the admin app and the NestJS API. Paths match the endpoints observed in the original APK
(`/api/platform/...`). Live interactive docs with every DTO: `http://<host>:3000/api/docs` (dev only).

## 1. Basics

| | |
|---|---|
| Base URL | `https://<backend-origin>/api` (HTTPS required in production; `http://10.0.2.2:3000/api` for Android emulator → local PC) |
| Auth header | `Authorization: Bearer <token>` |
| Versioning | Optional header `X-API-Version: 1`. Omitting it = v1. |
| Body | JSON (`Content-Type: application/json`) |
| Dates | ISO-8601 strings (UTC) |
| IDs | UUID strings |

Keep the token **in memory** (as the APK did), or in `expo-secure-store` if you need persistence. Never use AsyncStorage for the token.

## 2. Error format & status codes

```json
{ "statusCode": 400, "message": ["reason must be at least 5 characters"], "error": "Bad Request" }
```
`message` is a string or a string array (validation errors).

| Code | Meaning | Frontend behaviour |
|---|---|---|
| 400 | Validation failed / unsupported action | Show `message` in toast or form |
| 401 | Missing/expired/revoked session | Clear state → login screen |
| 403 | Role not allowed (or wrong password on `/auth/elevate`) | Toast; on elevate, let the user retry |
| 404 | Record not found | Retry panel / close drawer |
| 409 | Conflict (duplicate, already closed, import already committed) | Toast |
| 413 | Import payload > 750 KB | Toast |
| 422 | Import has validation errors, cannot commit | Toast |
| **428** | **Elevation required** (`code: "ELEVATION_REQUIRED"`) | Show a password modal → `POST /auth/elevate` → **retry the original request unchanged** |
| 429 | Rate limited | Toast "try again shortly" |

### Suggested API client with automatic 428 handling

```ts
// api/client.ts
let token: string | null = null;
export const setToken = (t: string | null) => { token = t; };

type ElevationPrompt = () => Promise<{ password: string } | null>;
let promptElevation: ElevationPrompt = async () => null;
export const registerElevationPrompt = (fn: ElevationPrompt) => { promptElevation = fn; };

export class ApiError extends Error {
  constructor(public status: number, public body: any) { super(Array.isArray(body?.message) ? body.message.join(', ') : body?.message ?? 'Request failed'); }
}

export async function api<T>(baseUrl: string, path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const res = await fetch(`${baseUrl}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  if (res.status === 428 && !retried) {
    const creds = await promptElevation();               // show modal
    if (!creds) throw new ApiError(428, await res.json());
    await api(baseUrl, '/platform/auth/elevate', { method: 'POST', body: JSON.stringify(creds) }, true);
    return api<T>(baseUrl, path, init, true);            // safe retry of the pending mutation
  }
  const isCsv = res.headers.get('content-type')?.includes('text/csv');
  const body = isCsv ? await res.text() : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
```

## 3. Authentication

### `POST /api/platform/auth/login` (public, 5 req/min)
```json
// request
{ "email": "admin@company.com", "password": "…" }
// 200
{
  "token": "opaque-string",
  "expiresAt": "2026-11-11T08:00:00.000Z",
  "user": { "id": "uuid", "name": "Admin", "email": "admin@company.com", "role": "super_admin" },
  "permissions": { "overview": "write", "reports": "write", "firms": "write", "...": "...", "admins": "write" }
}
```
Errors: 400 (malformed email), 401 (bad credentials or locked; message is generic on purpose).

### `GET /api/platform/auth/me`
Returns `{ user, permissions, session: { expiresAt, elevatedUntil } }`. Call on app resume to check the session is still valid.

### `POST /api/platform/auth/elevate`
`{ "password": "…" }` → `{ "elevatedUntil": "…" }` (10 min). Wrong credentials → **403** (not 401, so don't log out).

### `POST /api/platform/auth/logout`
→ `{ "ok": true }`. Then clear the token locally.

## 4. Role-aware navigation

Build the sidebar from `permissions` (each module is `"none" | "read" | "write"`):
- `none`: hide the module.
- `read`: show it, hide or disable action buttons and save forms.
- `write`: show actions.

| Module key | super_admin | moderator | support | auditor |
|---|---|---|---|---|
| overview, reports, firms, accounts, interests, plans, announcements, settings | write | read | read (interests: write) | read |
| listings, summaries, imports | write | write | listings: read; summaries/imports: none | read |
| cases | write | write | write | read |
| documents, audit | write/read | read | none | read |
| admins | write | none | none | none |

The server enforces all of this, so the UI only needs to mirror it.

## 5. List modules (common contract)

`GET /api/platform/{module}?q=&offset=0&limit=50`

`{module}` ∈ `firms, accounts, listings, cases, interests, documents, summaries, plans, announcements, imports, admins, audit`

```json
{ "items": [ ... ], "total": 137, "offset": 0, "limit": 50 }
```
- `limit` default 50, max 100. Next page: `offset += limit` while `offset + items.length < total`.
- Changing `q` → reset `offset` to 0. Changing module → reset `q` and scroll.
- `q` searches text columns. Pasting a UUID matches by id or related id.
- Detail drawer: `GET /api/platform/{module}/{id}` returns a single item with the same shape.

## 6. Record actions

`POST /api/platform/{module}/{id}/action`
```json
{ "action": "suspend", "reason": "At least five characters", "note": "optional", "status": "optional", "role": "optional" }
```
Returns the **updated record** (same shape as list items), so you can replace the row in place.

| Module | Actions | Extra fields | Elevation (428) |
|---|---|---|---|
| firms | `suspend`, `restore` | – | suspend |
| accounts | `enable`, `disable`, `revoke_sessions` | – | disable, revoke_sessions |
| listings | `block`, `mark_reviewed`, `request_info` | `note` required for request_info | – |
| cases | `set_status`, `add_note` | `status` ∈ open/investigating/resolved/dismissed; `note` for add_note | – |
| interests | `close` | – | – |
| summaries | `approve`, `block`, `unblock` | – | – |
| admins | `activate`, `deactivate`, `set_role`, `revoke_sessions`, `unlock` | `role` for set_role | all |

Exception: **admins** actions return `{ admin }` instead of the bare record.

## 7. Module-specific endpoints

| Method & path | Body | Response |
|---|---|---|
| `GET /platform/overview` | – | `{ kpis: [{key,label,value}×8], pipeline: [{stage,count}], recent_audit: [...] }` |
| `GET /platform/reports?days=30` | – | `{ days, rows: [{date,new_accounts,new_listings,new_interests,new_cases,admin_actions}] }` |
| `GET /platform/reports?days=30&format=csv` | – | `text/csv` file (save with `expo-file-system` + `expo-sharing`) |
| `POST /platform/plans/save` 🔒 | `{id?, name, max_staff, max_listings, price_inr, active, reason}` | plan |
| `POST /platform/subscriptions/assign` 🔒 | `{firm_id, plan_id, reason}` | `{id, firm_id, plan_id, plan_name, active, starts_at}` |
| `POST /platform/announcements/save` | `{id?, title, body, audience: all\|buyers\|sellers\|firms, active, reason}` | announcement |
| `GET /platform/settings` | – | `{ settings: {publication_enabled, registration_enabled, ai_generation_enabled, updated, updated_by}, providers: [{key,label,provider,configured,connectivity}] }` |
| `POST /platform/settings` 🔒 | any of `{publication_enabled, registration_enabled, ai_generation_enabled}` + `reason` | same as GET |
| `POST /platform/admins/save` 🔒 | create: `{name, email, role, password(≥12), reason}` · update: `{id, name, role, reason}` | `{ admin }` |
| `POST /platform/imports/preview` | `{filename?, features: [...1-100]}` | import with `rows` + `errors` |
| `GET /platform/imports/{id}` | – | import with `rows` + `errors` |
| `POST /platform/imports/{id}/commit` 🔒 | `{reason}` | `{id, status:"committed", created, updated, committed}`. A repeat commit returns 409. |

🔒 = needs elevation (expect 428 on the first try).

## 8. Response shapes (list items)

```ts
type Firm = { id; name; activeUsers: number; listings: number; suspended: boolean; suspended_at; plan: {id; name} | null; created };
type Account = { id; name; email; role: 'buyer'|'seller'; firm_id; active; sessions_revoked_at; last_login; created };
type Listing = { id; title; firm_id; firm_name; type; city; price: number; version; latitude; longitude; sellerPublished: boolean;
                 moderation: 'pending'|'reviewed'|'blocked'|'info_requested'; moderation_note; created; updated };
type Case = { id; property_id; property_title; reporter_id; category; description; report; status; staff_note; created; updated };
type Interest = { id; property_id; property_title; buyer_id; status: 'open'|'closed'; stage; messages: number /* count only */; site_visit_at; closed_at; created };
type Document = { id; firm_id; property_id; label; mime; size: number /* bytes */; created };
type Summary = { id; property_id; source_version; language; kind; summary; approved; blocked; created; updated };
type Plan = { id; name; max_staff; max_listings; price_inr; active; created; updated };
type Announcement = { id; title; body; audience; active; created; updated };
type Import = { id; filename; status: 'validated'|'failed'|'committed'; features; valid; invalid; created; committed;
                rows?: ParcelRow[]; errors?: {index; field; message}[] };
type Admin = { id; name; email; role; active; locked: boolean; last_login; created };
type Audit = { id; admin_id; admin /* email */; role; module; action; target_id; reason; metadata; ip; created };
```

## 9. Import workflow (client side)

1. Pick the file with `expo-document-picker`. Reject anything ≥ 750 KB before reading it.
2. `JSON.parse` it. Use the array itself, or `obj.features` for GeoJSON FeatureCollections.
3. Check it has 1–100 items, then `POST /imports/preview { filename, features }`.
4. Show `rows` (valid) and `errors` (`{index, field, message}`). Enable **Commit** only when `status === "validated"`.
5. `POST /imports/{id}/commit { reason }` (expect 428 → elevate → retry).

Permitted fields: `plot_code, plot_no, lu_desc, extn_sqyrd, area_sqm, rd_width_m, district, mandal, village, rs_no, zoning, latitude, longitude`
(GeoJSON `Point` coordinates are used when latitude/longitude are absent). Unknown fields are dropped.

## 10. Reference implementation

The production app in [`../../frontend`](../../frontend) implements this whole contract (iOS, Android, web).
It has no demo mode and no local sample data; it only talks to this API. Start with
`frontend/src/api/client.ts` (428 handling) and `frontend/src/api/endpoints.ts`.

## 11. Local testing tips

- Android emulator → PC: `http://10.0.2.2:3000`. Physical device: your PC's LAN IP (same Wi-Fi).
- HTTP is fine against a local dev server. Use HTTPS everywhere else.
