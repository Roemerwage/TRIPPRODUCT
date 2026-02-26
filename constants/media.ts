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

const ILHA_GRANDE_FREE_DAY_SUGGESTIONS: Array<{
  id: string;
  title: string;
  description: string;
  coordinate: Coordinate;
  link: string;
  type: ActivityType;
}> = [];

export const FREE_DAY_MARKERS = ILHA_GRANDE_FREE_DAY_SUGGESTIONS;

export type TipType = 'bar' | 'restaurant' | 'brunch' | 'juice' | 'street' | 'square' | 'gym' | 'event';

export const TIP_TYPE_META: Record<TipType, { label: string; emoji: string; color: string }> = {
  event: { label: 'Event', emoji: '🎉', color: '#C1121F' },
  bar: { label: 'Bar', emoji: '🍺', color: '#E07A5F' },
  restaurant: { label: 'Restaurant', emoji: '🍽️', color: '#3D405B' },
  brunch: { label: 'Brunch', emoji: '🥞', color: '#81B29A' },
  juice: { label: 'Juice/ontbijt', emoji: '🥤', color: '#F2CC8F' },
  street: { label: 'Straat', emoji: '🛣️', color: '#5F6C7B' },
  square: { label: 'Plein', emoji: '🏛️', color: '#6D597A' },
  gym: { label: 'Gym', emoji: '🏋️', color: '#1D3557' },
};

export const TIP_MARKERS: {
  id: string;
  title: string;
  description: string;
  coordinate: Coordinate;
  link: string;
  type: TipType;
}[] = [];

const COORDINATE_PATTERNS: RegExp[] = [
  /@(-?\d+\.\d+),(-?\d+\.\d+)/,
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
  /q=(-?\d+\.\d+),(-?\d+\.\d+)/,
  /%40(-?\d+\.\d+)%2C(-?\d+\.\d+)/,
  /\?ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
];

export function extractCoordinatesFromLink(link?: string | null): Coordinate | undefined {
  if (!link || link === 'x' || link.toLowerCase() === 'unknown') return undefined;
  const decoded = decodeURIComponent(link);
  for (const pattern of COORDINATE_PATTERNS) {
    const match = decoded.match(pattern);
    if (match && match[1] && match[2]) {
      const latitude = parseFloat(match[1]);
      const longitude = parseFloat(match[2]);
      if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
        return { latitude, longitude };
      }
    }
  }
  return undefined;
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
  return typeof img === 'string' ? { uri: img } : img;
};

export function getActivityImage(activity: Activity): ImageSourcePropType | undefined {
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
