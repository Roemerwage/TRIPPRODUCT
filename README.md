# Trip Planner (Portfolio Demo)

A cross‑platform trip planning app built with Expo + React Native. 

## Highlights
- Day‑by‑day itinerary with activities, times, and notes
- Places & tips with categories
- Map view with activity and accommodation markers
- Crew list with profiles and stock avatars
- Packing list with suggestions and per‑person items
- Local notifications for upcoming days
- Minigames for groups (team divider, wheel, undercover, etc.)

## Tech Stack
- Expo, React Native, TypeScript
- expo-router for navigation
- react-native-maps
- AsyncStorage for local persistence
- expo-notifications for local scheduling

## Getting Started

```sh
cd "riotrip"
npm install
npx expo start
```

Optional:
```sh
npm run ios
npm run android
```

## Trip Code Backend
Startup now uses a trip code resolver flow:
- `/join` asks for a trip code
- app resolves code against backend
- app downloads a trip manifest and caches it locally

Set API base URL:
```sh
export EXPO_PUBLIC_API_BASE_URL="https://your-api.example.com"
```
or create `.env` from `.env.example`.

For TestFlight/release, use `.env.production` (see `.env.production.example`) and run:
```sh
npm run preflight:prod
```

Run local API server:
```sh
npm run start:api
```
Local server runs on `http://127.0.0.1:8787` by default.
If you test on a physical phone, use your laptop LAN IP in `EXPO_PUBLIC_API_BASE_URL` instead of `127.0.0.1`.

Admin console:
- open `http://127.0.0.1:8787/admin`
- use `Organization Trip Console` at the top to select the active trip workspace (multi-trip admin flow)
- `Open Selected Trip` loads the latest published/draft version into Builder; if none exists it opens a new workspace for that trip
- use workspace modes (`Builder Studio`, `Spreadsheet Import`, `Operations`) for cleaner admin flow
- use the Guided Trip Builder tabs (Trip, Accommodations, Activities, Places, People, Rooming, Review) to generate a manifest without editing JSON manually
- use builder workflow rail + quality checks to catch missing lodging/region/activities before publish
- load an existing version into the builder (`Load Existing Version`) for quick edits/iteration
- local browser draft autosave is per-trip; `Save/Restore/Clear Local Draft` now follows the selected trip context
- in Review, use `Save Trip` and then `Publish to Travelers` for the simple admin flow
- spreadsheet import supports `Merge and keep existing manual additions` or `Replace current editor content`
- upload trip spreadsheet (`.tsv/.csv`) to auto-generate manifest JSON
- create trip -> create draft version (manifest JSON) -> publish -> create join code
- users can then enter that join code in the app startup screen

Local API data is stored in `backend/data/app.db` (ignored by git).

Expected backend contract:
- `POST /public/resolve-code`
  - request: `{ "code": "YOURCODE" }`
  - response: `{ "tripVersionId": "trv_123", "tripCode": "YOURCODE", "manifestUrl": "/public/manifests/trv_123" }`
  - `manifest` inline payload is also supported as alternative to `manifestUrl`
- `GET /public/manifests/:tripVersionId`
  - response: TripManifest JSON
- `POST /admin/import/legacy-tsv`
  - request: `{ "tripTsv": "...", "placesTsv": "...", "tripId?": "...", "tripName?": "...", "timezone?": "...", "locale?": "...", "defaultYear?": 2026 }`
  - response: `{ "manifest": {...}, "stats": {...}, "warnings": [...] }`
- `POST /admin/save-trip-draft`
  - request: `{ "manifest": {...}, "versionId?": "trv_x" }`
  - response: `{ "trip": {...}, "version": {"id":"...","status":"draft"}, "manifest": {...} }`
- `POST /admin/trip-versions/:versionId/publish-with-code`
  - request: `{ "joinCode?": "SUMMER27" }`
  - response: `{ "id":"...","tripId":"...","status":"published","joinCode":"...","manifestUrl":"..." }`
  - if `joinCode` is omitted, the API auto-generates one
- `POST /admin/publish-from-manifest`
  - advanced shortcut endpoint (save + publish in one call)
  - request: `{ "manifest": {...}, "versionId?": "trv_x", "joinCode?": "SUMMER27" }`
  - response: `{ "trip": {...}, "version": {...}, "joinCode": "...", "manifestUrl": "/public/manifests/..." }`
  - if `joinCode` is omitted, the API auto-generates one
- `GET /admin/trip-versions/:versionId`
  - response: `{ "id": "...", "tripId": "...", "status": "draft|published|archived", "manifest": {...} }`

Dev fallback:
- code `DEMO` always loads local sample manifest
- if no API URL is configured, code `RIO2026` loads local sample manifest

Local backend seed data:
- code `RIO2026` -> manifest `trv_demo`
- code `SUMMERTEST` -> manifest `trv_demo`

## TestFlight Rollout
- Step-by-step rollout for ~40 travelers: `docs/TESTFLIGHT_40_TRAVELERS.md`
- Includes production checklist, backend/public API requirements, and launch operations.

## Project Structure
- `app/` – Screens and routes (Expo Router)
- `constants/` – Anonymized seed data and media mapping
- `contexts/` – App state (TripContext, theme, etc.)
- `utils/` – Parsers and helpers
- `assets/` – Icons and splash assets

## Data & Anonymization
All real names, locations, contact details, and narrative content have been replaced with placeholders. Stock images are pulled from a public placeholder service (Picsum) with fixed seeds to keep them stable. See `ANONYMIZATION.md` for details.

## Notes
- This project is intended for portfolio/demo purposes only.
- Replace the placeholder data in `constants/` if you want to adapt it for real use.
