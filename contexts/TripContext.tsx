import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Day, Activity, Accommodation, PackingItem, Participant, EmergencySection } from '@/types/trip';
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
import { normalizeTripCode, tripCodeResolver } from '@/data/trip/tripCodeResolver';
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
const STORAGE_KEY_PARTICIPANT_IDENTITY = '@participant_identity_v1';
const STORAGE_KEY_PARTICIPANT_CLIENT_ID = '@participant_client_id_v1';
const CUSTOM_TRIP_VERSION = 'custom';
const CURRENT_TRIP_VERSION = 'manifest-v1';
const PROFILE_FETCH_TIMEOUT_MS = 12000;
const PROFILE_ENDPOINT = '/public/trip-profiles';
const PROFILE_UPSERT_ENDPOINT = '/public/trip-profiles/upsert';

type ParticipantIdentityEntry = {
  participantId: string;
  avatarUrl?: string;
  updatedAt?: string;
};

type ParticipantIdentityStore = Record<string, ParticipantIdentityEntry>;

type ParticipantProfileLookup = {
  avatarOverrides: Record<string, string>;
  claimedByParticipantId: Record<string, string>;
};

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

const DEFAULT_EMERGENCY_SECTIONS: EmergencySection[] = [
  {
    id: 'emergency-numbers',
    title: 'Noodnummers',
    contacts: [
      { label: 'Alarmnummer', phone: '190' },
      { label: 'Ambulance', phone: '192' },
      { label: 'Brandweer', phone: '193' },
    ],
  },
  {
    id: 'emergency-info',
    title: 'Noodinformatie',
    description: 'Ambassade (placeholder)\nExample Street 1\n0000 AB, Stad',
    contacts: [{ label: 'Telefoon (24/7)', phone: '+00 000000000' }],
  },
  {
    id: 'emergency-doctor',
    title: 'Lokale arts',
    description: 'Arts (placeholder)\nExample Street 2, Stad',
    contacts: [
      { label: 'Telefoon', phone: '+00 000000001' },
      { label: 'Alternatief', phone: '+00 000000002' },
    ],
  },
  {
    id: 'emergency-dentist',
    title: 'Lokale tandarts',
    description: 'Tandarts (placeholder)\nExample Street 3, Stad\ninfo@example.com',
    contacts: [
      { label: 'Telefoon', phone: '+00 000000003' },
      { label: 'Alternatief', phone: '+00 000000004' },
    ],
  },
  {
    id: 'emergency-hospitals',
    title: 'Ziekenhuizen',
    description: 'Ziekenhuis A\nExample Street 4, Stad\n\nZiekenhuis B\nExample Street 5, Stad',
    contacts: [
      { label: 'Ziekenhuis A', phone: '+00 000000005' },
      { label: 'Ziekenhuis B', phone: '+00 000000006' },
    ],
  },
];

const normalizeLookupKey = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const NAME_PARTICLES = new Set([
  'de',
  'den',
  'der',
  'des',
  'di',
  'du',
  'la',
  'le',
  'van',
  'von',
  'ter',
  'ten',
  'te',
  'op',
  'aan',
]);

