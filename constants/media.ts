import { ImageSourcePropType } from "react-native";
import { Activity, ActivityType, Day } from "@/types/trip";
import { getLocalActivityImage } from "@/constants/activityImages";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

interface MediaEntry {
  image?: string | ImageSourcePropType;
  coordinate?: Coordinate;
  link?: string;
}

const normalizeKey = (value?: string | null) =>
  value?.trim().toLowerCase() || undefined;

const CITY_IMAGES: Record<string, string> = {
  'city 1': 'https://picsum.photos/seed/city-1/1600/900',
  'city 2': 'https://picsum.photos/seed/city-2/1600/900',
  'city 3': 'https://picsum.photos/seed/city-3/1600/900',
  'city 4': 'https://picsum.photos/seed/city-4/1600/900',
  'city 5': 'https://picsum.photos/seed/city-5/1600/900',
  'city 6': 'https://picsum.photos/seed/city-6/1600/900',
  'city 7': 'https://picsum.photos/seed/city-7/1600/900',
  'city 8': 'https://picsum.photos/seed/city-8/1600/900',
};

const CITY_COORDINATES: Record<string, Coordinate> = {
  amsterdam: { latitude: 52.3676, longitude: 4.9041 },
  frankfurt: { latitude: 50.1109, longitude: 8.6821 },
  rio: { latitude: -22.9068, longitude: -43.1729 },
  "rio de janeiro": { latitude: -22.9068, longitude: -43.1729 },
  teresopolis: { latitude: -22.4165, longitude: -42.9752 },
  "teresópolis": { latitude: -22.4165, longitude: -42.9752 },
  "ilha grande": { latitude: -23.1394, longitude: -44.1978 },
  buzios: { latitude: -22.7486, longitude: -41.8819 },
  "búzios": { latitude: -22.7486, longitude: -41.8819 },
  'city 1': { latitude: 10.0, longitude: 10.0 },
  'city 2': { latitude: 10.5, longitude: 10.5 },
  'city 3': { latitude: 11.0, longitude: 11.0 },
  'city 4': { latitude: 11.5, longitude: 11.5 },
  'city 5': { latitude: 12.0, longitude: 12.0 },
  'city 6': { latitude: 12.5, longitude: 12.5 },
  'city 7': { latitude: 13.0, longitude: 13.0 },
  'city 8': { latitude: 13.5, longitude: 13.5 },
};

const ACCOMMODATION_META: Record<string, MediaEntry> = {
  'accommodation 1': {
    image: 'https://picsum.photos/seed/accommodation-1/1600/900',
    coordinate: { latitude: 11.0, longitude: 11.2 },
  },
  'accommodation 2': {
    image: 'https://picsum.photos/seed/accommodation-2/1600/900',
    coordinate: { latitude: 11.8, longitude: 11.6 },
  },
  'accommodation 3': {
    image: 'https://picsum.photos/seed/accommodation-3/1600/900',
    coordinate: { latitude: 12.6, longitude: 12.3 },
  },
  'accommodation 4': {
    image: 'https://picsum.photos/seed/accommodation-4/1600/900',
    coordinate: { latitude: 13.3, longitude: 13.0 },
  },
};

const ACTIVITY_META: Record<string, MediaEntry> = {};

const ACTIVITY_TYPE_FALLBACK: Record<ActivityType, MediaEntry & { color: string }> =
  {
    travel: {
      image: 'https://picsum.photos/seed/activity-travel/1600/900',
      coordinate: undefined,
      color: "#FF9500",
    },
    tour: {
      image: 'https://picsum.photos/seed/activity-tour/1600/900',
      coordinate: undefined,
      color: "#34C759",
    },
    hike: {
      image: 'https://picsum.photos/seed/activity-hike/1600/900',
      coordinate: undefined,
      color: "#A2845E",
    },
    event: {
      image: 'https://picsum.photos/seed/activity-event/1600/900',
      coordinate: undefined,
      color: "#AF52DE",
    },
    breakfast: {
      image: undefined,
      coordinate: undefined,
      color: "#F59E0B",
    },
    lunch: {
      image: undefined,
      coordinate: undefined,
      color: "#16A34A",
    },
    dinner: {
      image: undefined,
      coordinate: undefined,
      color: "#C2410C",
    },
    drinks: {
      image: undefined,
      coordinate: undefined,
      color: "#0F766E",
    },
    free_day: {
      image: 'https://picsum.photos/seed/activity-free/1600/900',
      coordinate: undefined,
      color: "#2DD4BF",
    },
    flight: {
      image: 'https://picsum.photos/seed/activity-flight/1600/900',
      coordinate: undefined,
      color: "#0A84FF",
    },
  };

