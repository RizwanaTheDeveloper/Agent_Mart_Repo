# Agent Mart | Platform Admin — Backend

NestJS + TypeScript REST API · PostgreSQL · Prisma ORM.
Implements the 15 admin modules, password auth, role permissions, HTTP 428 step-up re-auth,
mandatory audit reasons, CSV reports and the parcel-reference import workflow from the handover spec.

> The app lives in [../frontend](../frontend). Frontend developers: read **[docs/FRONTEND_INTEGRATION.md](docs/FRONTEND_INTEGRATION.md)** for the API contract.

## Quick start (local)

Prerequisites: Node 20+ and PostgreSQL 14+ (or Docker, or neither — see below).

```powershell
cd backend
npm install

# 1. Database - Docker...
docker compose up -d
# ...your own PostgreSQL (point DATABASE_URL in .env at it)...
# ...or no install at all:
npm run dev:db
#   Runs a real PostgreSQL inside node_modules, data kept in .devdb/ (gitignored).
#   Local development only. Defaults to port 5433 so it never collides with a system
#   PostgreSQL on 5432. Leave it running in its own terminal; Ctrl+C stops it cleanly.

# 2. Environment
copy .env.example .env

# 3. Schema + seed (settings row + subscription plans). Set SEED_DEMO_DATA=true only on a local dev DB to load fictional test records.
npx prisma migrate deploy
npm run db:seed

# 4. Create your first administrator (there is NO default password)
$env:ADMIN_EMAIL="you@company.com"; $env:ADMIN_NAME="Your Name"; $env:ADMIN_PASSWORD="a-long-passphrase-12+"; npm run admin:create

# 5. Run
npm run start:dev
```

- API base: `http://localhost:3000/api`
- Swagger UI (dev only): `http://localhost:3000/api/docs`
- Health: `GET /api/health`

## Scripts

| Script | Purpose |
|---|---|
| `npm run start:dev` | Watch mode |
| `npm run build` / `start:prod` | Compile to `dist/` and run |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (role matrix, import validator) |
| `npm run test:e2e` | Smoke test of all spec acceptance scenarios against a running dev server (mutates data) |
| `npm run prisma:migrate` | Create a new migration after editing `schema.prisma` |
| `npm run prisma:deploy` | Apply migrations (CI / production) |
| `npm run prisma:studio` | Browse the DB |
| `npm run db:seed` | Seed settings + plans (test records only if SEED_DEMO_DATA=true, refused in production) |
| `npm run admin:create` | Bootstrap an administrator |
| `npm run dev:db` | Self-contained local PostgreSQL, no install required (port 5433, data in `.devdb/`) |

## Folder structure

```
backend/
├── prisma/
│   ├── schema.prisma            # All tables, enums, relations
│   ├── migrations/              # Generated SQL migrations (commit these)
│   ├── seed.ts                  # Plans, settings row, fictional demo data
│   └── scripts/
│       └── create-admin.ts      # Bootstrap the first administrator
├── src/
│   ├── main.ts                  # Bootstrap: helmet, CORS, /api prefix, versioning, validation, Swagger
│   ├── app.module.ts            # Module wiring + global guards (throttle → auth → permissions)
│   ├── config/env.validation.ts # Typed + validated environment variables
│   ├── prisma/                  # PrismaService (global)
│   ├── common/
│   │   ├── auth/                # AdminContext type, 428 ElevationRequiredException
│   │   ├── decorators/          # @Public @AuthenticatedOnly @RequirePermission @RequiresElevation @CurrentAdmin
│   │   ├── guards/              # SessionAuthGuard (bearer token), PermissionsGuard (role matrix + elevation)
│   │   ├── permissions/         # ROLE MATRIX - single source of truth for access control
│   │   ├── security/            # Session token hashing
│   │   ├── dto/                 # ListQueryDto (q/offset/limit), ActionDto (action + reason)
│   │   ├── filters/             # Prisma error → HTTP mapping
│   │   ├── middleware/          # Optional HTTPS enforcement
│   │   └── utils/               # Pagination envelope, search helpers
│   └── modules/
│       ├── auth/                # login, logout, elevate, me
│       ├── overview/            # 8 KPIs, interest pipeline, recent audit
│       ├── reports/             # 30-day daily activity, JSON or CSV
│       ├── firms/               # list/detail, suspend/restore
│       ├── subscriptions/       # manual plan assignment to firms
│       ├── accounts/            # buyer/seller accounts, enable/disable/revoke sessions
│       ├── listings/            # moderation: block / mark_reviewed / request_info
│       ├── cases/               # buyer reports: set_status / add_note
│       ├── interests/           # enquiry/site-visit metadata, close
│       ├── documents/           # encrypted document METADATA only (read-only)
│       ├── summaries/           # AI text: approve / block / unblock
│       ├── plans/               # create/edit plans
│       ├── announcements/       # create/edit notices
│       ├── imports/             # preview (validate) → commit parcel references
│       ├── settings/            # platform flags + provider status
│       ├── admins/              # super-admin-only admin management
│       ├── audit/               # append-only audit log (global AuditService)
│       └── health/              # liveness + DB check
├── test/smoke.e2e.js            # Acceptance-scenario smoke test
├── docs/FRONTEND_INTEGRATION.md # API contract for the React Native / Expo app
├── docker-compose.yml           # Local PostgreSQL 16
└── .env.example
```

