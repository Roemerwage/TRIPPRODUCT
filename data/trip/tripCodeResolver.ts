import { createDefaultTripManifest, DEFAULT_TRIP_CODE } from '@/data/trip/defaultManifest';
import { TripManifest } from '@/types/tripManifest';
import { parseTripManifest } from '@/utils/trip-manifest';

const RESOLVE_CODE_PATH = '/public/resolve-code';
const DEFAULT_MANIFEST_PATH_PREFIX = '/public/manifests/';
const REQUEST_TIMEOUT_MS = 12000;

type ResolveCodeResponse = {
  tripVersionId: string;
  tripCode?: string;
  manifestUrl?: string;
  manifest?: unknown;
};

export type ResolvedTripCode = {
  normalizedCode: string;
  manifest: TripManifest;
  tripVersion: string;
};

export interface TripCodeResolver {
  resolveTripCode(rawCode: string): Promise<ResolvedTripCode>;
}

export const normalizeTripCode = (rawCode: string) => rawCode.trim().toUpperCase();

const getApiBaseUrl = () => process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';

const buildAbsoluteUrl = (baseUrl: string, input: string) => {
  if (/^https?:\/\//i.test(input)) return input;
  const sanitizedBase = baseUrl.replace(/\/+$/, '');
  const sanitizedPath = input.startsWith('/') ? input : `/${input}`;
  return `${sanitizedBase}${sanitizedPath}`;
};

async function fetchJsonWithTimeout(url: string, init?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
      throw new Error('Server timeout bij laden van trip.');
    }
    if (error instanceof Error && error.message.includes('Network request failed')) {
      throw new Error('Netwerkfout: kan server niet bereiken.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function buildTripVersionFromManifest(code: string, manifest: TripManifest) {
  const hashInput = JSON.stringify({
    tripId: manifest.trip.id,
    startDate: manifest.trip.startDate,
    endDate: manifest.trip.endDate,
    days: manifest.days.length,
  });
  return `code:${code}:${hashString(hashInput)}`;
}

async function resolveTripCodeFromApi(
  apiBaseUrl: string,
  normalizedCode: string
): Promise<ResolvedTripCode> {
  const resolveUrl = buildAbsoluteUrl(apiBaseUrl, RESOLVE_CODE_PATH);
  const resolvePayload = (await fetchJsonWithTimeout(resolveUrl, {
    method: 'POST',
    body: JSON.stringify({ code: normalizedCode }),
  })) as ResolveCodeResponse;

  if (!resolvePayload?.tripVersionId) {
    throw new Error('Server response mist tripVersionId.');
  }

  const resolvedCode = normalizeTripCode(resolvePayload.tripCode || normalizedCode);
  const rawManifest = resolvePayload.manifest
    ? resolvePayload.manifest
    : await fetchManifestFromApi(apiBaseUrl, resolvePayload.tripVersionId, resolvePayload.manifestUrl);

  const manifest = parseTripManifest(rawManifest);
  return {
    normalizedCode: resolvedCode,
    manifest,
    tripVersion: resolvePayload.tripVersionId,
  };
}

async function fetchManifestFromApi(
  apiBaseUrl: string,
  tripVersionId: string,
  manifestUrl?: string
): Promise<unknown> {
  const manifestPath = manifestUrl ?? `${DEFAULT_MANIFEST_PATH_PREFIX}${encodeURIComponent(tripVersionId)}`;
  const absoluteManifestUrl = buildAbsoluteUrl(apiBaseUrl, manifestPath);
  return fetchJsonWithTimeout(absoluteManifestUrl, { method: 'GET' });
}

export class ApiTripCodeResolver implements TripCodeResolver {
  async resolveTripCode(rawCode: string): Promise<ResolvedTripCode> {
    const normalizedCode = normalizeTripCode(rawCode);
    if (!normalizedCode) {
      throw new Error('Voer een tripcode in.');
    }

    const apiBaseUrl = getApiBaseUrl();

    if (normalizedCode === 'DEMO') {
      const manifest = createDefaultTripManifest();
      return {
        normalizedCode: DEFAULT_TRIP_CODE,
        manifest,
        tripVersion: buildTripVersionFromManifest(DEFAULT_TRIP_CODE, manifest),
      };
    }

    if (!apiBaseUrl) {
      if (normalizedCode === DEFAULT_TRIP_CODE) {
        const manifest = createDefaultTripManifest();
        return {
          normalizedCode: DEFAULT_TRIP_CODE,
          manifest,
          tripVersion: buildTripVersionFromManifest(DEFAULT_TRIP_CODE, manifest),
        };
      }
      throw new Error(
        'Geen backend geconfigureerd. Stel EXPO_PUBLIC_API_BASE_URL in of gebruik code DEMO.'
      );
    }

    try {
      return await resolveTripCodeFromApi(apiBaseUrl, normalizedCode);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Trip laden via server mislukt.');
    }
  }
}

export const tripCodeResolver: TripCodeResolver = new ApiTripCodeResolver();