const DAY_IMAGE_OVERRIDES: Record<string, ImageSourcePropType> = {};

const DAY_IMAGES: Record<string, string> = {
  ...CITY_IMAGES,
};

const ILHA_GRANDE_FREE_DAY_SUGGESTIONS: {
  id: string;
  title: string;
  description: string;
  coordinate: Coordinate;
  link: string;
  type: ActivityType;
}[] = [];

export const FREE_DAY_MARKERS = ILHA_GRANDE_FREE_DAY_SUGGESTIONS;

export type TipType =
  | 'event'
  | 'bar'
  | 'restaurant'
  | 'brunch'
  | 'juice'
  | 'street'
  | 'square'
  | 'gym'
  | 'cafe'
  | 'beach'
  | 'market'
  | 'museum'
  | 'nightlife'
  | 'viewpoint'
  | 'shopping'
  | 'custom';

export interface TipMarker {
  id: string;
  title: string;
  description: string;
  link: string;
  type: TipType;
  emoji?: string;
  destinationKeys: string[];
  coordinate?: Coordinate;
  tags?: string[];
  active?: boolean;
}

export const TIP_TYPE_META: Record<TipType, { label: string; emoji: string; color: string }> = {
  event: { label: 'Event', emoji: '🎉', color: '#C1121F' },
  bar: { label: 'Bar', emoji: '🍺', color: '#E07A5F' },
  restaurant: { label: 'Restaurant', emoji: '🍽️', color: '#3D405B' },
  brunch: { label: 'Brunch', emoji: '🥞', color: '#81B29A' },
  juice: { label: 'Juice/ontbijt', emoji: '🥤', color: '#F2CC8F' },
  street: { label: 'Straat', emoji: '🛣️', color: '#5F6C7B' },
  square: { label: 'Plein', emoji: '🏛️', color: '#6D597A' },
  gym: { label: 'Gym', emoji: '🏋️', color: '#1D3557' },
  cafe: { label: 'Café', emoji: '☕', color: '#9C6644' },
  beach: { label: 'Beach', emoji: '🏖️', color: '#3A86FF' },
  market: { label: 'Market', emoji: '🧺', color: '#F4A261' },
  museum: { label: 'Museum', emoji: '🖼️', color: '#4A4E69' },
  nightlife: { label: 'Nightlife', emoji: '🌃', color: '#7B2CBF' },
  viewpoint: { label: 'Viewpoint', emoji: '🌅', color: '#FF7B00' },
  shopping: { label: 'Shopping', emoji: '🛍️', color: '#D62828' },
  custom: { label: 'Custom', emoji: '📌', color: '#495057' },
};

// Productized mode: tips come from admin/backend only.
export const TIP_MARKERS: TipMarker[] = [];

const normalizeDestinationKey = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const REGION_ALIASES: { key: string; matchers: string[] }[] = [
  { key: 'rio', matchers: ['rio', 'rio de janeiro', 'copacabana', 'botafogo'] },
  { key: 'buzios', matchers: ['buzios', 'armacao dos buzios', 'tucuns'] },
  { key: 'ilha-grande', matchers: ['ilha grande', 'abraao'] },
  { key: 'teresopolis', matchers: ['teresopolis', 'teresopolis -> ilha grande', 'vale dos frades'] },
  { key: 'amsterdam', matchers: ['amsterdam'] },
  { key: 'frankfurt', matchers: ['frankfurt'] },
];

export function getDestinationKeysForRegions(regions: (string | null | undefined)[]): string[] {
  const keys = new Set<string>();
  regions.forEach(regionRaw => {
    const region = normalizeDestinationKey(regionRaw);
    if (!region) return;
    REGION_ALIASES.forEach(alias => {
      if (alias.matchers.some(matcher => region.includes(matcher))) {
        keys.add(alias.key);
      }
    });
  });
  return Array.from(keys);
}

export function getReusableTipsForRegions(
  regions: (string | null | undefined)[],
  sourceTips?: TipMarker[]
): TipMarker[] {
  const tipsLibrary = Array.isArray(sourceTips) ? sourceTips : TIP_MARKERS;
  const destinationKeys = new Set(getDestinationKeysForRegions(regions));
  return tipsLibrary.filter(tip => {
    if (tip.active === false) return false;
    if (!tip.destinationKeys || tip.destinationKeys.length === 0) return true;
    return tip.destinationKeys.some(key => destinationKeys.has(normalizeDestinationKey(key)));
  });
}