const normalizeDisplayName = (value?: string | null) => {
  const compact = String(value || '').replace(/\s+/g, ' ').trim();
  if (!compact) return '';

  return compact
    .toLowerCase()
    .split(' ')
    .map((token, idx) => {
      if (idx > 0 && NAME_PARTICLES.has(token)) return token;
      return token.replace(/(^|[-'`’])([a-zà-öø-ÿ])/g, (_, prefix: string, chr: string) => {
        return `${prefix}${chr.toUpperCase()}`;
      });
    })
    .join(' ');
};

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

const generateParticipantClientId = () =>
  `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`.slice(0, 128);

const getApiBaseUrl = () => {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';
  if (!raw) return '';
  let normalized = raw.replace(/\/+$/, '');
  normalized = normalized.replace(/\/admin$/i, '');
  return normalized;
};

const buildAbsoluteApiUrl = (baseUrl: string, input: string) => {
  if (/^https?:\/\//i.test(input)) return input;
  const sanitizedBase = baseUrl.replace(/\/+$/, '');
  const sanitizedPath = input.startsWith('/') ? input : `/${input}`;
  return `${sanitizedBase}${sanitizedPath}`;
};

async function fetchJsonWithTimeout(url: string, init?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROFILE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await response.json() : null;
    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error ||
        `Request failed (${response.status})`;
      throw new Error(message);
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Server timeout bij laden van profiel.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

const parseParticipantIdentityStore = (raw: string | null): ParticipantIdentityStore => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const entries = Object.entries(parsed as Record<string, any>);
    return entries.reduce<ParticipantIdentityStore>((acc, [code, value]) => {
      const normalizedCode = normalizeTripCode(String(code || ''));
      if (!normalizedCode || !value || typeof value !== 'object') return acc;
      const participantId = String((value as any).participantId || '').trim();
      if (!participantId) return acc;
      const avatarUrl = normalizeImageUri((value as any).avatarUrl);
      const updatedAt = String((value as any).updatedAt || '').trim();
      acc[normalizedCode] = {
        participantId,
        avatarUrl: avatarUrl || undefined,
        updatedAt: updatedAt || undefined,
      };
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const participantIdentityExistsForCode = (
  identityStore: ParticipantIdentityStore,
  tripCode: string | null,
  manifest: TripManifest | null
) => {
  const normalizedCode = normalizeTripCode(String(tripCode || ''));
  if (!normalizedCode || !manifest) return false;
  const identity = identityStore[normalizedCode];
  if (!identity?.participantId) return false;
  const participantIds = new Set(
    (Array.isArray(manifest.people?.participants) ? manifest.people?.participants : [])
      .map(person => String(person?.id || '').trim())
      .filter(Boolean)
  );
  return participantIds.has(identity.participantId);
};

const getLocalAvatarOverridesForCode = (
  identityStore: ParticipantIdentityStore,
  tripCode: string | null
) => {
  const normalizedCode = normalizeTripCode(String(tripCode || ''));
  if (!normalizedCode) return {} as Record<string, string>;
  const identity = identityStore[normalizedCode];
  if (!identity?.participantId) return {} as Record<string, string>;
  const avatarUrl = normalizeImageUri(identity.avatarUrl);
  if (!avatarUrl) return {} as Record<string, string>;
  return {
    [identity.participantId]: avatarUrl,
  };
};

const buildParticipantsFromManifest = (
  manifest: TripManifest | null,
  avatarOverridesByParticipantId: Record<string, string> = {}
): Participant[] => {
  if (!manifest) {
    return [];
  }
  const manifestParticipants = manifest?.people?.participants;
  if (manifestParticipants === undefined) {
    return PARTICIPANTS.map(person => ({
      ...person,
      naam: normalizeDisplayName(person.naam),
      emergencyContacts: person.emergencyContacts?.map(contact => ({
        ...contact,
        naam: normalizeDisplayName(contact.naam),
      })),
    }));
  }

  return manifestParticipants.map(person => {
    const avatarOverride = normalizeImageUri(
      avatarOverridesByParticipantId[String(person.id || '').trim()]
    );
    const avatarSource = avatarOverride || normalizeImageUri(person.avatarUrl);
    return {
      id: person.id,
      naam: normalizeDisplayName(person.name),
      bio: person.bio,
      avatar: avatarSource ? { uri: avatarSource } : null,
      emergencyContacts: person.emergencyContacts?.map(contact => ({
        naam: normalizeDisplayName(contact.name),
        telefoon: contact.phone,
      })),
    };
  });
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

const buildEmergencySectionsFromManifest = (manifest: TripManifest | null): EmergencySection[] => {
  const sections = manifest?.emergency?.sections;
  if (sections === undefined) {
    return DEFAULT_EMERGENCY_SECTIONS;
  }
  return (Array.isArray(sections) ? sections : [])
    .map((section, idx) => {
      const title = String(section?.title || '').trim();
      const contacts = (Array.isArray(section?.contacts) ? section.contacts : [])
        .map(contact => ({
          label: String(contact?.label || '').trim(),
          phone: String(contact?.phone || '').trim(),
        }))
        .filter(contact => contact.label && contact.phone);
      if (!title) return null;
      return {
        id: String(section?.id || `emergency-${idx + 1}`),
        title,
        description: String(section?.description || '').trim() || undefined,
        contacts,
      };
    })
    .filter(Boolean) as EmergencySection[];
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

const buildPackingListFromManifest = (
  manifest: TripManifest | null,
  days: Day[],
  includeSuggested: boolean
): PackingItem[] => {
  const templateItems = Array.isArray(manifest?.packingTemplate) ? manifest!.packingTemplate : [];
  if (templateItems.length === 0) {
    return buildDefaultPackingList(days, includeSuggested);
  }

  const seenIds = new Set<string>();
  const rows: PackingItem[] = [];
  templateItems.forEach((item, idx) => {
    const name = String(item?.name || '').trim();
    const category = String(item?.category || '').trim();
    if (!name || !category) return;
    let id = String(item?.id || '').trim() || `tpl-${idx + 1}`;
    if (seenIds.has(id)) {
      id = `${id}-${idx + 1}`;
    }
    seenIds.add(id);
    rows.push({
      id,
      naam: name,
      categorie: category,
      checked: false,
      suggested: item?.suggested === true,
      personal: item?.personal === true,
      assignedTo: item?.assignedTo ?? null,
    });
  });
  return rows;
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
    const [participantAvatarOverrides, setParticipantAvatarOverrides] = useState<Record<string, string>>({});
    const [claimedParticipantById, setClaimedParticipantById] = useState<Record<string, string>>({});
    const [participantIdentityStore, setParticipantIdentityStore] = useState<ParticipantIdentityStore>({});
    const [profileClientId, setProfileClientId] = useState<string>('');
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

  const getParticipantProfilesFromApi = async (tripCode: string): Promise<ParticipantProfileLookup> => {
    const apiBaseUrl = getApiBaseUrl();
    const normalizedCode = normalizeTripCode(tripCode);
    if (!apiBaseUrl || !normalizedCode || normalizedCode === 'DEMO') {
      return {
        avatarOverrides: {},
        claimedByParticipantId: {},
      };
    }

    const endpoint = buildAbsoluteApiUrl(
      apiBaseUrl,
      `${PROFILE_ENDPOINT}?code=${encodeURIComponent(normalizedCode)}`
    );
    let payload: any;
    try {
      payload = await fetchJsonWithTimeout(endpoint, { method: 'GET' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      // Older backend versions do not expose this endpoint yet.
      if (/not found/i.test(message)) {
        return {
          avatarOverrides: {},
          claimedByParticipantId: {},
        };
      }
      throw error;
    }
    const rows = Array.isArray(payload?.profiles) ? payload.profiles : [];
    const avatarOverrides = rows.reduce((acc: Record<string, string>, row: any) => {
      const participantId = String(row?.participantId || '').trim();
      const avatarUrl = normalizeImageUri(row?.avatarUrl);
      if (!participantId || !avatarUrl) return acc;
      acc[participantId] = avatarUrl;
      return acc;
    }, {} as Record<string, string>);
    const claimedByParticipantId = rows.reduce((acc: Record<string, string>, row: any) => {
      const participantId = String(row?.participantId || '').trim();
      const claimedByClientId = String(row?.updatedByClientId || '').trim();
      if (!participantId || !claimedByClientId) return acc;
      acc[participantId] = claimedByClientId;
      return acc;
    }, {} as Record<string, string>);
    return {
      avatarOverrides,
      claimedByParticipantId,
    };
  };

  const ensureProfileClientId = async () => {
    if (profileClientId) {
      return profileClientId;
    }
    const storedClientId = String(
      (await AsyncStorage.getItem(STORAGE_KEY_PARTICIPANT_CLIENT_ID)) || ''
    ).trim();
    if (storedClientId) {
      setProfileClientId(storedClientId);
      return storedClientId;
    }
    const generatedClientId = generateParticipantClientId();
    setProfileClientId(generatedClientId);
    await AsyncStorage.setItem(STORAGE_KEY_PARTICIPANT_CLIENT_ID, generatedClientId);
    return generatedClientId;
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

    let persistedPacking: PackingItem[] = [];
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_PACKING);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          persistedPacking = parsed as PackingItem[];
        }
      }
    } catch (error) {
      console.warn('Could not read persisted packing list before applying manifest:', error);
    }

    const includeSuggested = persistedPacking.length === 0;
    const baseList = buildPackingListFromManifest(manifest, parsedDays, includeSuggested);
    const persistedById = new Map(persistedPacking.map(item => [item.id, item]));
    const baseWithChecked = baseList.map(item => ({
      ...item,
      checked: persistedById.get(item.id)?.checked ?? false,
    }));
    const customItems = persistedPacking.filter(item =>
      typeof item.id === 'string' && item.id.startsWith('custom-')
    );
    const updatedList = mergePackingLists(baseWithChecked, customItems);
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
        const [
          tripSession,
          packingData,
          packingVersion,
          notifEnabled,
          participantIdentityRaw,
          participantClientIdRaw,
        ] = await Promise.all([
          loadTripSessionSnapshot(),
          AsyncStorage.getItem(STORAGE_KEY_PACKING),
          AsyncStorage.getItem(STORAGE_KEY_PACKING_VERSION),
          AsyncStorage.getItem(STORAGE_KEY_NOTIFICATIONS_ENABLED),
          AsyncStorage.getItem(STORAGE_KEY_PARTICIPANT_IDENTITY),
          AsyncStorage.getItem(STORAGE_KEY_PARTICIPANT_CLIENT_ID),
        ]);
        const parsedIdentityStore = parseParticipantIdentityStore(participantIdentityRaw);
        setParticipantIdentityStore(parsedIdentityStore);
        const normalizedClientId = String(participantClientIdRaw || '').trim();
        if (normalizedClientId) {
          setProfileClientId(normalizedClientId);
        } else {
          const generatedClientId = generateParticipantClientId();
          setProfileClientId(generatedClientId);
          await AsyncStorage.setItem(STORAGE_KEY_PARTICIPANT_CLIENT_ID, generatedClientId);
        }

        let loadedDays: Day[] = [];
        let loadedManifest: TripManifest | null = null;
        let hasLoadedTrip = false;

        if (tripSession.tripData) {
          try {
            const loadedTrip = loadDaysFromStoredTrip(tripSession.tripData);
            loadedDays = loadedTrip.days;
            loadedManifest = loadedTrip.manifest;
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
            loadedManifest = null;
            setActiveManifest(null);
            setActiveTripCode(null);
            setDays([]);
          }
        } else {
          loadedManifest = null;
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
            const resolvedHash = hashString(JSON.stringify(resolved.manifest));
            const loadedHash = loadedManifest ? hashString(JSON.stringify(loadedManifest)) : '';
            if (resolved.tripVersion !== storedVersion || resolvedHash !== loadedHash) {
              const refreshedDays = manifestToDays(resolved.manifest);
              loadedDays = refreshedDays;
              loadedManifest = resolved.manifest;
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

        if (hasLoadedTrip && tripSession.activeTripCode) {
          const localOverrides = getLocalAvatarOverridesForCode(
            parsedIdentityStore,
            tripSession.activeTripCode
          );
          try {
            const profileLookup = await getParticipantProfilesFromApi(tripSession.activeTripCode);
            setParticipantAvatarOverrides({
              ...localOverrides,
              ...profileLookup.avatarOverrides,
            });
            setClaimedParticipantById(profileLookup.claimedByParticipantId);
          } catch (profileError) {
            console.warn('Could not refresh participant profile avatars:', profileError);
            setParticipantAvatarOverrides(localOverrides);
            setClaimedParticipantById({});
          }
        } else {
          setParticipantAvatarOverrides({});
          setClaimedParticipantById({});
        }

        const shouldResetPacking = packingVersion !== CURRENT_PACKING_VERSION;
        let existingPacking: PackingItem[] = [];
        if (packingData) {
          try {
            const parsedPacking = JSON.parse(packingData);
            if (Array.isArray(parsedPacking)) {
              existingPacking = parsedPacking as PackingItem[];
            }
          } catch (parseError) {
            console.error('Error parsing packing data, rebuilding from manifest/defaults:', parseError);
          }
        }

        const includeSuggested =
          (!packingData || existingPacking.length === 0) || shouldResetPacking;
        const baseList = buildPackingListFromManifest(loadedManifest, loadedDays, includeSuggested);
        const existingById = new Map(existingPacking.map(item => [item.id, item]));
        const baseWithChecked = baseList.map(item => ({
          ...item,
          checked: existingById.get(item.id)?.checked ?? false,
        }));
        const customItems = existingPacking.filter((item: PackingItem) =>
          typeof item.id === 'string' && item.id.startsWith('custom-')
        );
        const fullList = mergePackingLists(baseWithChecked, customItems);
        setPackingList(fullList);
        await AsyncStorage.multiSet([
          [STORAGE_KEY_PACKING, JSON.stringify(fullList)],
          [STORAGE_KEY_PACKING_VERSION, CURRENT_PACKING_VERSION],
        ]);

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
    const localOverrides = getLocalAvatarOverridesForCode(
      participantIdentityStore,
      resolved.normalizedCode
    );
    try {
      const profileLookup = await getParticipantProfilesFromApi(resolved.normalizedCode);
      setParticipantAvatarOverrides({
        ...localOverrides,
        ...profileLookup.avatarOverrides,
      });
      setClaimedParticipantById(profileLookup.claimedByParticipantId);
    } catch (profileError) {
      console.warn('Could not fetch participant profiles during join:', profileError);
      setParticipantAvatarOverrides(localOverrides);
      setClaimedParticipantById({});
    }
    return {
      normalizedCode: resolved.normalizedCode,
      needsProfileSetup: !participantIdentityExistsForCode(
        participantIdentityStore,
        resolved.normalizedCode,
        resolved.manifest
      ),
    };
  };

  const loadInitialTripData = async () => {
    await applyManifest(createDefaultTripManifest(), {
      version: CURRENT_TRIP_VERSION,
      tripCode: null,
    });
    setParticipantAvatarOverrides({});
    setClaimedParticipantById({});
  };

  const importTSV = async (tsvContent: string) => {
    try {
      const manifest = buildManifestFromLegacyTSV(tsvContent, undefined, {
        ...DEFAULT_MANIFEST_OPTIONS,
        source: 'legacy-tsv',
      });
      await applyManifest(manifest, { version: CUSTOM_TRIP_VERSION, tripCode: null });
      setParticipantAvatarOverrides({});
      setClaimedParticipantById({});
    } catch (error) {
      console.error('Error importing TSV:', error);
      throw error;
    }
  };

  const importTripManifest = async (manifestContent: string) => {
    try {
      const parsedManifest = parseTripManifest(manifestContent);
      await applyManifest(parsedManifest, { version: CURRENT_TRIP_VERSION, tripCode: null });
      setParticipantAvatarOverrides({});
      setClaimedParticipantById({});
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
    setParticipantAvatarOverrides({});
    setClaimedParticipantById({});
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

  const saveMyParticipantProfile = async (
    participantId: string,
    avatarUrl?: string | null
  ) => {
    const normalizedCode = normalizeTripCode(String(activeTripCode || ''));
    const normalizedParticipantId = String(participantId || '').trim();
    if (!normalizedCode) {
      throw new Error('Geen actieve tripcode gevonden.');
    }
    if (!normalizedParticipantId) {
      throw new Error('Kies eerst een deelnemer.');
    }
    const knownIds = new Set(
      (Array.isArray(activeManifest?.people?.participants) ? activeManifest!.people!.participants : [])
        .map(person => String(person?.id || '').trim())
        .filter(Boolean)
    );
    if (!knownIds.has(normalizedParticipantId)) {
      throw new Error('Deze deelnemer bestaat niet in de actieve trip.');
    }
    const resolvedClientId = await ensureProfileClientId();
    const claimedByClientId = String(claimedParticipantById[normalizedParticipantId] || '').trim();
    if (claimedByClientId && claimedByClientId !== resolvedClientId) {
      throw new Error('Deze deelnemer is al geclaimd door iemand anders.');
    }

    const normalizedAvatarUrl = normalizeImageUri(avatarUrl);
    const nextIdentityStore: ParticipantIdentityStore = {
      ...participantIdentityStore,
      [normalizedCode]: {
        participantId: normalizedParticipantId,
        avatarUrl: normalizedAvatarUrl || undefined,
        updatedAt: new Date().toISOString(),
      },
    };
    setParticipantIdentityStore(nextIdentityStore);
    await AsyncStorage.setItem(STORAGE_KEY_PARTICIPANT_IDENTITY, JSON.stringify(nextIdentityStore));

    setParticipantAvatarOverrides(prev => {
      const next = { ...prev };
      if (normalizedAvatarUrl) {
        next[normalizedParticipantId] = normalizedAvatarUrl;
      } else {
        delete next[normalizedParticipantId];
      }
      return next;
    });
    setClaimedParticipantById(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(participantKey => {
        if (next[participantKey] === resolvedClientId && participantKey !== normalizedParticipantId) {
          delete next[participantKey];
        }
      });
      next[normalizedParticipantId] = resolvedClientId;
      return next;
    });

    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl || normalizedCode === 'DEMO') {
      return;
    }

    const endpoint = buildAbsoluteApiUrl(apiBaseUrl, PROFILE_UPSERT_ENDPOINT);
    let payload: any;
    try {
      payload = await fetchJsonWithTimeout(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          code: normalizedCode,
          participantId: normalizedParticipantId,
          clientId: resolvedClientId,
          avatarUrl: normalizedAvatarUrl,
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/not found/i.test(message)) {
        throw new Error(
          'Backend mist profiel-endpoints. Deploy de nieuwste backend en gebruik EXPO_PUBLIC_API_BASE_URL zonder /admin.'
        );
      }
      throw error;
    }
    const rows = Array.isArray(payload?.profiles) ? payload.profiles : [];
    const apiAvatarOverrides = rows.reduce((acc: Record<string, string>, row: any) => {
      const id = String(row?.participantId || '').trim();
      const avatar = normalizeImageUri(row?.avatarUrl);
      if (!id || !avatar) return acc;
      acc[id] = avatar;
      return acc;
    }, {} as Record<string, string>);
    const apiClaimsByParticipantId = rows.reduce((acc: Record<string, string>, row: any) => {
      const id = String(row?.participantId || '').trim();
      const claimedBy = String(row?.updatedByClientId || '').trim();
      if (!id || !claimedBy) return acc;
      acc[id] = claimedBy;
      return acc;
    }, {} as Record<string, string>);
    const localOverrides = getLocalAvatarOverridesForCode(nextIdentityStore, normalizedCode);
    setParticipantAvatarOverrides({
      ...localOverrides,
      ...apiAvatarOverrides,
    });
    setClaimedParticipantById(apiClaimsByParticipantId);
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
    () => buildParticipantsFromManifest(activeManifest, participantAvatarOverrides),
    [activeManifest, participantAvatarOverrides]
  );

  const roomAssignmentsLookup = useMemo(
    () => buildRoomAssignmentsFromManifest(activeManifest),
    [activeManifest]
  );

  const emergencySections = useMemo(
    () => buildEmergencySectionsFromManifest(activeManifest),
    [activeManifest]
  );

  const hasActiveTrip = !!activeManifest && days.length > 0;
  const normalizedActiveCode = normalizeTripCode(String(activeTripCode || ''));
  const activeIdentity = normalizedActiveCode ? participantIdentityStore[normalizedActiveCode] : undefined;
  const myParticipantId =
    activeIdentity && participants.some(person => person.id === activeIdentity.participantId)
      ? activeIdentity.participantId
      : null;
  const myParticipantAvatarUrl = myParticipantId
    ? normalizeImageUri(participantAvatarOverrides[myParticipantId] || activeIdentity?.avatarUrl)
    : '';
  const myClaimedByClientId = myParticipantId
    ? String(claimedParticipantById[myParticipantId] || '').trim()
    : '';
  const isMyParticipantClaimedByOther =
    !!myParticipantId &&
    !!myClaimedByClientId &&
    !!profileClientId &&
    myClaimedByClientId !== profileClientId;
  const needsProfileSetup =
    hasActiveTrip &&
    !!normalizedActiveCode &&
    participants.length > 0 &&
    (
      !participantIdentityExistsForCode(participantIdentityStore, activeTripCode, activeManifest) ||
      isMyParticipantClaimedByOther
    );

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
    emergencySections,
    getRoomAssignments,
    activeTripCode,
    activeTripId: activeManifest?.trip?.id ?? null,
    activeManifest,
    hasActiveTrip,
    profileClientId,
    claimedParticipantById,
    myParticipantId,
    myParticipantAvatarUrl,
    needsProfileSetup,
    notificationsEnabled,
    isLoading,
    activateTripByCode,
    saveMyParticipantProfile,
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
