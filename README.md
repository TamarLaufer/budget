# Spendo — shared household budget

A Hebrew (RTL), Android-first budgeting app for a shared household. Two or more people sign in with
their own accounts, join the same household, and see the same transactions, categories, monthly
budgets and totals. Every transaction records who created it.

| Part | Stack |
| --- | --- |
| Mobile app (repo root) | Expo SDK 57, React Native 0.86, TypeScript (strict), Expo Router, Redux Toolkit, Reanimated, styled-components |
| Backend (`server/`) | Node.js 22+/24, Express 5, TypeScript (strict), Zod, Helmet, express-rate-limit, pino |
| Database | PostgreSQL + Prisma 7 (migrations in `server/prisma/migrations`) |
| Identity | Firebase Authentication (email/password) — **identity only**, no app data in Firebase |
| Shared contract | `shared/api.ts` (DTO types) and `shared/limits.ts`, used by both packages |

## Architecture

```text
┌──────────── Android app ────────────┐        HTTPS + Bearer <Firebase ID token>        ┌────────── API (server/) ──────────┐
│ Firebase JS SDK (sign-in, token)    │ ───────────────────────────────────────────────▶ │ authenticate → requireHousehold → │
│ api/client.ts (token injection,     │                                                   │ requireRole → controller →        │
│   401 refresh+retry, timeouts)      │ ◀─────────────── JSON / {error:{code,message}} ── │ service → repository (Prisma)     │
│ Redux slices = working copies       │                                                   └───────────────┬───────────────────┘
│ selectors = all derived money math  │                                                                   │
└─────────────────────────────────────┘                                                           PostgreSQL (source of truth)
```

- **PostgreSQL is the source of truth.** Redux holds working copies. Mutations apply the server's
  response (POST → add returned record, PATCH → replace, DELETE → remove); no refetch after each write.
- **Derived values are never stored.** Spending per category, remaining, percent used, fill and
  over-budget state are computed by pure functions (`src/budget/calculations.ts`) through memoized
  selectors (`src/store/selectors.ts`) from the month's real transactions and budgets.
- **Money is integer agorot everywhere** (₪87.90 = `8790`): DB `INTEGER` columns with CHECK
  constraints, `z.number().int()` on the API, and text-based parsing of user input
  (`parseShekelInput`) so no floating-point arithmetic ever touches an amount.
- **Months are calendar months.** Transaction dates are `DATE` columns (`YYYY-MM-DD`); a budget is
  unique per household + category + year + month, so changing October never touches September.
- **Animations are UI state only** (Reanimated shared values in `ProgressBar`/`CategoryCard`);
  they read values from Redux selectors and never feed back into financial state.

### Backend layout (`server/src`)

| Folder | Responsibility |
| --- | --- |
| `routes/` | Route table and middleware wiring (HTTP concerns only) |
| `controllers/` | Parse/validate the request with Zod, call a service, map the response |
| `services/` | Business rules and permission checks |
| `repositories/` | All Prisma access; every household query takes `householdId` explicitly |
| `middleware/` | `authenticate`, `requireHousehold`/`requireRole`, rate limits, central error handler |
| `validators/` | Strict Zod schemas (unknown keys are rejected) |
| `config/` | Env parsing, Firebase Admin verifier, logger |
| `utils/` | Errors, date helpers, DTO serializers |

### Frontend layout (`src`)

| Folder | Responsibility |
| --- | --- |
| `app/` | Expo Router routes only (thin files); `_layout.tsx` holds the session-based route guards |
| `screens/` | Screen components |
| `components/` | Reusable UI (existing `BudgetSummary`, `CategoryCard`, `ProgressBar`, `Header` + `ui/` kit) |
| `store/` | Redux Toolkit slices, thunks and selectors |
| `api/` | HTTP client, typed endpoints, error-code → Hebrew message mapping |
| `auth/` | Firebase initialization (AsyncStorage persistence) and session wiring |
| `budget/` | Pure domain logic: money, periods, calculations, form validation, filters |
| `practice/` | Reanimated practice components (reachable from Settings in dev builds only) |

## Security model

1. **Authentication** — every `/api/*` request must carry `Authorization: Bearer <Firebase ID token>`.
   `server/src/middleware/authenticate.ts` verifies it on *every* request with Firebase Admin
   (signature, issuer, audience, expiry, and revocation when `FIREBASE_CHECK_REVOKED=true`), then maps
   the Firebase uid to the PostgreSQL user (created on first sign-in). The app's token comes from the
   Firebase SDK, which refreshes it automatically; after a 401 the client force-refreshes once and retries.
2. **Household authorization** — `requireHousehold` loads the caller's membership from the database.
   The household is **never** taken from the request: all request schemas are strict, so a
   `householdId`/`userId` in a body or query string is rejected with 400, and every repository
   query is scoped by the membership's `householdId`. Another household's record ids return 404.
