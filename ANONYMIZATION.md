# Anonymization Notes

This repository has been scrubbed for public sharing:

## What was removed or replaced
- Personal names → `Person 1…10`
- Bios → Lorem ipsum placeholders
- Emergency contacts → placeholder numbers
- Trip descriptions, notifications → generic text
- Accommodations & room assignments → generic labels
- Places/tips → generic labels
- Location‑specific hardcoding (addresses, event details, etc.) → placeholders

## Images
- Local personal photos removed from `assets/crew`, `assets/activities`, `assets/days`
- Stock images served via Picsum with fixed seeds for:
  - Cities
  - Accommodations
  - Activity type fallbacks
  - Crew avatars

## Where to update
- Trip data: `constants/initialTripData.ts`
- Places data: `constants/initialPlacesData.ts`
- Crew data: `constants/participants.ts`
- Media mapping: `constants/media.ts`

If you want to restore real data, replace those constants and remove the placeholder URLs.
