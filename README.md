# My Budget

A personal budgeting app built with React Native, Expo, and TypeScript. The goal is to track expenses, set monthly budgets by category, and clearly identify where spending exceeds the plan.

The app is being developed as a practical project covering mobile development, a custom Node.js backend, application security, animations, and automated delivery.

> **Current status:** The monthly budget dashboard runs on an Android development build with sample data. Expense entry, persistence, authentication, the backend, animations, and CI/CD are planned.

## Current Features

- Monthly overview with total budget, spending, and remaining balance.
- Category cards showing budget, spending, remaining balance, and overspending.
- Progress indicators capped visually at 100%, while retaining the actual spending percentage.
- Overspending indicated with text and color.
- Amounts stored as integer agorot and formatted as Israeli shekels.
- Hebrew interface with layouts adapting to the device's text direction.
- Safe-area handling for system bars and screen cutouts.
- Shared colors, spacing, typography, and reusable UI components.

The displayed month is currently a label. Calculations use the supplied category data; they do not yet filter individual expenses by date.

## Tech Stack

| Area | Technology |
| --- | --- |
| Mobile app | React Native and Expo |
| Language | TypeScript |
| Development environment | Expo development build with `expo-dev-client` |
| Layout and styling | React Native `StyleSheet` and a shared theme |
| Safe areas | `react-native-safe-area-context` |
| Package management | npm |
| Code checks | TypeScript and ESLint |
| Planned backend | Node.js |
| Planned animations | React Native Reanimated |

Dependency versions are defined in `package.json` and locked in `package-lock.json`.

## Getting Started

### Prerequisites

For local Android development:

- Node.js LTS and npm.
- JDK 17.
- Android Studio with the Android SDK and build tools required by the project's Expo / React Native versions.
- `ANDROID_HOME` pointing to your Android SDK.
- Android SDK `platform-tools` available on your `Path`.
- An Android device with USB debugging enabled, connected using a data-capable USB cable.

Verify your tools and device:

```powershell
node -v
java -version
javac -version
adb version
adb devices
```

The device should appear with the status `device`. Accept the USB debugging prompt on the phone when requested.

### Install Dependencies

From the repository root:

```bash
npm ci
```

### Build and Install the Android Development App

```bash
npx expo run:android --device
```

This builds the native Android app, installs it on the selected device, and starts Metro. The first build can take longer because build tools and dependencies may need to download.

### Daily Development

Once the development build is installed:

```bash
npx expo start --dev-client
```

Press `a` in the terminal to open the app on the connected Android device.

JavaScript / TypeScript changes can be served through Metro without rebuilding the native app. Rebuild when adding native dependencies or changing native configuration.

### Code Checks

```bash
npx tsc --noEmit
npm run lint
```

These commands check types and lint rules. They do not replace testing the app on a device or testing its behavior.

## Code Organization

| File or directory | Responsibility |
| --- | --- |
| `App.tsx` | App entry point, safe-area provider, and initial data passed to the screen |
| `src/theme.ts` | Shared visual design values |
| `src/budget/money.ts` | Money conversion and display formatting |
| `src/budget/types.ts` | Budget data types |
| `src/budget/sampleData.ts` | Demo category data |
| `src/budget/calculations.ts` | Budget calculations and month formatting |
| `src/screens/MonthlySnapshotScreen.tsx` | Monthly dashboard layout |
| `src/components/` | Budget summary, category cards, and progress indicators |

Calculations are kept separate from rendering. Components receive typed data and display the results.

## Budget Calculations

All amounts used in budget calculations are expressed in agorot:

```text
1 ILS = 100 agorot
```

- **Remaining balance:** budget minus spending.
- **Spending percentage:** spending divided by budget, rounded for display.
- **Progress fill:** the spending ratio limited to the range 0–1.
- **Overspending:** remaining balance is negative.
- **Overall usage:** calculated from total spending and total budget, rather than averaging category percentages.

Currently, a zero budget with positive spending produces a full progress bar and a displayed percentage of 100%. This is a display convention, not a mathematically defined percentage.

The `Agorot` type is currently an alias for `number`; it does not enforce integer values at runtime. Validation will be needed when handling user input and API data.

### Demo Data

| Category | Budget | Spending | Result |
| --- | ---: | ---: | --- |
| Food | 3,000 ILS | 2,400 ILS | 600 ILS remaining |
| Entertainment | 800 ILS | 950 ILS | 150 ILS over budget |
| Transportation | 1,000 ILS | 700 ILS | 300 ILS remaining |
| **Total** | **4,800 ILS** | **4,050 ILS** | **750 ILS remaining** |

A category can exceed its budget even when the overall monthly balance remains positive.

## Roadmap

### Expense Management

- [ ] Add, edit, and delete individual expenses.
- [ ] Manage categories and monthly budgets.
- [ ] Select a month and calculate spending from dated expenses.
- [ ] Add input validation, empty states, and error handling.
- [ ] Build navigation and forms that handle the mobile keyboard correctly.

### Backend and Security

- [ ] Build a Node.js API and choose a database.
- [ ] Add registration and login with server-side password hashing.
- [ ] Implement authenticated requests and per-user authorization.
- [ ] Store sensitive session credentials using platform-backed secure storage.
- [ ] Define token expiry, session renewal, logout, and revocation behavior.
- [ ] Validate API input and handle authentication errors.
- [ ] Configure HTTPS and study certificate validation.
- [ ] Add rate limiting and security checks.
- [ ] Explore certificate pinning in a controlled learning environment.

### Animations and Performance

- [ ] Learn and integrate React Native Reanimated.
- [ ] Animate budget progress indicators and expandable category details.
- [ ] Add gesture-based interactions for expense rows.
- [ ] Measure rendering and interaction performance.
- [ ] Improve accessibility as interactions evolve.

### Testing and Delivery

- [ ] Add automated tests for budget rules and important user flows.
- [ ] Create a CI pipeline for type checks, linting, tests, and builds.
- [ ] Separate development, testing, and production environments.
- [ ] Manage build secrets and signing credentials.
- [ ] Automate backend deployment and prepare signed Android releases.
- [ ] Add error monitoring and a release rollback strategy.
- [ ] Prepare the app for Google Play distribution.

## Windows Build Paths

Some Android native build tools can have problems with non-ASCII characters in paths. Prefer locations such as:

```text
Project:          C:\Dev\budget-app
Android SDK:      C:\Android\Sdk
Gradle user home: C:\GradleCache
```

Moving the project does not move Gradle's shared cache. If build errors contain corrupted characters in paths under your Windows user directory, check `GRADLE_USER_HOME` as well.

To configure an ASCII-only Gradle location from PowerShell:

```powershell
$env:GRADLE_USER_HOME = "C:\GradleCache"
[Environment]::SetEnvironmentVariable("GRADLE_USER_HOME", "C:\GradleCache", "User")
```

The first line applies to the current terminal; the second persists the setting for future sessions.

## Documentation

- [Expo: Local app development](https://docs.expo.dev/guides/local-app-development/)
- [React Native documentation](https://reactnative.dev/docs/getting-started)
- [Safe Area Context](https://appandflow.github.io/react-native-safe-area-context/)
- [Gradle directories and caches](https://docs.gradle.org/current/userguide/directory_layout.html)

