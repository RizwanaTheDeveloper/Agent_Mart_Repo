# Agent Mart | Platform Admin — App

React Native + Expo (SDK 58) + TypeScript. One codebase runs on **Android, iOS, tablets and the web**, and the layout adapts to each screen size:

| Width | Layout |
|---|---|
| < 1024 px (phones, portrait tablets) | Top bar with a menu button that opens a slide-out drawer. Record details open as a bottom sheet (phones) or a centred dialog (tablets). |
| ≥ 1024 px | Fixed sidebar. Record details open in a dialog. |
| ≥ 1280 px | Fixed sidebar, with record details in a side panel next to the list. |

Light and dark mode follow the device setting.

The app talks only to the real backend in `../backend`. There is no offline mode and no built-in sample data.

## Run locally

```powershell
# 1. Start the backend first (see ../backend/README.md)
cd frontend
npm install
copy .env.example .env      # set EXPO_PUBLIC_API_URL if the API is not on localhost:3000

npm run web                 # browser
npm run android             # Android emulator / device (Expo Go or dev build)
npm run ios                 # iOS simulator (macOS only)
```

| Where the app runs | `EXPO_PUBLIC_API_URL` |
|---|---|
| Browser on the same PC | `http://localhost:3000` |
| Android emulator | `http://10.0.2.2:3000` |
| Physical phone (same Wi-Fi) | `http://<PC LAN IP>:3000`, and allow port 3000 in the Windows firewall |

For the web app, also add its origin to the backend's `CORS_ORIGINS`, for example `http://localhost:8081`.

## Production builds

- **Web:** run `npm run build:web`, which writes a static site to `dist-web/`. Host it on any static host or CDN. If you serve it from the API's domain, `EXPO_PUBLIC_API_URL` can be left unset.
- **Android / iOS:** use EAS. First replace the placeholder URLs in [eas.json](eas.json) with your real HTTPS API addresses, then run:
  ```powershell
  npx eas-cli@latest build --profile production --platform android   # or ios / all
  npx eas-cli@latest submit --profile production
  ```
  Bundle IDs are `com.agentmart.platformadmin` (iOS and Android) and are set in [app.json](app.json).
- `EXPO_PUBLIC_API_URL` is compiled into the app, so you need a new build each time it changes. Production builds must use HTTPS.

## Scripts

| Script | Purpose |
|---|---|
| `npm run web` / `android` / `ios` | Start the dev server for that platform |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run doctor` | `expo-doctor` (dependency and config checks) |
| `npm run build:web` | Static production web build |

## Folder structure

```
frontend/
├── App.tsx                     # Providers + auth gate + module router
├── app.json / eas.json         # Expo + EAS build config (bundle IDs, plugins, env per profile)
└── src/
    ├── config.ts               # API URL + limits (page size, 750 KB, 100 features, reason ≥ 5)
    ├── api/
    │   ├── client.ts           # fetch wrapper: bearer token, timeouts, error mapping, automatic 428 → confirm → retry
    │   ├── endpoints.ts        # Every backend endpoint, typed
    │   └── types.ts            # Response shapes (mirror the backend map*() functions)
    ├── state/
    │   ├── auth.tsx            # Session: login, restore, expiry timer, revalidate on resume, logout
    │   ├── elevation.tsx       # Global "Confirm it's you" (password) modal for HTTP 428
    │   └── toast.tsx           # Notifications
    ├── navigation/
    │   ├── AppShell.tsx        # Sidebar (desktop) / drawer (phone), top bar, account menu
    │   ├── modules.ts          # 15 modules: label, icon, group
    │   └── useModuleRoute.ts   # Current module; mirrored to URL hash on web, Android back button
    ├── resources/              # Shared list → detail → action engine
    │   ├── ResourceScreen.tsx  # Search, pagination, pull-to-refresh, detail panel/sheet
    │   ├── ActionDialog.tsx    # Audited action with reason / note / status / role
    │   ├── configs.tsx         # Per-module rows, detail fields and actions (edit here to change UI)
    │   ├── forms.tsx           # Plan, announcement and administrator create/edit forms
    │   ├── FirmPlan.tsx        # Plan assignment on the firm detail
    │   └── Imports.tsx         # File/paste → validate → review errors → commit
    ├── screens/                # Login, Overview, Reports (chart/table/CSV), Settings
    ├── components/             # UI kit, reason field
    ├── theme/theme.ts          # Colours (light/dark), spacing, breakpoints
    └── utils/                  # Formatting (en-IN, ₹), secure token storage, file pick/save
```

## Security behaviour

- **Token storage:** the session token is kept in the iOS Keychain / Android Keystore (`expo-secure-store`), or in `sessionStorage` on the web, where it is cleared when the tab closes. It is never written to AsyncStorage.
- **Session expiry:** sessions follow the server's 2-hour expiry. The app warns 5 minutes before expiry, signs out when the session expires, and re-checks the session whenever it returns from the background.
- **Sensitive actions:** these get a 428 response from the server. The app shows a password prompt and then retries the original request unchanged.
- **Permissions:** navigation, buttons and forms follow the `permissions` the server returns. The server enforces them independently, so the UI is only a convenience.
- **Audit reason:** every change asks for a reason of at least 5 characters, which is stored in the audit log.

> **Note:** sign-in and elevation use password only, with no second factor (authenticator code). This was removed at
> the user's request; see the note in `../backend/README.md` for what that means and how to restore it.
