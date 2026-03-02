import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Day, Activity, Accommodation, PackingItem, Participant } from '@/types/trip';
import {
  isTripManifestInput,
  manifestToDays,
  buildManifestFromLegacyTSV,
  DEFAULT_MANIFEST_OPTIONS,
  daysToManifest,
  parseTripManifest,
} from '@/utils/trip-manifest';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { PARTICIPANTS } from '@/constants/participants';
import { ROOM_ASSIGNMENTS } from '@/constants/roomAssignments';
import { TripManifest } from '@/types/tripManifest';
import { tripCodeResolver } from '@/data/trip/tripCodeResolver';
import { createDefaultTripManifest } from '@/data/trip/defaultManifest';
import {
  loadTripSessionSnapshot,
  clearTripSession,
  saveActiveTripCode,
  saveTripManifest,
} from '@/data/trip/tripSessionStore';

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

const STORAGE_KEY_PACKING = '@packing_list';
const STORAGE_KEY_PACKING_VERSION = '@packing_list_version';
const STORAGE_KEY_NOTIFICATIONS_ENABLED = '@notifications_enabled';
const STORAGE_KEY_NOTIFICATIONS_SCHEDULED_HASH = '@notifications_scheduled_hash';
const CUSTOM_TRIP_VERSION = 'custom';
const CURRENT_TRIP_VERSION = 'manifest-v1';

const DEFAULT_PACKING_ITEMS: Omit<PackingItem, 'id' | 'checked'>[] = [
  { naam: 'Paspoort', categorie: 'Documenten & geld', suggested: false },
  { naam: 'Meerdere kopieën paspoort', categorie: 'Documenten & geld', suggested: false },
  { naam: 'Pinpas', categorie: 'Documenten & geld', suggested: false },
  { naam: 'Creditcard', categorie: 'Documenten & geld', suggested: false },
  { naam: 'Rijbewijs', categorie: 'Documenten & geld', suggested: false },
  { naam: 'Meerdere kopieën rijbewijs', categorie: 'Documenten & geld', suggested: false },
  { naam: 'Vaccinatieboekje', categorie: 'Documenten & geld', suggested: false },
  { naam: 'Zorgpas (+kopie)', categorie: 'Documenten & geld', suggested: false },
  {
    naam: 'Daypack (regenhoes is handig)',
    categorie: 'Tassen & bagage',
    suggested: false,
  },
  { naam: 'Slotje voor je tas', categorie: 'Tassen & bagage', suggested: false },
  { naam: 'Powerbank', categorie: 'Elektronica', suggested: false },
  { naam: 'Boek of e-reader', categorie: 'Elektronica', suggested: false },
  { naam: 'Headlamp (optioneel)', categorie: 'Elektronica', suggested: false },
  { naam: 'Formele accessoire', categorie: 'Kleding & schoeisel', suggested: false },
  {
    naam: 'Warme kleding voor koele avonden',
    categorie: 'Kleding & schoeisel',
    suggested: false,
  },
  { naam: 'Regenjas of poncho', categorie: 'Kleding & schoeisel', suggested: false },
  { naam: 'Pet of hoed', categorie: 'Kleding & schoeisel', suggested: false },
  { naam: 'Bergschoenen, trailrunschoenen of evt hardloopschoenen', categorie: 'Kleding & schoeisel', suggested: false },
  { naam: 'Sportkleding', categorie: 'Kleding & schoeisel', suggested: false },
  { naam: 'Wandelstokken [Optioneel]', categorie: 'Kleding & schoeisel', suggested: false },
  { naam: 'Handdoek (of koop daar een canga)', categorie: 'Strand & buiten', suggested: false },
  { naam: 'Zonnebrand', categorie: 'Strand & buiten', suggested: false },
  { naam: 'Aftersun', categorie: 'Strand & buiten', suggested: false },
  { naam: 'Muggenwerend middel', categorie: 'Strand & buiten', suggested: false },
  { naam: 'Waterfles', categorie: 'Strand & buiten', suggested: false },
  { naam: 'Paracetamol', categorie: 'Gezondheid', suggested: false },
  { naam: 'Imodium', categorie: 'Gezondheid', suggested: false },
  { naam: 'ORS', categorie: 'Gezondheid', suggested: false },
  { naam: 'Melatonine', categorie: 'Gezondheid', suggested: false },
  { naam: 'Condooms!', categorie: 'Gezondheid', suggested: false },
  { naam: 'Oordoppen', categorie: 'Slaap & comfort', suggested: false },
  { naam: 'Slaapmasker', categorie: 'Slaap & comfort', suggested: false },
  { naam: 'Reis- of nekkussen', categorie: 'Slaap & comfort', suggested: false },
  // Persoonlijke items — gekoppeld aan personen, tellen niet mee in de globale voortgang
  { naam: 'Speaker – Person 1', categorie: 'Persoonlijk', suggested: true, personal: true, assignedTo: 'p1' },
  { naam: 'Speaker – Person 2', categorie: 'Persoonlijk', suggested: true, personal: true, assignedTo: 'p2' },
  { naam: 'EHBO-set – Person 3', categorie: 'Persoonlijk', suggested: true, personal: true, assignedTo: 'p3' },
  { naam: 'Bal – Person 4', categorie: 'Persoonlijk', suggested: true, personal: true, assignedTo: 'p4' },
  { naam: 'Spel – Person 5', categorie: 'Persoonlijk', suggested: true, personal: true, assignedTo: 'p5' },
  { naam: 'Kaarten – Person 6', categorie: 'Persoonlijk', suggested: true, personal: true, assignedTo: 'p6' },
  { naam: 'Dobbelstenen – Person 7', categorie: 'Persoonlijk', suggested: true, personal: true, assignedTo: 'p7' },
  { naam: 'Frisbee – Person 8', categorie: 'Persoonlijk', suggested: true, personal: true, assignedTo: 'p8' },
  { naam: 'Strandspel – Person 9', categorie: 'Persoonlijk', suggested: true, personal: true, assignedTo: 'p9' },
  { naam: 'Sportset – Person 10', categorie: 'Persoonlijk', suggested: true, personal: true, assignedTo: 'p10' },
];