3. **Roles** — OWNER / ADMIN / MEMBER:

   | Action | OWNER | ADMIN | MEMBER |
   | --- | :-: | :-: | :-: |
   | View household data, add transactions | ✓ | ✓ | ✓ |
   | Edit/delete own transactions | ✓ | ✓ | ✓ |
   | Edit/delete others' transactions | ✓ | ✓ | |
   | Manage categories, budgets, payment methods, household name | ✓ | ✓ | |
   | Invite MEMBER / revoke invitations | ✓ | ✓ | |
   | Invite ADMIN, change roles, remove members | ✓ | | |
   | Leave the household | | ✓ | ✓ |

4. **Invitations require a verified email.** Firebase lets anyone register an unverified account for
   any address, so accepting/declining/listing invitations requires `email_verified` in the token.
   The app sends a verification email on registration.
5. **Integrity in the database too** — unique `HouseholdMember.userId` (one household per user),
   a partial unique index allowing one pending invitation per email per household, CHECK constraints
   on amounts/months/roles, and transactional creation/acceptance so races cannot create duplicates.
6. **Hardening** — Helmet headers, CORS closed by default (native apps need none), per-IP API rate
   limit plus a per-user invitation limit, 100 kB JSON body limit, consistent error format, no stack
   traces or internal messages in responses (logged server-side with the Authorization header redacted).
7. **Secrets** — `.env`, service-account JSON and keystores are git-ignored. The app only contains the
   public Firebase web config (`EXPO_PUBLIC_*`); Firebase Admin credentials exist only on the server.

### Decisions worth knowing

- **Expo Router** (built on React Navigation) is used for navigation, as required by `AGENTS.md`.
- **One household per user** (MVP): enforced by a unique constraint; drop it later to allow several.
- **Categories and payment methods are deactivated, not deleted**, so history keeps its references.
  Inactive categories still appear on a month's dashboard if that month has a budget or spending.
- **Invitation delivery**: the API creates the invitation; the invitee sees it after signing in with
  that (verified) email. No email is sent by the backend in this MVP — tell your partner to sign up.
- **Offline**: no offline sync. Requests fail with a clear message, and the add/edit form keeps every
  value after a failed save so nothing typed is lost.

## Local development

### Prerequisites

- Node.js 24 LTS (22.18+ works) and npm
- A Firebase project with **Email/Password** sign-in enabled
- For Android: JDK 17, Android SDK (`ANDROID_HOME`), a device with USB debugging or an emulator
- PostgreSQL is **not** required locally: `npm run db:local` runs a real PostgreSQL from npm binaries.

### 1. Install

```bash
npm ci                    # app
npm --prefix server ci    # API (also generates the Prisma client)
```

### 2. Configure

```bash
cp .env.example .env                  # app: API URL + Firebase web config
cp server/.env.example server/.env    # API: DATABASE_URL, FIREBASE_PROJECT_ID, ...
```

- App `.env`: Firebase console → Project settings → *Your apps* → Web app → config values.
  `EXPO_PUBLIC_API_URL` is `http://10.0.2.2:3000` for the emulator, or `http://<PC LAN IP>:3000` for a phone.
- Server `.env`: `FIREBASE_PROJECT_ID` is enough to verify tokens. For revocation checks
  (`FIREBASE_CHECK_REVOKED=true`, the default) also provide a service account: Firebase console →
  Project settings → Service accounts → *Generate new private key*, store the JSON **outside the repo**,
  and set `GOOGLE_APPLICATION_CREDENTIALS` to its path (or `FIREBASE_SERVICE_ACCOUNT_BASE64`).

### 3. Database

```bash
npm --prefix server run db:local           # terminal 1: PostgreSQL on :54320 (data in server/.local-db)
npm --prefix server run db:migrate:deploy  # apply migrations to budget_dev
npm --prefix server run db:seed            # optional: sample categories for households that have none
```

Changing the schema: edit `server/prisma/schema.prisma`, then
`npm --prefix server run db:migrate:dev -- --name <change>` and commit the new migration folder.

### 4. Run

```bash
npm --prefix server run dev     # API on http://localhost:3000 (GET /health)
npx expo run:android            # first time, or after adding native modules (development build)
npx expo start --dev-client     # daily: JS reloads without rebuilding
```

The app uses native modules (Reanimated, date picker, AsyncStorage), so it needs a development
build; Expo Go is not supported.

## Verification

| Command | What it runs |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` for app and server |
| `npm run lint` | ESLint for app and server, zero warnings allowed |
| `npm run test:frontend` | Jest: calculations, money parsing, periods, form validation, filters, reducers, selectors, API client, `TransactionForm` |
| `npm run test:backend` | Vitest unit + integration |
| `npm run test:unit` | Frontend tests + backend unit tests |
| `npm run test:integration` | Backend REST tests against a real PostgreSQL |
| `npm run verify` | typecheck → lint → unit → integration; non-zero exit on any failure |

**Test database.** Integration tests never touch your dev or production data. If
`DATABASE_URL_TEST` is set (CI, or the `budget_test` database of `db:local`) it is used; otherwise a
throwaway embedded PostgreSQL is started in a temp directory and deleted afterwards. The setup
refuses any database whose name does not contain `test`, and refuses `DATABASE_URL_TEST == DATABASE_URL`.
Each test starts from truncated tables. Firebase is replaced by an injected fake verifier, so tests
need no real Firebase users.

CI (`.github/workflows/ci.yml`) runs the same steps on pushes and pull requests with a PostgreSQL
service container. It needs no secrets and deploys nothing.

Manual end-to-end checks: [docs/acceptance-checklist.md](docs/acceptance-checklist.md).

## Production deployment (backend)

Requirements:

- **PostgreSQL 14+ with UTF-8 encoding** (Hebrew text). Managed options: Neon, Supabase, Render, RDS.
- **A Node host with HTTPS** (Render, Railway, Fly.io, Cloud Run, a VM behind a TLS proxy).
  Android release builds refuse plain HTTP unless the build's API URL is `http://`, and production must be `https://`.
