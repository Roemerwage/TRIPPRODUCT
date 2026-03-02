import AsyncStorage from '@react-native-async-storage/async-storage';
import { TripManifest } from '@/types/tripManifest';

export const STORAGE_KEY_TRIP = '@trip_data';
export const STORAGE_KEY_TRIP_VERSION = '@trip_data_version';
export const STORAGE_KEY_ACTIVE_TRIP_CODE = '@active_trip_code';

export type TripSessionSnapshot = {
  tripData: string | null;
  tripVersion: string | null;
  activeTripCode: string | null;
};

export async function loadTripSessionSnapshot(): Promise<TripSessionSnapshot> {
  const [tripData, tripVersion, activeTripCode] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEY_TRIP),
    AsyncStorage.getItem(STORAGE_KEY_TRIP_VERSION),
    AsyncStorage.getItem(STORAGE_KEY_ACTIVE_TRIP_CODE),
  ]);

  return {
    tripData,
    tripVersion,
    activeTripCode,
  };
}

export async function saveTripManifest(manifest: TripManifest, version: string): Promise<void> {
  await AsyncStorage.multiSet([
    [STORAGE_KEY_TRIP, JSON.stringify(manifest)],
    [STORAGE_KEY_TRIP_VERSION, version],
  ]);
}

export async function saveActiveTripCode(code: string | null): Promise<void> {
  if (code) {
    await AsyncStorage.setItem(STORAGE_KEY_ACTIVE_TRIP_CODE, code);
    return;
  }
  await AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_TRIP_CODE);
}

export async function clearTripSession(): Promise<void> {
  await AsyncStorage.multiRemove([
    STORAGE_KEY_TRIP,
    STORAGE_KEY_TRIP_VERSION,
    STORAGE_KEY_ACTIVE_TRIP_CODE,
  ]);
}