const CURRENT_PACKING_VERSION = `2026-09-03-${hashString(JSON.stringify(DEFAULT_PACKING_ITEMS))}`;

const DEFAULT_ROOM_ASSIGNMENTS = Object.entries(ROOM_ASSIGNMENTS).reduce<Record<string, string[]>>(
  (acc, [key, value]) => {
    acc[key] = value.rooms;
    return acc;
  },
  {}
);

const normalizeLookupKey = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const normalizeImageUri = (value?: string | null) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('data:')) return trimmed;
  const commaIndex = trimmed.indexOf(',');
  if (commaIndex < 0) return trimmed;
  const prefix = trimmed.slice(0, commaIndex + 1);
  const payload = trimmed.slice(commaIndex + 1).replace(/\s+/g, '');
  return `${prefix}${payload}`;
};

const buildParticipantsFromManifest = (manifest: TripManifest | null): Participant[] => {
  if (!manifest) {
    return [];
  }
  const manifestParticipants = manifest?.people?.participants;
  if (manifestParticipants === undefined) {
    return PARTICIPANTS;
  }

  return manifestParticipants.map(person => ({
    id: person.id,
    naam: person.name,
    bio: person.bio,
    avatar: person.avatarUrl ? { uri: normalizeImageUri(person.avatarUrl) } : null,
    emergencyContacts: person.emergencyContacts?.map(contact => ({
      naam: contact.name,
      telefoon: contact.phone,
    })),
  }));
};

