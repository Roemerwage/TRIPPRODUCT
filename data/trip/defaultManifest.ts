import { INITIAL_TSV_DATA } from '@/constants/initialTripData';
import { INITIAL_PLACES_DATA } from '@/constants/initialPlacesData';
import { TripManifest } from '@/types/tripManifest';
import { buildManifestFromLegacyTSV, DEFAULT_MANIFEST_OPTIONS } from '@/utils/trip-manifest';

export const DEFAULT_TRIP_CODE = 'RIO2026';

export function createDefaultTripManifest(): TripManifest {
  return buildManifestFromLegacyTSV(INITIAL_TSV_DATA, INITIAL_PLACES_DATA, {
    ...DEFAULT_MANIFEST_OPTIONS,
    source: 'seed',
  });
}