export async function fetchPublicTipsLibrary(): Promise<TipMarker[] | null> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return null;

  try {
    const response = await fetch(buildAbsoluteUrl(apiBaseUrl, PUBLIC_TIPS_LIBRARY_PATH), {
      method: "GET",
    });
    if (!response.ok) return null;

    const payload = await response.json();
    const tipsRaw = Array.isArray(payload?.tips) ? payload.tips : [];
    return tipsRaw
      .map((item: unknown) => normalizeTipMarker(item))
      .filter(Boolean) as TipMarker[];
  } catch {
    return null;
  }
}

const COORDINATE_PATTERNS: RegExp[] = [
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i,
  /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
  /[?&]destination=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
  /[?&]origin=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
  /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
  /[?&]query=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
  /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
  /[?&]center=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
  /%40(-?\d+(?:\.\d+)?)%2C(-?\d+(?:\.\d+)?)/i,
];

const resolvedGoogleLinkCache = new Map<string, Coordinate | null>();
const RESOLVE_MAP_LINK_PATH = "/public/resolve-map-link";
const PUBLIC_TIPS_LIBRARY_PATH = "/public/tips-library";
const MAP_RESOLVE_TIMEOUT_MS = 5000;

function isValidCoordinatePair(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function tryCreateCoordinate(latitudeRaw: string, longitudeRaw: string): Coordinate | undefined {
  const latitude = Number.parseFloat(latitudeRaw);
  const longitude = Number.parseFloat(longitudeRaw);
  if (!isValidCoordinatePair(latitude, longitude)) return undefined;
  return { latitude, longitude };
}

function tryExtractCoordinatesFromText(raw: string): Coordinate | undefined {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  for (const pattern of COORDINATE_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    const matches = Array.from(decoded.matchAll(globalPattern));
    for (let idx = matches.length - 1; idx >= 0; idx -= 1) {
      const match = matches[idx];
      if (!match || !match[1] || !match[2]) continue;
      const coordinate = tryCreateCoordinate(match[1], match[2]);
      if (coordinate) {
        return coordinate;
      }
    }
  }
  return undefined;
}

const getApiBaseUrl = () => process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? "";

const buildAbsoluteUrl = (baseUrl: string, input: string) => {
  if (/^https?:\/\//i.test(input)) return input;
  const sanitizedBase = baseUrl.replace(/\/+$/, "");
  const sanitizedPath = input.startsWith("/") ? input : `/${input}`;
  return `${sanitizedBase}${sanitizedPath}`;
};

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

const isGoogleMapsHost = (link: string) => {
  try {
    const parsed = new URL(link);
    const host = parsed.hostname.toLowerCase();
    return (
      host === "maps.app.goo.gl" ||
      host === "goo.gl" ||
      host === "google.com" ||
      host === "maps.google.com" ||
      host.endsWith(".google.com")
    );
  } catch {
    return false;
  }
};

const isTipType = (value: string): value is TipType => {
  return Object.prototype.hasOwnProperty.call(TIP_TYPE_META, value);
};

const normalizeTipMarker = (value: unknown): TipMarker | null => {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;

  const id = String(input.id || "").trim();
  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  const link = String(input.link || "").trim();
  const typeRaw = String(input.type || "").trim().toLowerCase();
  if (!id || !title || !description || !link || !isTipType(typeRaw)) {
    return null;
  }
  const emojiRaw = String(input.emoji || "").trim();
  const emoji = emojiRaw ? Array.from(emojiRaw).slice(0, 4).join("") : undefined;

  const destinationKeysRaw = Array.isArray(input.destinationKeys) ? input.destinationKeys : [];
  const destinationKeys = Array.from(
    new Set(
      destinationKeysRaw
        .map((item: unknown) => normalizeDestinationKey(String(item || "")))
        .filter((item): item is string => Boolean(item))
    )
  );

  const tags = Array.isArray(input.tags)
    ? input.tags
        .map((item: unknown) => String(item || "").trim())
        .filter((item): item is string => Boolean(item))
    : [];

  const coordinateInput =
    input.coordinate && typeof input.coordinate === "object"
      ? (input.coordinate as Record<string, unknown>)
      : {};
  const latitude = Number.parseFloat(String(coordinateInput.latitude));
  const longitude = Number.parseFloat(String(coordinateInput.longitude));
  const coordinate =
    Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : undefined;

  return {
    id,
    title,
    description,
    link,
    type: typeRaw,
    emoji,
    destinationKeys,
    coordinate,
    tags,
    active: input.active !== false,
  };
};

async function resolveCoordinatesViaBackend(link: string): Promise<Coordinate | undefined> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return undefined;

  try {
    const response = await fetchWithTimeout(
      buildAbsoluteUrl(apiBaseUrl, RESOLVE_MAP_LINK_PATH),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: link }),
      },
      MAP_RESOLVE_TIMEOUT_MS
    );

    if (!response.ok) return undefined;
    const payload = await response.json();
    const coordinate = payload?.coordinate;
    if (!coordinate) return undefined;
    const latitude = Number.parseFloat(String(coordinate.latitude));
    const longitude = Number.parseFloat(String(coordinate.longitude));
    if (!isValidCoordinatePair(latitude, longitude)) return undefined;
    return { latitude, longitude };
  } catch {
    return undefined;
  }
}