const buildRoomAssignmentsFromManifest = (manifest: TripManifest | null): Record<string, string[]> => {
  if (!manifest) {
    return {};
  }
  const manifestAssignments = manifest?.people?.roomAssignments;
  if (manifestAssignments === undefined) {
    return DEFAULT_ROOM_ASSIGNMENTS;
  }

  return manifestAssignments.reduce<Record<string, string[]>>((acc, assignment) => {
    const key = normalizeLookupKey(assignment.lodgingName);
    if (!key) return acc;
    acc[key] = [...assignment.rooms];
    return acc;
  }, {});
};

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
  // Accept both floating strings and legacy ISO-ish strings by ignoring offsets
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

const inferActivityTypeFromLegacyPlace = (place: any): Activity['type'] => {
  const type = String(place?.type || '').toLowerCase().trim();
  const hints = String([place?.group, place?.naam, place?.beschrijving].filter(Boolean).join(' ')).toLowerCase();

  if (/(ontbijt|breakfast|brunch)/.test(hints)) return 'breakfast';
  if (/\blunch\b/.test(hints)) return 'lunch';
  if (/(diner|dinner|avondeten|supper)/.test(hints)) return 'dinner';
  if (/(drinks?|borrel|cocktail|bier|wijn|wine|bar|night)/.test(hints)) return 'drinks';
  if (type === 'food') return 'lunch';
  if (type === 'drink' || type === 'nightlife') return 'drinks';
  if (type === 'logistics') return 'travel';
  if (type === 'spot') return 'tour';
  return 'event';
};

const activitySignature = (activity: Activity) =>
  [
    String(activity.naam || '').toLowerCase(),
    String(activity.type || '').toLowerCase(),
    String(activity.locatie || '').toLowerCase(),
    activity.startTijd ? activity.startTijd.toISOString() : '',
    activity.verzamelTijd ? activity.verzamelTijd.toISOString() : '',
    String(activity.mapsLink || '').trim().toLowerCase(),
  ].join('|');

const legacyPlaceToActivity = (dateRaw: string, place: any, idx: number): Activity => {
  const primaryMapsLink = String(place?.mapsLink || '').trim() || String(place?.locations?.[0]?.url || '').trim();
  const lines: string[] = [];
  const group = String(place?.group || '').trim();
  const description = String(place?.beschrijving || '').trim();
  if (group) lines.push(`Moment: ${group}`);
  if (description) lines.push(description);
  (Array.isArray(place?.links) ? place.links : []).forEach((link: any) => {
    const label = String(link?.label || '').trim();
    const url = String(link?.url || '').trim();
    if (!label || !url) return;
    lines.push(`${label}: ${url}`);
  });
  (Array.isArray(place?.locations) ? place.locations : []).forEach((location: any) => {
    const label = String(location?.label || '').trim();
    const url = String(location?.url || '').trim();
    if (!label || !url) return;
    if (primaryMapsLink && url.trim().toLowerCase() === primaryMapsLink.trim().toLowerCase()) return;
    lines.push(`${label}: ${url}`);
  });

  return {
    id: String(place?.id || `${dateRaw}-legacy-place-${idx + 1}`) + '-activity',
    naam: String(place?.naam || '').trim() || `Legacy place ${idx + 1}`,
    type: inferActivityTypeFromLegacyPlace(place),
    locatie: String(place?.locatie || '').trim() || String(place?.locations?.[0]?.label || '').trim(),
    startTijd: parseDateTimeFloating(place?.startTijd),
    verzamelTijd: null,
    vertrekVanaf: '',
    vervoer: '',
    reisTijd: null,
    beschrijving: lines.join('\n').trim(),
    mapsLink: primaryMapsLink,
    imageUrl: '',
  };
};

