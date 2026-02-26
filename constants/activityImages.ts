import { ImageSourcePropType } from 'react-native';

// Local activity images intentionally removed for anonymized builds.
const LOCAL_ACTIVITY_IMAGES: Record<string, ImageSourcePropType> = {};

// Normalize activity names: strip diacritics, remove punctuation, collapse spaces
const normalize = (value?: string | null): string => {
  if (!value) return '';
  
  // Trim and lowercase
  let normalized = value.trim().toLowerCase();
  
  // Strip diacritics (NFD decompose + remove combining marks)
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Replace em/en-dashes, arrows, and slashes with spaces
  normalized = normalized.replace(/[–—→]/g, ' ').replace(/\//g, ' ');
  
  // Remove other punctuation (keep alphanumeric, spaces, and hyphens/underscores for compound words)
  normalized = normalized.replace(/[()[\]{},.;:'"`]/g, '');
  
  // Collapse multiple spaces to single space
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
};

// Remove day suffixes like "dag 1", "dag 2", "day 1", etc.
const stripDaySuffix = (value: string): string => {
  return value.replace(/\s+(?:dag|day)\s+\d+(?:\s|$)/i, ' ').trim();
};

export function getLocalActivityImage(key?: string | null): ImageSourcePropType | undefined {
  const normalized = normalize(key);
  if (!normalized) return undefined;
  
  // Try exact normalized match first
  if (LOCAL_ACTIVITY_IMAGES[normalized]) {
    return LOCAL_ACTIVITY_IMAGES[normalized];
  }
  
  // If not found, try without day suffix (e.g., "tres picos dag 2" -> "tres picos")
  const withoutDay = stripDaySuffix(normalized);
  if (withoutDay !== normalized && LOCAL_ACTIVITY_IMAGES[withoutDay]) {
    return LOCAL_ACTIVITY_IMAGES[withoutDay];
  }
  
  return undefined;
}
