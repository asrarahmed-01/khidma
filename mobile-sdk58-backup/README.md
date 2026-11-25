# Khidma mobile app

One React Native (Expo) app for both customers and technicians, in Arabic and English. Which screens you see depends on your role.

## Run it on your phone

You need the API running first (see the main README), Node.js 20+, and the **Expo Go** app on your phone. Your phone and computer must be on the same Wi-Fi.

```bash
cd mobile
npm install
npx expo start        # scan the QR code with Expo Go (Android) or the Camera app (iPhone)
```

The app finds the API automatically: in development it uses your computer's address from the Expo dev server, on port 4000. To point it somewhere else, set `EXPO_PUBLIC_API_URL`, for example `EXPO_PUBLIC_API_URL=https://khidma-api.example.com npx expo start`.

Other ways to run it:

```bash
npx expo start --android   # Android emulator
npx expo start --ios       # iOS simulator (macOS)
npx expo start --web       # in the browser
```

Sign in with the demo accounts from the seed (customer `0500000003`, technician `0500000002`). In development there is no SMS: the 6-digit code is printed in the API server's terminal.

Everything works in Expo Go except two things that need native code: the interactive map (Expo Go shows a static map or a diagram instead) and push notifications. For those, make a development build (below).

### Try the new features

- **Payment:** sign in as the customer and open the completed AC repair booking (Bookings → Past). Tap **Pay**. Without Moyasar keys you get the API's simulated checkout: try **Decline** first, then **Pay**.
- **Live tracking and chat:** use two devices (or a phone and the web build). The customer books a service; the technician accepts it and taps **I'm on my way**. The customer's booking shows the technician moving, and either side can tap **Message**.

### Mapbox (optional)

Create a free account at mapbox.com, copy your default public token (`pk.…`), then:

```bash
cp .env.example .env    # set EXPO_PUBLIC_MAPBOX_TOKEN=pk.…
npx expo start --clear  # restart so the new variable is bundled
```

Expo Go and the web then show a Mapbox street map image that updates as the technician moves; a development build shows the full interactive map.

## Development build (map and push notifications)

A development build is your own version of Expo Go with Khidma's native modules inside (Mapbox, push notifications). You need a free Expo account and, for push on Android, a Firebase project.

```bash
npm install -g eas-cli
eas login
eas init                                 # links the project and writes its id to app.json
npx expo install expo-dev-client         # adds the development client
```

**Push on Android (Firebase Cloud Messaging):**

1. In the Firebase console, create a project and add an Android app with the package name `app.khidma.mobile`.
2. Download `google-services.json` into `mobile/` and add `"googleServicesFile": "./google-services.json"` under `expo.android` in `app.json`.
3. In Firebase → Project settings → Service accounts, generate a private key (JSON). Upload it with `eas credentials` → Android → Google Service Account → "FCM V1". Keep this file out of git.

**Push on iOS** needs a paid Apple Developer account; `eas build` sets up the APNs key for you.

Then build and install:

```bash
npm run build:dev:android    # eas build --profile development --platform android (an .apk)
npx expo start --dev-client  # open the installed build and scan the QR code
```

Once `expo-dev-client` is installed, `npx expo start` opens the development build by default; run `npx expo start --go` to keep using Expo Go.

On first sign-in the app asks for notification permission and sends its Expo push token to the API (`PATCH /me`). Signing out removes it.

## Checks

```bash
npm run typecheck
npm run lint
npm test
```

## What's in here