const deserializeDaysFloating = (input: any): Day[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map(raw => {
      const datum = parseDateOnly(raw?.datum);
      if (!datum) return null;
      const activities: Activity[] = Array.isArray(raw?.activiteiten)
        ? raw.activiteiten.map((act: any) => ({
            ...act,
            startTijd: parseDateTimeFloating(act?.startTijd),
            verzamelTijd: parseDateTimeFloating(act?.verzamelTijd),
          }))
        : [];
      const legacyPlaceActivities: Activity[] = Array.isArray(raw?.places)
        ? raw.places.map((place: any, idx: number) => legacyPlaceToActivity(String(raw?.datum || ''), place, idx))
        : [];

      const mergedActivities = [...activities];
      const seen = new Set(activities.map(activitySignature));
      legacyPlaceActivities.forEach(activity => {
        const signature = activitySignature(activity);
        if (!signature || seen.has(signature)) return;
        seen.add(signature);
        mergedActivities.push(activity);
      });
      mergedActivities.sort((a, b) => {
        const aTime = a.verzamelTijd || a.startTijd;
        const bTime = b.verzamelTijd || b.startTijd;
        if (aTime && bTime) return aTime.getTime() - bTime.getTime();
        if (aTime) return -1;
        if (bTime) return 1;
        return a.naam.localeCompare(b.naam);
      });

      return {
        ...raw,
        datum,
        meldingTijd: parseDateTimeFloating(raw?.meldingTijd),
        activiteiten: mergedActivities,
        places: [],
      } as Day;
    })
    .filter(Boolean) as Day[];
};

const generateSuggestedItems = (days: Day[]): PackingItem[] => {
  const items: PackingItem[] = [];
  const hasEvent = days.some(day => day.activiteiten.some(act => act.type === 'event'));

  if (hasEvent) {
    items.push(
      { id: 'event-1', naam: 'Oordoppen', categorie: 'Event', checked: false, suggested: true },
      { id: 'event-2', naam: 'Cash geld', categorie: 'Event', checked: false, suggested: true },
    );
  }

  return items;
};

const buildDefaultPackingList = (days: Day[], includeSuggested: boolean) => {
  const defaultList = DEFAULT_PACKING_ITEMS.map((item, idx) => ({
    ...item,
    id: `default-${idx}`,
    checked: false,
  }));
  const suggestedItems = includeSuggested ? generateSuggestedItems(days) : [];
  return [...defaultList, ...suggestedItems];
};

const mergePackingLists = (base: PackingItem[], extras: PackingItem[]) => {
  const existingIds = new Set(base.map(item => item.id));
  const mergedExtras = extras.filter(item => !existingIds.has(item.id));
  return [...base, ...mergedExtras];
};

