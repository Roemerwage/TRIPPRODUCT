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