| Area | What it does |
| --- | --- |
| Sign-in | Saudi mobile number → 6-digit code (with SMS autofill) → name on first login |
| Customer | Service catalog, booking with current location or city, day and 2-hour arrival window, booking list, live status timeline, cancel with reason |
| Live tracking | While the technician is on the way: map (interactive Mapbox, static Mapbox image, or a diagram), distance, last update time |
| Chat | Per-booking messages between customer and technician, unread badge, read-only after the job |
| Payment | Pay a completed job on Moyasar's checkout (mada, Visa, Mastercard, Apple Pay), receipt with method and time |
| Technician | Online/offline switch, open jobs (area only, no address until accepted), accept, "on my way" (starts sharing location) → "start job" → "complete", call, message, directions, payment status |
| Notifications | Push for every step of a booking, new jobs and messages, in the account's language; tapping opens the right screen |
| Account | Language switch (instant, no restart), become a technician, sign out |

## How it's built

```
src/
  app/                    screens (Expo Router: every file is a route)
    _layout.tsx           providers, fonts, and role-based route guards
    (auth)/               sign-in, verify
    (customer)/           tabs: home, bookings, profile
    (technician)/         tabs: jobs, my-jobs, account
    book/[serviceId].tsx  booking form
    booking/[id].tsx      booking details (customer and technician views)
    chat/[bookingId].tsx  chat for one booking
  api/                    typed fetch client, endpoints, TanStack Query hooks
  realtime/               Socket.IO connection, events → query cache, technician location sharing
  payments/               Moyasar checkout in the in-app browser, payment verification
  notifications/          push registration, notification taps, allowed links
  session/                token storage (Keychain/Keystore) and sign-in state (Zustand)
  i18n/                   Arabic and English strings, language and direction provider
  components/             UI building blocks
  lib/                    formatting, slots, phone numbers, bidi helpers
  theme.ts                colors, type scale, spacing
__tests__/                Jest + React Native Testing Library
```

### Decisions worth knowing

- **Role-based navigation with protected routes.** The root layout declares which screens exist for signed-out users, new users, customers, technicians and admins. When a technician application is submitted, the role changes and the app switches to the technician tabs on its own.
- **Profile loaded before "signed in".** The session only flips to signed-in after `/me` loads, so route guards always know the role and never flash the wrong screens.
- **Arabic RTL without restarting.** `I18nManager.forceRTL` needs an app restart and is ignored by Expo Go. Instead the layout direction is set on the view tree, and Expo Router's `LocaleProvider` mirrors navigation. React Native aligns text and start/end spacing from that, so the switch is instant.
- **Bidi-safe numbers.** Phone numbers and booking references are wrapped in Unicode isolates so they don't get reordered inside Arabic sentences.
- **Gregorian dates in Arabic.** `ar-SA` defaults to the Hijri calendar; appointments use `ar-SA-u-ca-gregory-nu-latn` so the date matches what the technician sees, with Latin digits like the phone keypad.
- **Errors by code.** The API returns stable error codes; the app translates them. A contract test scans the server source and fails if a code has no translation.
- **Socket.IO into the query cache.** One connection per signed-in session. A `booking:changed` event invalidates that booking's queries, so the REST API (with its permission checks) stays the source of truth; chat messages and locations are written straight into the cache. Polling stays on as a safety net, slowed to once a minute while the socket is connected, and everything is refetched after a reconnect.
- **Location sharing that starts and stops itself.** A component mounted for technicians watches the active jobs; when one is `EN_ROUTE` it asks for location permission and sends at most one position every 5 seconds (always ending with the newest), and stops as soon as the job starts. On the web it uses the browser's geolocation watch directly, because expo-location's web version stops delivering updates once its internal ids drift from the browser's.
- **Three map tiers, one component.** `LiveMap` uses the native Mapbox SDK when it exists (development and store builds), a Mapbox Static Images URL in Expo Go and on the web (re-requested only when the car moves ~50 m), and an SVG diagram without a token. The native SDK is `require`d lazily, so Expo Go never loads it.
- **The app never decides a payment succeeded.** After the checkout browser closes, however it closed, the app asks the API, which asks Moyasar.
- **Bidi-safe chat.** Each message is laid out in its own direction (first strong letter, like `dir="auto"`), so an English message in the Arabic app keeps its full stop at the end.
