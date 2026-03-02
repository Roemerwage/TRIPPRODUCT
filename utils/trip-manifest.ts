import { Day, Activity, Place } from '@/types/trip';
import { TripManifest, TripManifestSchema } from '@/types/tripManifest';
import { parseTSV, parsePlacesTSV } from '@/utils/tsv-parser';

const pad2 = (value: number) => value.toString().padStart(2, '0');

const formatDateOnly = (value: Date) =>
  `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;

const formatDateTime = (value: Date | null) =>
  value
    ? `${formatDateOnly(value)}T${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`
    : null;

const parseDateOnly = (value?: string | null): Date | null => {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m) - 1;
  const day = Number(d);
  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseDateTimeFloating = (value?: string | null): Date | null => {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const [, y, m, d, hh, mm, ss] = match;
  const year = Number(y);
  const month = Number(m) - 1;
  const day = Number(d);
  const hours = Number(hh);
  const minutes = Number(mm);
  const seconds = ss ? Number(ss) : 0;
  const date = new Date(year, month, day, hours, minutes, seconds, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateKeyFromDate = (value: Date) => formatDateOnly(value);

const normalizeString = (value?: string | null) => value ?? '';

const hasMeaningfulText = (value?: string | null) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && normalized !== 'x' && normalized !== 'unknown' && normalized !== 'tba';
};

const normalizeComparable = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeLinkComparable = (value?: string | null) =>
  normalizeComparable(value).replace(/\/+$/, '');

const stripPlacePrefix = (value: string) =>
  value.replace(/^verblijf:\s*/i, '').replace(/^accommodation:\s*/i, '').trim();

const textIncludesAny = (value: string, candidates: string[]) =>
  candidates.some(candidate => value.includes(candidate));

const inferActivityTypeFromLegacyPlace = (input: {
  type?: string | null;
  group?: string | null;
  name?: string | null;
  description?: string | null;
}): Activity['type'] => {
  const hints = normalizeComparable(
    [input.group, input.name, input.description].filter(Boolean).join(' ')
  );

  if (textIncludesAny(hints, ['ontbijt', 'breakfast', 'brunch'])) return 'breakfast';
  if (textIncludesAny(hints, ['lunch'])) return 'lunch';
  if (textIncludesAny(hints, ['diner', 'dinner', 'avondeten', 'supper'])) return 'dinner';
  if (textIncludesAny(hints, ['drinks', 'drink', 'borrel', 'cocktail', 'bier', 'wijn', 'wine', 'bar', 'night']))
    return 'drinks';

  const normalizedType = normalizeComparable(input.type);
  if (normalizedType === 'food') return 'lunch';
  if (normalizedType === 'drink' || normalizedType === 'nightlife') return 'drinks';
  if (normalizedType === 'logistics') return 'travel';
  if (normalizedType === 'spot') return 'tour';
  return 'event';
};

const buildLegacyPlaceDescription = (input: {
  group?: string | null;
  description?: string | null;
  links?: { label: string; url: string }[] | null;
  locations?: { label: string; url: string }[] | null;
  primaryMapsLink?: string | null;
}) => {
  const lines: string[] = [];
  const group = normalizeString(input.group).trim();
  const description = normalizeString(input.description).trim();
  if (group) lines.push(`Moment: ${group}`);
  if (description) lines.push(description);

  (Array.isArray(input.links) ? input.links : []).forEach(link => {
    const label = normalizeString(link?.label).trim();
    const url = normalizeString(link?.url).trim();
    if (!label || !url) return;
    lines.push(`${label}: ${url}`);
  });

  const normalizedPrimaryMapsLink = normalizeLinkComparable(input.primaryMapsLink);
  (Array.isArray(input.locations) ? input.locations : []).forEach(location => {
    const label = normalizeString(location?.label).trim();
    const url = normalizeString(location?.url).trim();
    if (!label || !url) return;
    if (normalizedPrimaryMapsLink && normalizeLinkComparable(url) === normalizedPrimaryMapsLink) return;
    lines.push(`${label}: ${url}`);
  });

  return lines.join('\n').trim();
};

const activityMergeSignature = (activity: Pick<Activity, 'naam' | 'type' | 'locatie' | 'startTijd' | 'verzamelTijd' | 'mapsLink'>) =>
  [
    normalizeComparable(activity.naam),
    normalizeComparable(activity.type),
    normalizeComparable(activity.locatie),
    formatDateTime(activity.startTijd) || '',
    formatDateTime(activity.verzamelTijd) || '',
    normalizeLinkComparable(activity.mapsLink),
  ].join('|');

const mergeActivitiesWithLegacyPlaceActivities = (
  baseActivities: Activity[],
  placeActivities: Activity[]
): Activity[] => {
  const merged = [...baseActivities];
  const seen = new Set(merged.map(activityMergeSignature));

  placeActivities.forEach(activity => {
    const signature = activityMergeSignature(activity);
    if (!signature || seen.has(signature)) return;
    seen.add(signature);
    merged.push(activity);
  });

  merged.sort((a, b) => {
    const aTime = a.verzamelTijd || a.startTijd;
    const bTime = b.verzamelTijd || b.startTijd;
    if (aTime && bTime) return aTime.getTime() - bTime.getTime();
    if (aTime) return -1;
    if (bTime) return 1;
    return a.naam.localeCompare(b.naam);
  });

  return merged;
};

const manifestPlaceToActivity = (
  dayId: string,
  dayDate: string,
  place: {
    id?: string;
    name?: string;
    type?: string;
    group?: string;
    location?: string;
    mapsLink?: string;
    startTime?: string | null;
    description?: string;
    links?: { label: string; url: string }[];
    locations?: { label: string; url: string }[];
  },
  idx: number
): Activity => {
  const primaryMapsLink = normalizeString(place.mapsLink).trim() || normalizeString(place.locations?.[0]?.url).trim();
  const location = normalizeString(place.location).trim() || normalizeString(place.locations?.[0]?.label).trim();
  const description = buildLegacyPlaceDescription({
    group: place.group,
    description: place.description,
    links: place.links,
    locations: place.locations,
    primaryMapsLink,
  });
  return {
    id: `${String(place.id || `${dayId}-legacy-place-${idx + 1}`)}-activity`,
    naam: normalizeString(place.name) || `Legacy place ${idx + 1}`,
    type: inferActivityTypeFromLegacyPlace({
      type: place.type,
      group: place.group,
      name: place.name,
      description: place.description,
    }),
    locatie: location,
    imageUrl: '',
    startTijd: parseDateTimeFloating(place.startTime),
    verzamelTijd: null,
    vertrekVanaf: '',
    vervoer: '',
    reisTijd: null,
    beschrijving: description,
    mapsLink: primaryMapsLink,
  };
};

const dayPlaceToActivity = (day: Day, place: Place, idx: number): Activity => {
  const primaryMapsLink = normalizeString(place.mapsLink).trim() || normalizeString(place.locations?.[0]?.url).trim();
  const location = normalizeString(place.locatie).trim() || normalizeString(place.locations?.[0]?.label).trim();
  const description = buildLegacyPlaceDescription({
    group: place.group,
    description: place.beschrijving,
    links: place.links,
    locations: place.locations,
    primaryMapsLink,
  });
  return {
    id: `${place.id || `${formatDateOnly(day.datum)}-legacy-place-${idx + 1}`}-activity`,
    naam: normalizeString(place.naam) || `Legacy place ${idx + 1}`,
    type: inferActivityTypeFromLegacyPlace({
      type: place.type,
      group: place.group,
      name: place.naam,
      description: place.beschrijving,
    }),
    locatie: location,
    imageUrl: '',
    startTijd: place.startTijd ?? null,
    verzamelTijd: null,
    vertrekVanaf: '',
    vervoer: '',
    reisTijd: null,
    beschrijving: description,
    mapsLink: primaryMapsLink,
  };
};

const filterDomainOverlappingPlaces = (day: Day): Place[] => {
  const places = day.places ?? [];
  if (places.length === 0) return [];

  const lodgingName = normalizeComparable(day.verblijf);
  const lodgingLink = normalizeLinkComparable(day.verblijfMapsLink);
  const activityNameSet = new Set(day.activiteiten.map(activity => normalizeComparable(activity.naam)).filter(Boolean));
  const activityLinkSet = new Set(
    day.activiteiten.map(activity => normalizeLinkComparable(activity.mapsLink)).filter(Boolean)
  );

  return places.filter(place => {
    const rawName = normalizeComparable(place.naam);
    const placeName = stripPlacePrefix(rawName);
    const placeLink = normalizeLinkComparable(place.mapsLink);
    const looksLikeAccommodation = rawName.startsWith('verblijf:') || rawName.startsWith('accommodation:');

    if (looksLikeAccommodation && lodgingName) return false;
    if (lodgingName && placeName && placeName === lodgingName) return false;
    if (placeName && activityNameSet.has(placeName)) return false;
    if (lodgingLink && placeLink && placeLink === lodgingLink) return false;
    if (placeLink && activityLinkSet.has(placeLink)) return false;

    return true;
  });
};

type ManifestDefaults = {
  tripId: string;
  tripName: string;
  timezone: string;
  locale: string;
};

type DaysToManifestOptions = ManifestDefaults & {
  source?: 'seed' | 'legacy-tsv' | 'manifest-import';
};

export const DEFAULT_MANIFEST_OPTIONS: ManifestDefaults = {
  tripId: 'rio-trip',
  tripName: 'Rio Trip',
  timezone: 'America/Sao_Paulo',
  locale: 'nl-NL',
};

export function parseTripManifest(input: string | unknown): TripManifest {
  const parsedInput = typeof input === 'string' ? JSON.parse(input) : input;
  return TripManifestSchema.parse(parsedInput);
}

export function isTripManifestInput(input: unknown): boolean {
  return TripManifestSchema.safeParse(input).success;
}

export function manifestToDays(manifest: TripManifest): Day[] {
  const days = manifest.days.map(day => {
    const datum = parseDateOnly(day.date);
    if (!datum) {
      throw new Error(`Invalid day.date value: ${day.date}`);
    }

    const baseActivities: Activity[] = day.activities.map(activity => ({
      id: activity.id,
      naam: activity.name,
      type: activity.type,
      locatie: normalizeString(activity.location),
      imageUrl: normalizeString(activity.imageUrl),
      startTijd: parseDateTimeFloating(activity.startTime),
      verzamelTijd: parseDateTimeFloating(activity.meetTime),
      vertrekVanaf: normalizeString(activity.departFrom),
      vervoer: normalizeString(activity.transport),
      reisTijd: activity.travelMinutes ?? null,
      beschrijving: normalizeString(activity.description),
      mapsLink: normalizeString(activity.mapsLink),
    }));

    const legacyPlaceActivities = (day.places || []).map((place, idx) =>
      manifestPlaceToActivity(day.id, day.date, place, idx)
    );
    const activiteiten = mergeActivitiesWithLegacyPlaceActivities(baseActivities, legacyPlaceActivities);

    return {
      datum,
      dagNaam: normalizeString(day.dayName),
      stadRegio: normalizeString(day.region),
      verblijf: day.lodging?.name ?? '',
      verblijfLink: day.lodging?.link ?? '',
      verblijfAdres: day.lodging?.address ?? '',
      verblijfMapsLink: day.lodging?.mapsLink ?? '',
      activiteiten,
      meldingTijd: parseDateTimeFloating(day.notification?.time),
      avondMelding: day.notification?.eveningTemplate,
    } satisfies Day;
  });

  return days.sort((a, b) => a.datum.getTime() - b.datum.getTime());
}

export function daysToManifest(days: Day[], options: DaysToManifestOptions): TripManifest {
  const sortedDays = [...days].sort((a, b) => a.datum.getTime() - b.datum.getTime());

  if (sortedDays.length === 0) {
    throw new Error('Cannot create manifest from empty days array');
  }

  const firstDay = sortedDays[0].datum;
  const lastDay = sortedDays[sortedDays.length - 1].datum;

  return {
    version: 1,
    trip: {
      id: options.tripId,
      name: options.tripName,
      timezone: options.timezone,
      locale: options.locale,
      startDate: formatDateOnly(firstDay),
      endDate: formatDateOnly(lastDay),
      source: options.source,
    },
    days: sortedDays.map(day => {
      const id = `day-${formatDateOnly(day.datum)}`;
      const legacyPlaceActivities = (day.places || []).map((place, idx) => dayPlaceToActivity(day, place, idx));
      const mergedActivities = mergeActivitiesWithLegacyPlaceActivities(day.activiteiten, legacyPlaceActivities);
      const activities = mergedActivities.map(activity => ({
        id: activity.id,
        name: activity.naam,
        type: activity.type,
        location: normalizeString(activity.locatie),
        imageUrl: normalizeString(activity.imageUrl),
        startTime: formatDateTime(activity.startTijd),
        meetTime: formatDateTime(activity.verzamelTijd),
        departFrom: normalizeString(activity.vertrekVanaf),
        transport: normalizeString(activity.vervoer),
        travelMinutes: activity.reisTijd,
        description: normalizeString(activity.beschrijving),
        mapsLink: normalizeString(activity.mapsLink),
      }));

      const hasLodging =
        hasMeaningfulText(day.verblijf) ||
        hasMeaningfulText(day.verblijfLink) ||
        hasMeaningfulText(day.verblijfAdres) ||
        hasMeaningfulText(day.verblijfMapsLink);

      return {
        id,
        date: formatDateOnly(day.datum),
        dayName: normalizeString(day.dagNaam),
        region: normalizeString(day.stadRegio),
        lodging: hasLodging
          ? {
              name: normalizeString(day.verblijf),
              link: hasMeaningfulText(day.verblijfLink) ? day.verblijfLink : undefined,
              address: hasMeaningfulText(day.verblijfAdres) ? day.verblijfAdres : undefined,
              mapsLink: hasMeaningfulText(day.verblijfMapsLink) ? day.verblijfMapsLink : undefined,
            }
          : undefined,
        notification:
          day.meldingTijd || day.avondMelding
            ? {
                time: formatDateTime(day.meldingTijd),
                eveningTemplate: day.avondMelding,
              }
            : undefined,
        activities,
      };
    }),
  };
}

export function buildManifestFromLegacyTSV(
  tripTsvContent: string,
  placesTsvContent?: string,
  overrides: Partial<DaysToManifestOptions> = {}
): TripManifest {
  const parsedDays = parseTSV(tripTsvContent);
  const placesMap = placesTsvContent ? parsePlacesTSV(placesTsvContent) : new Map<string, Place[]>();
  const mergedDays = parsedDays.map(day => {
    const dateKey = dateKeyFromDate(day.datum);
    const places = placesMap.get(dateKey) ?? [];
    const filtered = filterDomainOverlappingPlaces({ ...day, places });
    const placeActivities = filtered.map((place, idx) => dayPlaceToActivity(day, place, idx));
    const activiteiten = mergeActivitiesWithLegacyPlaceActivities(day.activiteiten, placeActivities);
    return { ...day, activiteiten };
  });

  return daysToManifest(mergedDays, {
    ...DEFAULT_MANIFEST_OPTIONS,
    source: 'legacy-tsv',
    ...overrides,
  });
}