export function extractCoordinatesFromLink(link?: string | null): Coordinate | undefined {
  if (!link || link === "x" || link.toLowerCase() === "unknown") return undefined;
  return tryExtractCoordinatesFromText(link);
}

const shouldResolveShortGoogleLink = (link: string) => {
  try {
    const parsed = new URL(link);
    const host = parsed.hostname.toLowerCase();
    return host.includes("maps.app.goo.gl") || host === "goo.gl";
  } catch {
    return false;
  }
};

export async function resolveCoordinatesFromGoogleMapsLink(link?: string | null): Promise<Coordinate | undefined> {
  if (!link || link === "x" || link.toLowerCase() === "unknown") return undefined;

  const normalized = link.trim();
  if (!normalized) return undefined;

  const direct = extractCoordinatesFromLink(normalized);
  if (direct) return direct;

  if (resolvedGoogleLinkCache.has(normalized)) {
    return resolvedGoogleLinkCache.get(normalized) || undefined;
  }

  if (isGoogleMapsHost(normalized)) {
    const viaBackend = await resolveCoordinatesViaBackend(normalized);
    if (viaBackend) {
      resolvedGoogleLinkCache.set(normalized, viaBackend);
      return viaBackend;
    }
  }

  if (!shouldResolveShortGoogleLink(normalized)) {
    resolvedGoogleLinkCache.set(normalized, null);
    return undefined;
  }

  try {
    // Try to resolve via explicit redirect chain first (more reliable than parsing HTML bodies).
    let currentUrl = normalized;
    for (let hop = 0; hop < 6; hop += 1) {
      let response: Response;
      try {
        response = await fetchWithTimeout(
          currentUrl,
          {
            method: "GET",
            redirect: "manual",
          },
          MAP_RESOLVE_TIMEOUT_MS
        );
      } catch {
        break;
      }

      const directFromCurrent = extractCoordinatesFromLink(currentUrl);
      if (directFromCurrent) {
        resolvedGoogleLinkCache.set(normalized, directFromCurrent);
        return directFromCurrent;
      }

      const locationHeader = response.headers.get("location");
      if (!locationHeader) {
        break;
      }

      const nextUrl = new URL(locationHeader, currentUrl).toString();
      const fromRedirectTarget = extractCoordinatesFromLink(nextUrl);
      if (fromRedirectTarget) {
        resolvedGoogleLinkCache.set(normalized, fromRedirectTarget);
        return fromRedirectTarget;
      }
      currentUrl = nextUrl;
    }

    const response = await fetchWithTimeout(
      normalized,
      {
        method: "GET",
        redirect: "follow",
      },
      MAP_RESOLVE_TIMEOUT_MS
    );

    const finalUrl = response.url || normalized;
    const fromFinalUrl = extractCoordinatesFromLink(finalUrl);
    if (fromFinalUrl) {
      resolvedGoogleLinkCache.set(normalized, fromFinalUrl);
      return fromFinalUrl;
    }
    resolvedGoogleLinkCache.set(normalized, null);
    return undefined;
  } catch {
    resolvedGoogleLinkCache.set(normalized, null);
    return undefined;
  }
}

const toLocalDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayNum = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayNum}`;
};

export function getDayImage(day: Day): ImageSourcePropType | undefined {
  const dateKey = toLocalDateKey(day.datum);
  if (DAY_IMAGE_OVERRIDES[dateKey]) {
    return DAY_IMAGE_OVERRIDES[dateKey];
  }

  const normalized = normalizeKey(day.stadRegio);
  const fallback =
    (normalized && DAY_IMAGES[normalized]) ||
    getAccommodationMedia(day.verblijf)?.image;
  return toImageSource(fallback);
}

export function getAccommodationMedia(name?: string | null): MediaEntry | undefined {
  const normalized = normalizeKey(name);
  if (!normalized) return undefined;
  return ACCOMMODATION_META[normalized];
}

export function getAccommodationCoordinate(
  name?: string | null,
  stadRegio?: string | null,
  mapsLink?: string | null
): Coordinate | undefined {
  const accommodation = getAccommodationMedia(name);
  if (accommodation?.coordinate) {
    return accommodation.coordinate;
  }

  const linkCoords = extractCoordinatesFromLink(mapsLink ?? accommodation?.link);
  if (linkCoords) {
    return linkCoords;
  }

  const normalized = normalizeKey(stadRegio);
  if (normalized && CITY_COORDINATES[normalized]) {
    return CITY_COORDINATES[normalized];
  }
  return undefined;
}

function getActivityMediaByNameOrLocation(name?: string | null, location?: string | null): MediaEntry | undefined {
  const normalizedName = normalizeKey(name);
  if (normalizedName && ACTIVITY_META[normalizedName]) {
    return ACTIVITY_META[normalizedName];
  }

  const normalizedLocation = normalizeKey(location);
  if (normalizedLocation && ACTIVITY_META[normalizedLocation]) {
    return ACTIVITY_META[normalizedLocation];
  }

  return undefined;
}

const toImageSource = (img?: string | ImageSourcePropType): ImageSourcePropType | undefined => {
  if (!img) return undefined;
  if (typeof img !== 'string') return img;
  const normalized = normalizeImageUri(img);
  return normalized ? { uri: normalized } : undefined;
};

const normalizeImageUri = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('data:')) return trimmed;

  const commaIndex = trimmed.indexOf(',');
  if (commaIndex < 0) return trimmed;

  const prefix = trimmed.slice(0, commaIndex + 1);
  const payload = trimmed.slice(commaIndex + 1).replace(/\s+/g, '');
  return `${prefix}${payload}`;
};

export function getActivityImage(activity: Activity): ImageSourcePropType | undefined {
  if (activity.imageUrl && activity.imageUrl.trim()) {
    return toImageSource(activity.imageUrl.trim());
  }

  const local =
    getLocalActivityImage(activity.type) ||
    getLocalActivityImage(activity.naam) ||
    getLocalActivityImage(activity.locatie);
  if (local) {
    return local;
  }

  const meta = getActivityMediaByNameOrLocation(activity.naam, activity.locatie);
  if (meta?.image) {
    return toImageSource(meta.image);
  }
  return toImageSource(ACTIVITY_TYPE_FALLBACK[activity.type]?.image);
}

export function getPlaceImage(name?: string | null, location?: string | null): ImageSourcePropType | undefined {
  const local =
    getLocalActivityImage(name || '') ||
    getLocalActivityImage(location || '');
  if (local) {
    return local;
  }

  const meta = getActivityMediaByNameOrLocation(name, location);
  if (meta?.image) {
    return toImageSource(meta.image);
  }
  return undefined;
}

export function getActivityCoordinate(activity: Activity, fallbackCity?: string): Coordinate | undefined {
  const meta = getActivityMediaByNameOrLocation(activity.naam, activity.locatie);
  if (meta?.coordinate) {
    return meta.coordinate;
  }

  const linkCoords = extractCoordinatesFromLink(activity.mapsLink ?? meta?.link);
  if (linkCoords) {
    return linkCoords;
  }

  const normalizedCity = normalizeKey(fallbackCity);
  if (normalizedCity && CITY_COORDINATES[normalizedCity]) {
    return CITY_COORDINATES[normalizedCity];
  }

  return undefined;
}

export function getActivityTypeColor(type: ActivityType): string {
  return ACTIVITY_TYPE_FALLBACK[type]?.color ?? "#1C1C1E";
}

export function getActivityLink(activity: Activity): string | null {
  const meta = getActivityMediaByNameOrLocation(activity.naam, activity.locatie);
  if (meta?.link) {
    return meta.link;
  }
  if (activity.mapsLink && activity.mapsLink !== 'x' && activity.mapsLink.toLowerCase() !== 'unknown') {
    return activity.mapsLink;
  }
  return null;
}

export function resolveActivityLink(
  name?: string | null,
  location?: string | null,
  fallback?: string | null
): string | undefined {
  const meta = getActivityMediaByNameOrLocation(name, location);
  if (meta?.link) {
    return meta.link;
  }
  if (fallback && fallback !== 'x' && fallback.toLowerCase() !== 'unknown') {
    return fallback;
  }
  return undefined;
}