export const [TripProvider, useTrip] = createContextHook(() => {
    const [days, setDays] = useState<Day[]>([]);
    const [activeManifest, setActiveManifest] = useState<TripManifest | null>(null);
    const [activeTripCode, setActiveTripCode] = useState<string | null>(null);
    const [packingList, setPackingList] = useState<PackingItem[]>([]);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

    const scheduleNotifications = async (days: Day[]) => {
      if (Platform.OS === 'web') return;
      if (__DEV__) return;

      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;

      const scheduleHash = hashString(
        JSON.stringify(
          days.map(day => ({
            datum: day.datum.toISOString(),
            meldingTijd: day.meldingTijd ? new Date(day.meldingTijd).toISOString() : null,
            avondMelding: day.avondMelding ?? '',
            verblijf: day.verblijf ?? '',
            activiteiten: day.activiteiten.map(act => ({
              naam: act.naam ?? '',
              type: act.type ?? '',
              startTijd: act.startTijd ? act.startTijd.toISOString() : null,
              verzamelTijd: act.verzamelTijd ? act.verzamelTijd.toISOString() : null,
              vertrekVanaf: act.vertrekVanaf ?? '',
            })),
          }))
        )
      );

      const existingHash = await AsyncStorage.getItem(STORAGE_KEY_NOTIFICATIONS_SCHEDULED_HASH);
      if (existingHash === scheduleHash) {
        return;
      }

      await Notifications.cancelAllScheduledNotificationsAsync();

      for (const day of days) {
        if (day.meldingTijd && day.meldingTijd > new Date()) {
          const firstActivity = day.activiteiten[0];
          const bodyLines = day.avondMelding?.trim()
            ? [day.avondMelding.trim()]
            : (() => {
                const timeStr = firstActivity?.verzamelTijd
                  ? `${String(firstActivity.verzamelTijd.getHours()).padStart(2, '0')}:${String(firstActivity.verzamelTijd.getMinutes()).padStart(2, '0')}`
                  : firstActivity?.startTijd
                  ? `${String(firstActivity.startTijd.getHours()).padStart(2, '0')}:${String(firstActivity.startTijd.getMinutes()).padStart(2, '0')}`
                  : 'TBA';

                const location = resolveDepartureLocation(firstActivity?.vertrekVanaf, day.verblijf);

                const lines = [`Verzamelen ${timeStr} bij ${location}.`];
                const activitiesToShow = day.activiteiten.slice(0, 3);

                activitiesToShow.forEach(act => {
                  const actTime = act.verzamelTijd || act.startTijd;
                  const actTimeStr = actTime
                    ? `${String(actTime.getHours()).padStart(2, '0')}:${String(actTime.getMinutes()).padStart(2, '0')}`
                    : 'TBA';
                  lines.push(`${actTimeStr} — ${act.naam} (${act.type})`);
                });
                return lines;
              })();

          const triggerDate = day.meldingTijd instanceof Date
            ? day.meldingTijd
            : new Date(day.meldingTijd as any);

          if (Number.isNaN(triggerDate.getTime())) {
            continue;
          }

          const triggerInput = buildDateTrigger(triggerDate);
          if (triggerInput) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `Morgen: ${day.stadRegio} — ${day.datum.getDate()} ${Object.keys(MONTH_MAP).find(k => MONTH_MAP[k] === day.datum.getMonth())}`,
                body: bodyLines.join('\n'),
                sound: true,
              },
              trigger: triggerInput,
            });
          }
        }
      }

      await AsyncStorage.setItem(STORAGE_KEY_NOTIFICATIONS_SCHEDULED_HASH, scheduleHash);
    };

  const persistManifest = async (
    manifest: TripManifest,
    version: string,
    tripCode: string | null
  ) => {
    await saveTripManifest(manifest, version);
    await saveActiveTripCode(tripCode);
  };

  const applyManifest = async (
    manifest: TripManifest,
    options: { version: string; tripCode: string | null }
  ) => {
    const parsedDays = manifestToDays(manifest);
    setActiveManifest(manifest);
    setActiveTripCode(options.tripCode);
    setDays(parsedDays);
    await persistManifest(manifest, options.version, options.tripCode);

    const suggestedItems = generateSuggestedItems(parsedDays);
    const existingIds = new Set(packingList.map(item => item.id));
    const newItems = suggestedItems.filter(item => !existingIds.has(item.id));
    const updatedList = [...packingList, ...newItems];
    setPackingList(updatedList);
    await AsyncStorage.multiSet([
      [STORAGE_KEY_PACKING, JSON.stringify(updatedList)],
      [STORAGE_KEY_PACKING_VERSION, CURRENT_PACKING_VERSION],
    ]);

    if (notificationsEnabled && Platform.OS !== 'web') {
      await scheduleNotifications(parsedDays);
    }
  };

  const loadDaysFromStoredTrip = (
    tripData: string
  ): { days: Day[]; manifest: TripManifest; migratedFromLegacy: boolean } => {
    const parsed = JSON.parse(tripData);
    if (isTripManifestInput(parsed)) {
      const manifest = parseTripManifest(parsed);
      return { days: manifestToDays(manifest), manifest, migratedFromLegacy: false };
    }
    const legacyDays = deserializeDaysFloating(parsed);
    if (legacyDays.length === 0) {
      throw new Error('Stored trip payload is invalid');
    }
    const migratedManifest = daysToManifest(legacyDays, {
      ...DEFAULT_MANIFEST_OPTIONS,
      source: 'legacy-tsv',
    });
    return {
      days: legacyDays,
      manifest: migratedManifest,
      migratedFromLegacy: true,
    };
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [tripSession, packingData, packingVersion, notifEnabled] = await Promise.all([
          loadTripSessionSnapshot(),
          AsyncStorage.getItem(STORAGE_KEY_PACKING),
          AsyncStorage.getItem(STORAGE_KEY_PACKING_VERSION),
          AsyncStorage.getItem(STORAGE_KEY_NOTIFICATIONS_ENABLED),
        ]);

        let loadedDays: Day[] = [];
        let hasLoadedTrip = false;

        if (tripSession.tripData) {
          try {
            const loadedTrip = loadDaysFromStoredTrip(tripSession.tripData);
            loadedDays = loadedTrip.days;
            setActiveManifest(loadedTrip.manifest);
            setActiveTripCode(tripSession.activeTripCode);
            setDays(loadedDays);
            hasLoadedTrip = loadedDays.length > 0;
            if (loadedTrip.migratedFromLegacy) {
              await persistManifest(
                loadedTrip.manifest,
                CURRENT_TRIP_VERSION,
                tripSession.activeTripCode
              );
            }
          } catch (parseError) {
            console.error('Error parsing trip data, clearing local session:', parseError);
            await clearTripSession();
            loadedDays = [];
            setActiveManifest(null);
            setActiveTripCode(null);
            setDays([]);
          }
        } else {
          setActiveManifest(null);
          setActiveTripCode(null);
          setDays([]);
        }

        // If a trip was activated via join code earlier, refresh it from server on startup.
        // This keeps the app in sync with newly published itinerary changes.
        if (hasLoadedTrip && tripSession.activeTripCode) {
          try {
            const resolved = await tripCodeResolver.resolveTripCode(tripSession.activeTripCode);
            const storedVersion = String(tripSession.tripVersion || '').trim();
            if (resolved.tripVersion !== storedVersion) {
              const refreshedDays = manifestToDays(resolved.manifest);
              loadedDays = refreshedDays;
              setActiveManifest(resolved.manifest);
              setActiveTripCode(resolved.normalizedCode);
              setDays(refreshedDays);
              await persistManifest(
                resolved.manifest,
                resolved.tripVersion,
                resolved.normalizedCode
              );
            }
          } catch (refreshError) {
            console.warn('Could not refresh active trip from server:', refreshError);
          }
        }

        const shouldResetPacking = packingVersion !== CURRENT_PACKING_VERSION;

        if (packingData && !shouldResetPacking) {
          try {
            const parsedPacking = JSON.parse(packingData);
            setPackingList(parsedPacking);
          } catch (parseError) {
            console.error('Error parsing packing data, loading defaults:', parseError);
            const defaultList = buildDefaultPackingList(loadedDays, false);
            setPackingList(defaultList);
            await AsyncStorage.multiSet([
              [STORAGE_KEY_PACKING, JSON.stringify(defaultList)],
              [STORAGE_KEY_PACKING_VERSION, CURRENT_PACKING_VERSION],
            ]);
          }
        } else {
          let customItems: PackingItem[] = [];
          if (packingData && shouldResetPacking) {
            try {
              const parsedPacking = JSON.parse(packingData);
              customItems = parsedPacking.filter((item: PackingItem) =>
                typeof item.id === 'string' && item.id.startsWith('custom-')
              );
            } catch (parseError) {
              console.error('Error parsing packing data during reset:', parseError);
            }
          }

          const baseList = buildDefaultPackingList(loadedDays, loadedDays.length > 0 && shouldResetPacking);
          const fullList = mergePackingLists(baseList, customItems);
          setPackingList(fullList);
          await AsyncStorage.multiSet([
            [STORAGE_KEY_PACKING, JSON.stringify(fullList)],
            [STORAGE_KEY_PACKING_VERSION, CURRENT_PACKING_VERSION],
          ]);
        }

        if (notifEnabled !== null) {
          setNotificationsEnabled(notifEnabled === 'true');
        }

        if (hasLoadedTrip && notifEnabled !== 'false' && Platform.OS !== 'web') {
          await scheduleNotifications(loadedDays);
        }

      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const activateTripByCode = async (rawCode: string) => {
    const resolved = await tripCodeResolver.resolveTripCode(rawCode);
    await applyManifest(resolved.manifest, {
      version: resolved.tripVersion,
      tripCode: resolved.normalizedCode,
    });
  };

  const loadInitialTripData = async () => {
    await applyManifest(createDefaultTripManifest(), {
      version: CURRENT_TRIP_VERSION,
      tripCode: null,
    });
  };

  const importTSV = async (tsvContent: string) => {
    try {
      const manifest = buildManifestFromLegacyTSV(tsvContent, undefined, {
        ...DEFAULT_MANIFEST_OPTIONS,
        source: 'legacy-tsv',
      });
      await applyManifest(manifest, { version: CUSTOM_TRIP_VERSION, tripCode: null });
    } catch (error) {
      console.error('Error importing TSV:', error);
      throw error;
    }
  };

  const importTripManifest = async (manifestContent: string) => {
    try {
      const parsedManifest = parseTripManifest(manifestContent);
      await applyManifest(parsedManifest, { version: CURRENT_TRIP_VERSION, tripCode: null });
    } catch (error) {
      console.error('Error importing trip manifest:', error);
      throw error;
    }
  };

  const clearData = async () => {
    await clearTripSession();
    await AsyncStorage.multiRemove([
      STORAGE_KEY_PACKING,
      STORAGE_KEY_PACKING_VERSION,
      STORAGE_KEY_NOTIFICATIONS_SCHEDULED_HASH,
    ]);
    if (Platform.OS !== 'web') {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
    setActiveManifest(null);
    setActiveTripCode(null);
    setDays([]);
    const defaultList = buildDefaultPackingList([], false);
    setPackingList(defaultList);
    await AsyncStorage.multiSet([
      [STORAGE_KEY_PACKING, JSON.stringify(defaultList)],
      [STORAGE_KEY_PACKING_VERSION, CURRENT_PACKING_VERSION],
    ]);
  };

  const togglePackingItem = async (id: string) => {
    const updated = packingList.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    setPackingList(updated);
    await AsyncStorage.multiSet([
      [STORAGE_KEY_PACKING, JSON.stringify(updated)],
      [STORAGE_KEY_PACKING_VERSION, CURRENT_PACKING_VERSION],
    ]);
  };

  const addPackingItem = async (naam: string, categorie: string) => {
    const newItem: PackingItem = {
      id: `custom-${Date.now()}`,
      naam,
      categorie,
      checked: false,
      suggested: false,
    };
    const updated = [...packingList, newItem];
    setPackingList(updated);
    await AsyncStorage.multiSet([
      [STORAGE_KEY_PACKING, JSON.stringify(updated)],
      [STORAGE_KEY_PACKING_VERSION, CURRENT_PACKING_VERSION],
    ]);
  };

  const removePackingItem = async (id: string) => {
    const updated = packingList.filter(item => item.id !== id);
    setPackingList(updated);
    await AsyncStorage.multiSet([
      [STORAGE_KEY_PACKING, JSON.stringify(updated)],
      [STORAGE_KEY_PACKING_VERSION, CURRENT_PACKING_VERSION],
    ]);
  };

  const toggleNotifications = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    await AsyncStorage.setItem(STORAGE_KEY_NOTIFICATIONS_ENABLED, enabled ? 'true' : 'false');
    
    if (enabled && days.length > 0 && Platform.OS !== 'web') {
      await scheduleNotifications(days);
    } else if (Platform.OS !== 'web') {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await AsyncStorage.removeItem(STORAGE_KEY_NOTIFICATIONS_SCHEDULED_HASH);
    }
  };

  const sendTestNotification = async () => {
    if (Platform.OS === 'web') return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Test melding',
        body: 'Dit is een test melding van je reis app!',
        sound: true,
      },
      trigger: { seconds: 2, channelId: 'default' },
    });
  };

  const sendTestNotificationForDay = async (day: Day) => {
    if (Platform.OS === 'web') return;
    const firstActivity = day.activiteiten[0];
    const body = day.avondMelding?.trim()
      ? day.avondMelding
      : (() => {
          const activityLine = firstActivity
            ? `${firstActivity.naam} (${firstActivity.type})`
            : 'Nog geen activiteiten';
          return `${day.stadRegio} — ${day.datum.getDate()}/${day.datum.getMonth() + 1}\n${activityLine}`;
        })();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Test melding: ${day.dagNaam}`,
        body,
        sound: true,
      },
      trigger: { seconds: 2, channelId: 'default' },
    });
  };

  const accommodations = useMemo<Accommodation[]>(() => {
    const accMap = new Map<string, Accommodation>();
    
    days.forEach(day => {
    const normalizedName = day.verblijf?.trim().toLowerCase();
    const isTravelOnly = day.stadRegio?.trim().toLowerCase().includes('terugreis');
    const isAirportStay = normalizedName?.includes('airport');

    if (
      normalizedName &&
      normalizedName !== 'x' &&
      normalizedName !== 'unknown' &&
      normalizedName !== 'verblijf x' &&
      !isTravelOnly &&
      !isAirportStay
    ) {
      if (!accMap.has(day.verblijf)) {
        accMap.set(day.verblijf, {
          naam: day.verblijf,
            adres: day.verblijfAdres,
            link: day.verblijfLink,
            mapsLink: day.verblijfMapsLink,
            dagen: [day.datum],
          });
        } else {
          const acc = accMap.get(day.verblijf)!;
          acc.dagen.push(day.datum);
        }
      }
    });

    return Array.from(accMap.values());
  }, [days]);

  const participants = useMemo(
    () => buildParticipantsFromManifest(activeManifest),
    [activeManifest]
  );

  const roomAssignmentsLookup = useMemo(
    () => buildRoomAssignmentsFromManifest(activeManifest),
    [activeManifest]
  );

  const hasActiveTrip = !!activeManifest && days.length > 0;

  const getRoomAssignments = (naam?: string | null) => {
    const normalized = normalizeLookupKey(naam);
    if (!normalized) return [];
    return roomAssignmentsLookup[normalized] ?? [];
  };

  return {
    days,
    packingList,
    accommodations,
    participants,
    getRoomAssignments,
    activeTripCode,
    activeTripId: activeManifest?.trip?.id ?? null,
    activeManifest,
    hasActiveTrip,
    notificationsEnabled,
    isLoading,
    activateTripByCode,
    importTSV,
    importTripManifest,
    clearData,
    loadInitialTripData,
    sendTestNotificationForDay,
    togglePackingItem,
    addPackingItem,
    removePackingItem,
    toggleNotifications,
    sendTestNotification,
  };
});

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, Mei: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Okt: 9, Nov: 10, Dec: 11,
};

const MIN_LEAD_TIME_MS = 30_000; // avoid accidental immediate fires

function buildDateTrigger(target: Date): Notifications.NotificationTriggerInput | null {
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= MIN_LEAD_TIME_MS) {
    return null;
  }
  // Use explicit date trigger to satisfy Expo typings.
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: target,
    channelId: 'default',
  };
}

function resolveDepartureLocation(value?: string | null, fallback?: string | null) {
  if (!value || value.toLowerCase() === 'x') {
    return fallback || 'verblijf';
  }
  if (value.trim().toLowerCase() === 'verblijf' && fallback) {
    return fallback;
  }
  return value;
}