- Environment (see `server/.env.example`): `NODE_ENV=production`, `DATABASE_URL`,
  `FIREBASE_PROJECT_ID`, and `FIREBASE_SERVICE_ACCOUNT_BASE64` (or `GOOGLE_APPLICATION_CREDENTIALS`)
  for revocation checks. Set `TRUST_PROXY=1` when behind one load balancer so rate limiting sees client IPs.
  Use the host's secret store; never commit these values.

Deploy steps (from `server/`):

```bash
npm ci
npm run build                 # tsc → dist/
npm run db:migrate:deploy     # apply committed migrations (never `prisma db push` in production)
npm start                     # node dist/server/src/index.js
```

Health checks: `GET /health` (process) and `GET /health/ready` (database). The server shuts down
gracefully on SIGTERM. Do not run `db:seed` in production (it refuses to).

## Android APK (direct install, not Play Store)

### Option A — EAS Build in the cloud (recommended)

EAS creates and stores the release signing keystore for you, so no key ever touches the repo.

```bash
npx eas-cli@latest login
npx eas-cli@latest init                          # links the project; adds the projectId to app config

# Public build-time config for the "preview" environment used by the preview profile:
npx eas-cli@latest env:set --environment preview --visibility plaintext --name EXPO_PUBLIC_API_URL --value https://api.your-domain.example
npx eas-cli@latest env:set --environment preview --visibility plaintext --name EXPO_PUBLIC_FIREBASE_API_KEY --value <web api key>
npx eas-cli@latest env:set --environment preview --visibility plaintext --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value <project>.firebaseapp.com
npx eas-cli@latest env:set --environment preview --visibility plaintext --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value <project id>
npx eas-cli@latest env:set --environment preview --visibility plaintext --name EXPO_PUBLIC_FIREBASE_APP_ID --value <app id>

npx eas-cli@latest build --platform android --profile preview   # → signed, installable .apk
```

When the build finishes, open the link on the phone (or download the `.apk`) and install it, or:

```bash
adb install path/to/build.apk
```

Answer **yes** when EAS offers to generate a new Android keystore on the first build. Back it up with
`npx eas-cli@latest credentials -p android`. The same key must sign every future update.
Profiles in `eas.json`: `development` (dev client APK), `preview` (release APK for testers),
`production` (AAB for a future Play Store release).

### Option B — local build on this PC

```bash
npx expo prebuild --platform android --clean     # generates android/ (git-ignored, never edit by hand)
cd android
./gradlew assembleRelease                        # Windows: gradlew.bat assembleRelease
adb install app/build/outputs/apk/release/app-release.apk
```

The `EXPO_PUBLIC_*` values from `.env` are compiled in. Without extra setup the local release APK is
signed with the **debug** key, which is fine for installing on your own phone but not for distribution.
For a properly signed local APK, follow
[Create a release build locally](https://docs.expo.dev/guides/local-app-production/): generate an
upload keystore with `keytool`, keep it and its passwords **outside the repository**
(for example in `~/.gradle/gradle.properties`), and configure `signingConfigs` after prebuild.

### App identity

- Name: **Spendo** (`app.json` → `expo.name`); Android package: `com.tamarlaufer.spendo`.
  The package id is permanent once the app is published, so change it now if you prefer another.
- Bump `expo.version` for user-visible releases; EAS manages `versionCode` remotely
  (`appVersionSource: remote`, `autoIncrement` in the production profile).

## Windows build paths

**Known issue:** a local `gradlew assembleRelease` of this project from
`C:\Users\...\Documents\tamar\projects\budget` failed in the native C++ steps of
`expo-modules-core` and `react-native-reanimated` with
`ninja: error: manifest 'build.ninja' still dirty after 100 tries`. It is a Windows CMake/ninja
problem tied to long project paths, not an app error. EAS Build (Linux) is not affected. For local
native builds, clone the repo to a short path such as `C:\Dev\spendo`, run `npm ci` there, and delete
any `android/.cxx` folders before rebuilding.

Some Android native build tools also have problems with non-ASCII characters in paths. Prefer locations
such as `C:\Dev\budget-app` for the project and `C:\Android\Sdk` for the SDK. If build errors show
corrupted characters in paths under your user directory, set an ASCII-only Gradle home:

```powershell
$env:GRADLE_USER_HOME = "C:\GradleCache"
[Environment]::SetEnvironmentVariable("GRADLE_USER_HOME", "C:\GradleCache", "User")
```