Each feature module follows the same pattern: `*.controller.ts` (routes + permission decorators) →
`*.service.ts` (business logic, Prisma transaction, audit write) → `map*()` function (the exact JSON shape
the frontend receives). To change a response field, edit the `map*()` function.

## Security model (what the server enforces)

- **Auth**: email + password (bcrypt), no second factor. 5 failed attempts → 15-minute lock. Login is rate-limited (5/min/IP).
- **Sessions**: opaque 256-bit bearer token, only its SHA-256 is stored; absolute expiry `SESSION_TTL_MINUTES` (120). Logout revokes server-side.
- **Authorization**: every route is mapped to a module + read/write in [permissions.ts](src/common/permissions/permissions.ts). Routes without a mapping are denied by default.
- **Elevation (HTTP 428)**: sensitive mutations need a password re-auth within `ELEVATION_TTL_MINUTES` (10): firm suspend, account disable/revoke sessions, plan save, plan assignment, import commit, settings, everything under admins.
- **Audit**: every mutation requires `reason` (≥ 5 chars) and writes an audit row in the **same transaction** as the change. Logins, failed logins, elevation and logout are audited too.
- **Data minimisation**: document storage keys/bytes, password hashes and private message bodies are never returned.

> **Note:** the handover spec called for password + a 6-digit authenticator (TOTP) code on login and elevation. That
> second factor was removed at the user's request. An account that is compromised (password reused, phished, guessed)
> now has no second check standing between an attacker and `super_admin` access. This folder is not yet under version
> control, so nothing is recoverable automatically if you want the second factor back later; re-adding it means
> writing a TOTP secret store (encrypted at rest), a verify/replay-guard step in login and elevate, new columns on
> `Admin`, and a setup UI in the app.

## Open items to confirm with product owner

These come from the spec's "not confirmed" list. The code has reasonable defaults that are easy to change.

1. **Plot code regex**: set `PLOT_CODE_REGEX` to the exact pattern in the APK's `assets/app.js`.
2. **Response field names**: mappers use the field names observed in the spec. If the frontend's `app.js` expects other names, change the `map*()` functions.
3. **Foreign keys / business rules** (spec section 7 says these are inferences): e.g. whether a listing must belong to a firm.
4. **Marketplace integration**: `accounts.sessions_revoked_at` must be honoured by the buyer/seller app's auth; settings flags must be read by the marketplace backend.
5. **Audit retention policy**: no automatic purge yet. Add a scheduled job once retention is decided.
6. **Provider integrations** (AI, storage, payments, push, title): only "configured" flags are reported, with no connectivity checks.

## Production checklist

- `NODE_ENV=production`, `REQUIRE_HTTPS=true`, run behind a TLS-terminating proxy (trust proxy is set to 1 hop).
- `npm run build && npx prisma migrate deploy && npm run start:prod`.
- Swagger is automatically disabled in production.
- Set `CORS_ORIGINS` only if you ship an Expo **web** build (native apps don't send an Origin header).
