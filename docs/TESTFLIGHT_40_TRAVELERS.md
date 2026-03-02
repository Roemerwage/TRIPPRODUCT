# TestFlight Rollout Plan (40 Travelers)

## 1. Lock Production Config

1. Set a public backend URL in `.env.production`:
   - `EXPO_PUBLIC_API_BASE_URL=https://api.your-domain.com`
2. Replace placeholder app IDs in `app.json`:
   - `expo.ios.bundleIdentifier`
   - `expo.android.package`
3. Run preflight:

```sh
npm run preflight:prod
```

## 2. Host Backend Publicly

1. Deploy `backend/server.js` on a public host (Railway, Render, Fly.io, VPS).
2. Keep `backend/data/app.db` persistent (volume/disk), not ephemeral.
3. Set server env:
   - `HOST=0.0.0.0`
   - `PORT=<platform-port>`
4. Verify endpoints:
   - `GET /admin` (admin UI)
   - `POST /public/resolve-code`
   - `GET /public/manifests/:tripVersionId`

## 3. Protect Admin Before Inviting Users

1. Put `/admin` behind auth (reverse proxy basic auth or IP allowlist).
2. Keep `/public/*` open for app users.
3. Limit who can publish versions / create join codes.

## 4. Prepare the Trip

1. Open admin and create/update the trip content.
2. Publish a trip version.
3. Generate the final join code.
4. Test with 2-3 phones using the real join code.

## 5. Build and Ship TestFlight

1. iOS build:

```sh
eas build --platform ios --profile production
```

2. Submit build:

```sh
eas submit --platform ios --profile production
```

3. In App Store Connect:
   - add internal testers first
   - then add external group (up to 10,000)
4. Share simple instructions with travelers:
   - install TestFlight
   - install app
   - open app
   - enter join code

## 6. Go-Live Operations

1. Freeze content 24h before trip start.
2. Keep one owner responsible for last-minute edits.
3. If changes are needed:
   - publish updated trip version + code flow in backend
   - optionally push EAS Update for app UI fixes
4. Keep a backup join code and backup manifest export.

## Minimal Launch Checklist

- [ ] `npm run preflight:prod` passes
- [ ] Backend is public and HTTPS
- [ ] `/admin` is protected
- [ ] Join code resolves from mobile network (not only Wi-Fi)
- [ ] TestFlight build installed on at least 3 real phones
- [ ] One traveler dry-run completed end to end
