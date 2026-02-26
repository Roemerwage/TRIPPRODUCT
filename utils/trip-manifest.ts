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

    const activiteiten: Activity[] = day.activities.map(activity => ({
      id: activity.id,
      naam: activity.name,
      type: activity.type,
      locatie: normalizeString(activity.location),
      startTijd: parseDateTimeFloating(activity.startTime),
      verzamelTijd: parseDateTimeFloating(activity.meetTime),
      vertrekVanaf: normalizeString(activity.departFrom),
      vervoer: normalizeString(activity.transport),
      reisTijd: activity.travelMinutes ?? null,
      beschrijving: normalizeString(activity.description),
      mapsLink: normalizeString(activity.mapsLink),
    }));

    activiteiten.sort((a, b) => {
      const aTime = a.verzamelTijd || a.startTijd;
      const bTime = b.verzamelTijd || b.startTijd;
      if (aTime && bTime) return aTime.getTime() - bTime.getTime();
      if (aTime) return -1;
      if (bTime) return 1;
      return 0;
    });

    const places: Place[] | undefined = day.places?.map(place => ({
      id: place.id,
      naam: place.name,
      type: place.type,
      locatie: normalizeString(place.location),
      mapsLink: normalizeString(place.mapsLink),
      startTijd: parseDateTimeFloating(place.startTime),
      beschrijving: place.description,
      group: place.group,
      links: place.links,
      locations: place.locations,
    }));

    return {
      datum,
      dagNaam: normalizeString(day.dayName),
      stadRegio: normalizeString(day.region),
      verblijf: day.lodging?.name ?? '',
      verblijfLink: day.lodging?.link ?? '',
      verblijfAdres: day.lodging?.address ?? '',
      verblijfMapsLink: day.lodging?.mapsLink ?? '',
      activiteiten,
      places,
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
      const activities = day.activiteiten.map(activity => ({
        id: activity.id,
        name: activity.naam,
        type: activity.type,
        location: normalizeString(activity.locatie),
        startTime: formatDateTime(activity.startTijd),
        meetTime: formatDateTime(activity.verzamelTijd),
        departFrom: normalizeString(activity.vertrekVanaf),
        transport: normalizeString(activity.vervoer),
        travelMinutes: activity.reisTijd,
        description: normalizeString(activity.beschrijving),
        mapsLink: normalizeString(activity.mapsLink),
      }));

      const places = day.places?.map(place => ({
        id: place.id,
        name: place.naam,
        type: place.type,
        location: normalizeString(place.locatie),
        mapsLink: normalizeString(place.mapsLink),
        startTime: formatDateTime(place.startTijd),
        description: place.beschrijving,
        group: place.group,
        links: place.links,
        locations: place.locations,
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
        places,
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
    return { ...day, places };
  });

  return daysToManifest(mergedDays, {
    ...DEFAULT_MANIFEST_OPTIONS,
    source: 'legacy-tsv',
    ...overrides,
  });
}
