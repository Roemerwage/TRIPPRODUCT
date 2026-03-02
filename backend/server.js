const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { DatabaseSync } = require('node:sqlite');
const { importLegacyTripData } = require('./importers/legacy-tsv');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const MANIFESTS_DIR = path.join(ROOT_DIR, 'manifests');
const ADMIN_DIR = path.join(ROOT_DIR, 'admin');
const DB_PATH = path.join(DATA_DIR, 'app.db');
const JOIN_CODES_SEED_PATH = path.join(DATA_DIR, 'join-codes.json');
const TIPS_LIBRARY_SEED_PATH = path.join(DATA_DIR, 'tips-library.seed.json');
const ACTIVITY_LIBRARY_SEED_PATH = path.join(DATA_DIR, 'activity-library.seed.json');
const DEMO_MANIFEST_PATH = path.join(MANIFESTS_DIR, 'trv_demo.json');

const MAX_BODY_BYTES = 12 * 1024 * 1024;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const VALID_ID_REGEX = /^[a-zA-Z0-9:_-]+$/;
const VALID_JOIN_CODE_REGEX = /^[A-Z0-9_-]+$/;
const VALID_TIP_ID_REGEX = /^[a-zA-Z0-9:_-]+$/;
const TIP_TYPES = new Set([
  'event',
  'bar',
  'restaurant',
  'brunch',
  'juice',
  'street',
  'square',
  'gym',
  'cafe',
  'beach',
  'market',
  'museum',
  'nightlife',
  'viewpoint',
  'shopping',
  'custom',
]);
const ACTIVITY_LIBRARY_TYPES = new Set([
  'travel',
  'tour',
  'hike',
  'event',
  'breakfast',
  'lunch',
  'dinner',
  'drinks',
  'free_day',
  'flight',
]);
const IMAGE_LIBRARY_USAGE_TYPES = new Set(['activity', 'avatar', 'template', 'generic']);
const DESTINATION_KEY_ALIAS_MAP = new Map([
  ['brazilie', 'brazil'],
  ['brazili', 'brazil'],
  ['brasil', 'brazil'],
  ['ilhagrande', 'ilha-grande'],
  ['costa-rica', 'costa-rica'],
  ['costarica', 'costa-rica'],
  ['el-salvador', 'el-salvador'],
  ['elsalvador', 'el-salvador'],
  ['rio-de-janeiro', 'rio'],
  ['riodejaneiro', 'rio'],
  ['lustrumreizen-brazil', 'brazil'],
  ['lustrumreizen-mexico', 'mexico'],
  ['lustrumreizen-guatemala', 'guatemala'],
  ['lustrumreizen-panama', 'panama'],
  ['lustrumreizen-nicaragua', 'nicaragua'],
  ['lustrumreizen-colombia', 'colombia'],
  ['lustrumreizen-peru', 'peru'],
  ['lustrumreizen-costa-rica', 'costa-rica'],
  ['lustrumreizen-ecuador', 'ecuador'],
  ['lustrumreizen-el-salvador', 'el-salvador'],
  ['lustrumreizen-honduras', 'honduras'],
  ['lustrumreizen-belize', 'belize'],
]);
const MAP_COORDINATE_PATTERNS = [
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

const nowIso = () => new Date().toISOString();

const normalizeCode = input => String(input || '').trim().toUpperCase();
const normalizeTipType = input => String(input || '').trim().toLowerCase();
const normalizeTipEmoji = input => {
  const raw = String(input || '').trim();
  if (!raw) return '';
  return Array.from(raw).slice(0, 4).join('');
};
const normalizeActivityLibraryType = input => {
  const normalized = String(input || '').trim().toLowerCase();
  if (normalized === 'ontbijt') return 'breakfast';
  if (normalized === 'diner') return 'dinner';
  if (normalized === 'drink') return 'drinks';
  return normalized;
};
const normalizeTipId = input => String(input || '').trim();
const normalizeTipDestinationKey = input => {
  const normalized = String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return DESTINATION_KEY_ALIAS_MAP.get(normalized) || normalized;
};

const normalizeTipDestinationKeys = input => {
  const values = Array.isArray(input)
    ? input
    : String(input || '')
        .split(',')
        .map(item => item.trim());
  return Array.from(
    new Set(
      values
        .map(normalizeTipDestinationKey)
        .filter(Boolean)
    )
  );
};

const normalizeHost = rawHost => String(rawHost || '').trim().toLowerCase();

const isGoogleMapsHost = host => {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (normalized === 'maps.app.goo.gl' || normalized === 'goo.gl') return true;
  return (
    normalized === 'google.com' ||
    normalized === 'maps.google.com' ||
    normalized.endsWith('.google.com')
  );
};

const isValidCoordinatePair = (latitude, longitude) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

function extractCoordinateFromMapsUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  for (const pattern of MAP_COORDINATE_PATTERNS) {
    const globalPattern = new RegExp(
      pattern.source,
      pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
    );
    const matches = Array.from(decoded.matchAll(globalPattern));
    for (let idx = matches.length - 1; idx >= 0; idx -= 1) {
      const match = matches[idx];
      if (!match || !match[1] || !match[2]) continue;
      const latitude = Number.parseFloat(match[1]);
      const longitude = Number.parseFloat(match[2]);
      if (!isValidCoordinatePair(latitude, longitude)) continue;
      return { latitude, longitude };
    }
  }

  return null;
}

async function resolveGoogleMapsCoordinate(inputUrl) {
  const raw = String(inputUrl || '').trim();
  if (!raw) return null;

  const direct = extractCoordinateFromMapsUrl(raw);
  if (direct) {
    return {
      coordinate: direct,
      resolvedUrl: raw,
    };
  }

  let currentUrl = raw;
  for (let hop = 0; hop < 8; hop += 1) {
    let response = null;
    try {
      response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
      });
    } catch {
      break;
    }

    const locationHeader = response.headers.get('location');
    if (!locationHeader) break;

    const nextUrl = new URL(locationHeader, currentUrl).toString();
    const fromRedirectTarget = extractCoordinateFromMapsUrl(nextUrl);
    if (fromRedirectTarget) {
      return {
        coordinate: fromRedirectTarget,
        resolvedUrl: nextUrl,
      };
    }
    currentUrl = nextUrl;
  }

  try {
    const finalResponse = await fetch(currentUrl, {
      method: 'GET',
      redirect: 'follow',
    });
    const finalUrl = finalResponse.url || currentUrl;
    const fromFinalUrl = extractCoordinateFromMapsUrl(finalUrl);
    if (fromFinalUrl) {
      return {
        coordinate: fromFinalUrl,
        resolvedUrl: finalUrl,
      };
    }
  } catch {
    return null;
  }

  return null;
}

const makeId = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeJoinCodeSeed = input =>
  normalizeCode(input)
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);

function joinCodeExists(db, code) {
  return Boolean(db.prepare(`SELECT code FROM join_codes WHERE code = ? LIMIT 1`).get(code));
}

function getLatestActiveJoinCodeForTrip(db, tripId) {
  return (
    db
      .prepare(
        `SELECT code
         FROM join_codes
         WHERE trip_id = ? AND active = 1
         ORDER BY updated_at DESC
         LIMIT 1`
      )
      .get(tripId)?.code || null
  );
}

function generateUniqueJoinCode(db, trip) {
  const seed = normalizeJoinCodeSeed(trip?.name || trip?.id || '') || 'TRIP';
  for (let i = 0; i < 40; i += 1) {
    const suffix = Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, 'A');
    const candidate = `${seed}${suffix}`.slice(0, 14);
    if (!joinCodeExists(db, candidate)) {
      return candidate;
    }
  }

  const fallback = `${seed}${Date.now().toString(36).toUpperCase().slice(-6)}`.slice(0, 14);
  if (!joinCodeExists(db, fallback)) {
    return fallback;
  }

  return `${seed}${Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0')}`.slice(0, 14);
}

function makeApiError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function respondJson(res, status, payload) {
  res.writeHead(status, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload));
}

function respondText(res, status, contentType, body) {
  res.writeHead(status, {
    ...CORS_HEADERS,
    'Content-Type': contentType,
  });
  res.end(body);
}

function parseJsonSafely(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
}

async function parseRequestBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error('Request body too large');
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};

  const parsed = parseJsonSafely(raw);
  if (!parsed.ok) throw new Error('Invalid JSON body');
  return parsed.value;
}

function validateManifestShape(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return 'Manifest moet een object zijn.';
  }
  if (manifest.version !== 1) {
    return 'Manifest version moet 1 zijn.';
  }
  if (!manifest.trip || typeof manifest.trip !== 'object') {
    return 'Manifest mist trip object.';
  }
  if (typeof manifest.trip.id !== 'string' || !manifest.trip.id.trim()) {
    return 'trip.id is verplicht.';
  }
  if (typeof manifest.trip.name !== 'string' || !manifest.trip.name.trim()) {
    return 'trip.name is verplicht.';
  }
  if (typeof manifest.trip.timezone !== 'string' || !manifest.trip.timezone.trim()) {
    return 'trip.timezone is verplicht.';
  }
  if (typeof manifest.trip.startDate !== 'string' || !manifest.trip.startDate.trim()) {
    return 'trip.startDate is verplicht.';
  }
  if (typeof manifest.trip.endDate !== 'string' || !manifest.trip.endDate.trim()) {
    return 'trip.endDate is verplicht.';
  }
  if (!Array.isArray(manifest.days) || manifest.days.length === 0) {
    return 'days moet een niet-lege array zijn.';
  }
  for (const day of manifest.days) {
    if (!day || typeof day !== 'object') {
      return 'Elke day moet een object zijn.';
    }
    if (typeof day.id !== 'string' || !day.id.trim()) {
      return 'Elke day moet een id hebben.';
    }
    if (typeof day.date !== 'string' || !day.date.trim()) {
      return 'Elke day moet een date hebben.';
    }
    if (!Array.isArray(day.activities)) {
      return 'Elke day moet activities array hebben.';
    }
  }
  return null;
}

function openDatabase() {
  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trip_versions (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      manifest_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('draft', 'published', 'archived')),
      created_at TEXT NOT NULL,
      published_at TEXT,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_trip_versions_trip_id ON trip_versions(trip_id);
    CREATE INDEX IF NOT EXISTS idx_trip_versions_status ON trip_versions(status);

    CREATE TABLE IF NOT EXISTS join_codes (
      code TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      trip_version_id TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      FOREIGN KEY (trip_version_id) REFERENCES trip_versions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tips_library (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      link TEXT NOT NULL,
      type TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '',
      destination_keys_json TEXT NOT NULL DEFAULT '[]',
      tags_json TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tips_library_active ON tips_library(active);
    CREATE INDEX IF NOT EXISTS idx_tips_library_updated_at ON tips_library(updated_at DESC);

    CREATE TABLE IF NOT EXISTS activity_library (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      depart_from TEXT NOT NULL DEFAULT '',
      transport TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      maps_link TEXT NOT NULL DEFAULT '',
      image_data TEXT NOT NULL DEFAULT '',
      destination_keys_json TEXT NOT NULL DEFAULT '[]',
      tags_json TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_activity_library_active ON activity_library(active);
    CREATE INDEX IF NOT EXISTS idx_activity_library_updated_at ON activity_library(updated_at DESC);

    CREATE TABLE IF NOT EXISTS image_library (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL DEFAULT '',
      image_data TEXT NOT NULL DEFAULT '',
      usage_type TEXT NOT NULL DEFAULT 'generic',
      destination_keys_json TEXT NOT NULL DEFAULT '[]',
      tags_json TEXT NOT NULL DEFAULT '[]',
      trip_id TEXT NOT NULL DEFAULT '',
      trip_name TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_image_library_active ON image_library(active);
    CREATE INDEX IF NOT EXISTS idx_image_library_usage_type ON image_library(usage_type);
    CREATE INDEX IF NOT EXISTS idx_image_library_updated_at ON image_library(updated_at DESC);
  `);
  try {
    db.exec(`ALTER TABLE tips_library ADD COLUMN emoji TEXT NOT NULL DEFAULT ''`);
  } catch {
    // ignore when column already exists
  }
  try {
    db.exec(`ALTER TABLE activity_library ADD COLUMN image_data TEXT NOT NULL DEFAULT ''`);
  } catch {
    // ignore when column already exists
  }
  try {
    db.exec(`ALTER TABLE image_library ADD COLUMN usage_type TEXT NOT NULL DEFAULT 'generic'`);
  } catch {
    // ignore when column already exists
  }
  try {
    db.exec(`ALTER TABLE image_library ADD COLUMN destination_keys_json TEXT NOT NULL DEFAULT '[]'`);
  } catch {
    // ignore when column already exists
  }
  try {
    db.exec(`ALTER TABLE image_library ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'`);
  } catch {
    // ignore when column already exists
  }
  try {
    db.exec(`ALTER TABLE image_library ADD COLUMN trip_id TEXT NOT NULL DEFAULT ''`);
  } catch {
    // ignore when column already exists
  }
  try {
    db.exec(`ALTER TABLE image_library ADD COLUMN trip_name TEXT NOT NULL DEFAULT ''`);
  } catch {
    // ignore when column already exists
  }
  try {
    db.exec(`ALTER TABLE image_library ADD COLUMN active INTEGER NOT NULL DEFAULT 1`);
  } catch {
    // ignore when column already exists
  }
  return db;
}

async function ensureDirectories() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(MANIFESTS_DIR, { recursive: true });
  await fs.mkdir(ADMIN_DIR, { recursive: true });
}

async function readJsonFile(filePath, fallbackValue = null) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

function getTripById(db, tripId) {
  return (
    db
      .prepare(
        `SELECT id, name, created_at AS createdAt
         FROM trips
         WHERE id = ?`
      )
      .get(tripId) || null
  );
}

function getTripVersionById(db, versionId) {
  return (
    db
      .prepare(
        `SELECT id, trip_id AS tripId, manifest_json AS manifestJson, status, created_at AS createdAt, published_at AS publishedAt
         FROM trip_versions
         WHERE id = ?`
      )
      .get(versionId) || null
  );
}

function getLatestDraftVersionByTripId(db, tripId) {
  return (
    db
      .prepare(
        `SELECT id, trip_id AS tripId, manifest_json AS manifestJson, status, created_at AS createdAt, published_at AS publishedAt
         FROM trip_versions
         WHERE trip_id = ? AND status = 'draft'
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .get(tripId) || null
  );
}

async function bootstrapTipsLibrary(db) {
  const countRow = db.prepare(`SELECT COUNT(*) AS count FROM tips_library`).get();
  const hasTips = Number(countRow?.count || 0) > 0;
  if (hasTips) return;

  const seedTips = await readJsonFile(TIPS_LIBRARY_SEED_PATH, []);
  if (!Array.isArray(seedTips) || seedTips.length === 0) return;

  const upsertTip = db.prepare(
    `INSERT INTO tips_library (id, title, description, link, type, emoji, destination_keys_json, tags_json, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       link = excluded.link,
       type = excluded.type,
       emoji = excluded.emoji,
       destination_keys_json = excluded.destination_keys_json,
       tags_json = excluded.tags_json,
       active = excluded.active,
       updated_at = excluded.updated_at`
  );

  const now = nowIso();
  seedTips.forEach((tip, index) => {
    const rawId = normalizeTipId(tip?.id);
    const id = rawId || `tip_seed_${index + 1}`;
    const title = String(tip?.title || '').trim();
    const description = String(tip?.description || '').trim();
    const link = String(tip?.link || '').trim();
    const type = normalizeTipType(tip?.type);
    const emoji = normalizeTipEmoji(tip?.emoji);
    if (!title || !description || !link || !TIP_TYPES.has(type)) return;
    const destinationKeys = normalizeTipDestinationKeys(tip?.destinationKeys);
    const tags = Array.isArray(tip?.tags)
      ? tip.tags.map(item => String(item || '').trim()).filter(Boolean)
      : [];
    const active = tip?.active === false ? 0 : 1;
    upsertTip.run(
      id,
      title,
      description,
      link,
      type,
      emoji,
      JSON.stringify(destinationKeys),
      JSON.stringify(tags),
      active,
      now,
      now
    );
  });
}

async function bootstrapActivityLibrary(db) {
  const countRow = db.prepare(`SELECT COUNT(*) AS count FROM activity_library`).get();
  const hasActivities = Number(countRow?.count || 0) > 0;
  if (hasActivities) return;

  const seedActivities = await readJsonFile(ACTIVITY_LIBRARY_SEED_PATH, []);
  if (!Array.isArray(seedActivities) || seedActivities.length === 0) return;

  const upsertActivity = db.prepare(
    `INSERT INTO activity_library (id, name, type, location, depart_from, transport, description, maps_link, image_data, destination_keys_json, tags_json, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       type = excluded.type,
       location = excluded.location,
       depart_from = excluded.depart_from,
       transport = excluded.transport,
       description = excluded.description,
       maps_link = excluded.maps_link,
       image_data = excluded.image_data,
       destination_keys_json = excluded.destination_keys_json,
       tags_json = excluded.tags_json,
       active = excluded.active,
       updated_at = excluded.updated_at`
  );

  const now = nowIso();
  seedActivities.forEach((activity, index) => {
    const rawId = normalizeTipId(activity?.id);
    const id = rawId || `activity_seed_${index + 1}`;
    const name = String(activity?.name || '').trim();
    const type = normalizeActivityLibraryType(activity?.type);
    if (!name || !ACTIVITY_LIBRARY_TYPES.has(type)) return;
    const location = String(activity?.location || '').trim();
    const departFrom = String(activity?.departFrom || '').trim();
    const transport = String(activity?.transport || '').trim();
    const description = String(activity?.description || '').trim();
    const mapsLink = String(activity?.mapsLink || '').trim();
    const imageData = String(activity?.imageData || '').trim();
    const destinationKeys = normalizeTipDestinationKeys(activity?.destinationKeys);
    const tags = Array.isArray(activity?.tags)
      ? activity.tags.map(item => String(item || '').trim()).filter(Boolean)
      : [];
    const active = activity?.active === false ? 0 : 1;
    upsertActivity.run(
      id,
      name,
      type,
      location,
      departFrom,
      transport,
      description,
      mapsLink,
      imageData,
      JSON.stringify(destinationKeys),
      JSON.stringify(tags),
      active,
      now,
      now
    );
  });
}

async function bootstrapSeedData(db) {
  const versionCountRow = db.prepare(`SELECT COUNT(*) AS count FROM trip_versions`).get();
  const hasAnyVersion = Number(versionCountRow?.count || 0) > 0;

  if (!hasAnyVersion) {
    const manifest = await readJsonFile(DEMO_MANIFEST_PATH, null);
    if (manifest) {
      const validationError = validateManifestShape(manifest);
      if (!validationError) {
        const tripId = String(manifest.trip.id || 'trip_demo').trim();
        const tripName = String(manifest.trip.name || 'Demo Trip').trim();
        const now = nowIso();

        db.prepare(
          `INSERT OR IGNORE INTO trips (id, name, created_at)
           VALUES (?, ?, ?)`
        ).run(tripId, tripName, now);

        db.prepare(
          `INSERT OR REPLACE INTO trip_versions (id, trip_id, manifest_json, status, created_at, published_at)
           VALUES (?, ?, ?, 'published', ?, ?)`
        ).run('trv_demo', tripId, JSON.stringify(manifest), now, now);
      }
    }
  }

  const seedCodes = await readJsonFile(JOIN_CODES_SEED_PATH, []);
  if (Array.isArray(seedCodes)) {
    const upsertJoinCode = db.prepare(
      `INSERT INTO join_codes (code, trip_id, trip_version_id, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET
         trip_id = excluded.trip_id,
         trip_version_id = excluded.trip_version_id,
         active = excluded.active,
         updated_at = excluded.updated_at`
    );

    for (const row of seedCodes) {
      const code = normalizeCode(row?.code);
      const tripVersionId = String(row?.tripVersionId || '').trim();
      if (!code || !tripVersionId) continue;

      const version = getTripVersionById(db, tripVersionId);
      if (!version) continue;

      const now = nowIso();
      const active = row?.active === false ? 0 : 1;
      upsertJoinCode.run(code, version.tripId, tripVersionId, active, now, now);
    }
  }

  await bootstrapTipsLibrary(db);
  await bootstrapActivityLibrary(db);
}

function listTrips(db) {
  return db.prepare(`SELECT id, name, created_at AS createdAt FROM trips ORDER BY created_at DESC`).all();
}

function listTripVersions(db) {
  return db
    .prepare(
      `SELECT id, trip_id AS tripId, status, created_at AS createdAt, published_at AS publishedAt
       FROM trip_versions
       ORDER BY created_at DESC`
    )
    .all();
}

function listJoinCodes(db) {
  return db
    .prepare(
      `SELECT code, trip_id AS tripId, trip_version_id AS tripVersionId, active, created_at AS createdAt, updated_at AS updatedAt
       FROM join_codes
       ORDER BY updated_at DESC`
    )
    .all()
    .map(row => ({ ...row, active: Boolean(row.active) }));
}

function parseJsonArray(value) {
  const parsed = parseJsonSafely(String(value || '[]'));
  if (!parsed.ok || !Array.isArray(parsed.value)) return [];
  return parsed.value;
}

function listTipsLibrary(db, options = {}) {
  const activeOnly = options.activeOnly === true;
  const rows = activeOnly
    ? db
        .prepare(
          `SELECT id, title, description, link, type, emoji, destination_keys_json AS destinationKeysJson, tags_json AS tagsJson, active, created_at AS createdAt, updated_at AS updatedAt
           FROM tips_library
           WHERE active = 1
           ORDER BY updated_at DESC`
        )
        .all()
    : db
        .prepare(
          `SELECT id, title, description, link, type, emoji, destination_keys_json AS destinationKeysJson, tags_json AS tagsJson, active, created_at AS createdAt, updated_at AS updatedAt
           FROM tips_library
           ORDER BY updated_at DESC`
        )
        .all();

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    description: row.description,
    link: row.link,
    type: row.type,
    emoji: normalizeTipEmoji(row.emoji),
    destinationKeys: parseJsonArray(row.destinationKeysJson).map(normalizeTipDestinationKey).filter(Boolean),
    tags: parseJsonArray(row.tagsJson).map(item => String(item || '').trim()).filter(Boolean),
    active: Boolean(row.active),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

function getTipById(db, tipId) {
  return (
    db
      .prepare(
        `SELECT id, title, description, link, type, emoji, destination_keys_json AS destinationKeysJson, tags_json AS tagsJson, active, created_at AS createdAt, updated_at AS updatedAt
         FROM tips_library
         WHERE id = ?
         LIMIT 1`
      )
      .get(tipId) || null
  );
}

function listActivityLibrary(db, options = {}) {
  const activeOnly = options.activeOnly === true;
  const rows = activeOnly
    ? db
        .prepare(
          `SELECT id, name, type, location, depart_from AS departFrom, transport, description, maps_link AS mapsLink, image_data AS imageData, destination_keys_json AS destinationKeysJson, tags_json AS tagsJson, active, created_at AS createdAt, updated_at AS updatedAt
           FROM activity_library
           WHERE active = 1
           ORDER BY updated_at DESC`
        )
        .all()
    : db
        .prepare(
          `SELECT id, name, type, location, depart_from AS departFrom, transport, description, maps_link AS mapsLink, image_data AS imageData, destination_keys_json AS destinationKeysJson, tags_json AS tagsJson, active, created_at AS createdAt, updated_at AS updatedAt
           FROM activity_library
           ORDER BY updated_at DESC`
        )
        .all();

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    type: row.type,
    location: row.location,
    departFrom: row.departFrom,
    transport: row.transport,
    description: row.description,
    mapsLink: row.mapsLink,
    imageData: row.imageData || '',
    destinationKeys: parseJsonArray(row.destinationKeysJson).map(normalizeTipDestinationKey).filter(Boolean),
    tags: parseJsonArray(row.tagsJson).map(item => String(item || '').trim()).filter(Boolean),
    active: Boolean(row.active),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

function getActivityLibraryById(db, activityId) {
  return (
    db
      .prepare(
        `SELECT id, name, type, location, depart_from AS departFrom, transport, description, maps_link AS mapsLink, image_data AS imageData, destination_keys_json AS destinationKeysJson, tags_json AS tagsJson, active, created_at AS createdAt, updated_at AS updatedAt
         FROM activity_library
         WHERE id = ?
         LIMIT 1`
      )
      .get(activityId) || null
  );
}

function normalizeImageUsageType(input) {
  const normalized = String(input || '').trim().toLowerCase();
  if (!normalized) return 'generic';
  if (normalized === 'person') return 'avatar';
  if (normalized === 'activity_template') return 'template';
  return IMAGE_LIBRARY_USAGE_TYPES.has(normalized) ? normalized : 'generic';
}

function listImageLibrary(db, options = {}) {
  const activeOnly = options.activeOnly !== false;
  const usageType = normalizeImageUsageType(options.usageType);
  const destinationKey = normalizeTipDestinationKey(options.destinationKey);
  const tripId = String(options.tripId || '').trim();

  const clauses = [];
  const params = [];
  if (activeOnly) {
    clauses.push('active = 1');
  }
  if (usageType && usageType !== 'generic') {
    clauses.push('(usage_type = ? OR usage_type = ?)');
    params.push(usageType, 'generic');
  }
  if (tripId) {
    clauses.push('trip_id = ?');
    params.push(tripId);
  }
  if (destinationKey) {
    clauses.push('destination_keys_json LIKE ?');
    params.push(`%\"${destinationKey}\"%`);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT id, label, image_data AS imageData, usage_type AS usageType, destination_keys_json AS destinationKeysJson, tags_json AS tagsJson, trip_id AS tripId, trip_name AS tripName, active, created_at AS createdAt, updated_at AS updatedAt
       FROM image_library
       ${whereSql}
       ORDER BY updated_at DESC`
    )
    .all(...params);

  return rows.map(row => ({
    id: row.id,
    label: row.label || '',
    imageData: row.imageData || '',
    usageType: normalizeImageUsageType(row.usageType),
    destinationKeys: parseJsonArray(row.destinationKeysJson).map(normalizeTipDestinationKey).filter(Boolean),
    tags: parseJsonArray(row.tagsJson).map(item => String(item || '').trim()).filter(Boolean),
    tripId: row.tripId || '',
    tripName: row.tripName || '',
    active: Boolean(row.active),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

function getImageLibraryById(db, imageId) {
  return (
    db
      .prepare(
        `SELECT id, label, image_data AS imageData, usage_type AS usageType, destination_keys_json AS destinationKeysJson, tags_json AS tagsJson, trip_id AS tripId, trip_name AS tripName, active, created_at AS createdAt, updated_at AS updatedAt
         FROM image_library
         WHERE id = ?
         LIMIT 1`
      )
      .get(imageId) || null
  );
}

function getImageLibraryByImageData(db, imageData) {
  return (
    db
      .prepare(
        `SELECT id, label, image_data AS imageData, usage_type AS usageType, destination_keys_json AS destinationKeysJson, tags_json AS tagsJson, trip_id AS tripId, trip_name AS tripName, active, created_at AS createdAt, updated_at AS updatedAt
         FROM image_library
         WHERE image_data = ?
         LIMIT 1`
      )
      .get(imageData) || null
  );
}

async function serveAdminPage(res) {
  const htmlPath = path.join(ADMIN_DIR, 'index.html');
  try {
    const html = await fs.readFile(htmlPath, 'utf8');
    respondText(res, 200, 'text/html; charset=utf-8', html);
  } catch {
    respondText(res, 500, 'text/plain; charset=utf-8', 'Admin page missing');
  }
}

function resolvePublishedCode(db, code) {
  return (
    db
      .prepare(
        `SELECT jc.code, jc.trip_version_id AS tripVersionId
         FROM join_codes jc
         INNER JOIN trip_versions tv ON tv.id = jc.trip_version_id
         WHERE jc.code = ? AND jc.active = 1 AND tv.status = 'published'
         LIMIT 1`
      )
      .get(code) || null
  );
}

function getPublishedManifest(db, tripVersionId) {
  const row = db
    .prepare(
      `SELECT manifest_json AS manifestJson
       FROM trip_versions
       WHERE id = ? AND status = 'published'
       LIMIT 1`
    )
    .get(tripVersionId);

  if (!row) return null;
  const parsed = parseJsonSafely(row.manifestJson);
  if (!parsed.ok) return null;
  return parsed.value;
}

function runTransaction(db, work) {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

async function handleCreateTrip(db, req, res) {
  let body;
  try {
    body = await parseRequestBody(req);
  } catch (error) {
    respondJson(res, 400, { message: error.message });
    return;
  }

  const name = String(body?.name || '').trim();
  const providedId = String(body?.id || '').trim();
  const tripId = providedId || makeId('trip');

  if (!name) {
    respondJson(res, 400, { message: 'name is verplicht.' });
    return;
  }

  if (!VALID_ID_REGEX.test(tripId)) {
    respondJson(res, 400, { message: 'id bevat ongeldige tekens.' });
    return;
  }

  const existing = getTripById(db, tripId);
  if (existing) {
    respondJson(res, 409, { message: 'Trip id bestaat al.' });
    return;
  }

  const createdAt = nowIso();
  db.prepare(`INSERT INTO trips (id, name, created_at) VALUES (?, ?, ?)`).run(tripId, name, createdAt);

  respondJson(res, 201, {
    id: tripId,
    name,
    createdAt,
  });
}

async function handleCreateTripVersion(db, req, res, tripId) {
  const trip = getTripById(db, tripId);
  if (!trip) {
    respondJson(res, 404, { message: 'Trip niet gevonden.' });
    return;
  }

  let body;
  try {
    body = await parseRequestBody(req);
  } catch (error) {
    respondJson(res, 400, { message: error.message });
    return;
  }

  let manifest = body?.manifest;
  if (!manifest && typeof body?.manifestJson === 'string') {
    const parsed = parseJsonSafely(body.manifestJson);
    if (!parsed.ok) {
      respondJson(res, 400, { message: 'manifestJson is geen geldige JSON.' });
      return;
    }
    manifest = parsed.value;
  }

  const validationError = validateManifestShape(manifest);
  if (validationError) {
    respondJson(res, 400, { message: validationError });
    return;
  }

  const versionIdInput = String(body?.versionId || '').trim();
  const versionId = versionIdInput || makeId('trv');
  if (!VALID_ID_REGEX.test(versionId)) {
    respondJson(res, 400, { message: 'versionId bevat ongeldige tekens.' });
    return;
  }

  const existingVersion = getTripVersionById(db, versionId);
  if (existingVersion) {
    respondJson(res, 409, { message: 'Version id bestaat al.' });
    return;
  }

  const normalizedManifest = {
    ...manifest,
    trip: {
      ...manifest.trip,
      id: trip.id,
      name: manifest.trip.name || trip.name,
    },
  };

  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO trip_versions (id, trip_id, manifest_json, status, created_at, published_at)
     VALUES (?, ?, ?, 'draft', ?, NULL)`
  ).run(versionId, trip.id, JSON.stringify(normalizedManifest), createdAt);

  respondJson(res, 201, {
    id: versionId,
    tripId: trip.id,
    status: 'draft',
    createdAt,
  });
}

async function handlePublishTripVersion(db, req, res, versionId) {
  const version = getTripVersionById(db, versionId);
  if (!version) {
    respondJson(res, 404, { message: 'Trip version niet gevonden.' });
    return;
  }

  const publishedAt = nowIso();
  runTransaction(db, () => {
    db.prepare(
      `UPDATE trip_versions
       SET status = 'archived'
       WHERE trip_id = ? AND status = 'published' AND id <> ?`
    ).run(version.tripId, version.id);

    db.prepare(
      `UPDATE trip_versions
       SET status = 'published', published_at = ?
       WHERE id = ?`
    ).run(publishedAt, version.id);
  });

  respondJson(res, 200, {
    id: version.id,
    tripId: version.tripId,
    status: 'published',
    publishedAt,
  });
}

async function handleSaveTripDraft(db, req, res) {
  let body;
  try {
    body = await parseRequestBody(req);
  } catch (error) {
    respondJson(res, 400, { message: error.message });
    return;
  }

  let manifest = body?.manifest;
  if (!manifest && typeof body?.manifestJson === 'string') {
    const parsed = parseJsonSafely(body.manifestJson);
    if (!parsed.ok) {
      respondJson(res, 400, { message: 'manifestJson is geen geldige JSON.' });
      return;
    }
    manifest = parsed.value;
  }

  const validationError = validateManifestShape(manifest);
  if (validationError) {
    respondJson(res, 400, { message: validationError });
    return;
  }

  const tripId = String(manifest.trip.id || '').trim();
  const tripName = String(manifest.trip.name || '').trim();
  if (!VALID_ID_REGEX.test(tripId)) {
    respondJson(res, 400, { message: 'trip.id bevat ongeldige tekens.' });
    return;
  }

  const versionIdInput = String(body?.versionId || '').trim();
  if (versionIdInput && !VALID_ID_REGEX.test(versionIdInput)) {
    respondJson(res, 400, { message: 'versionId bevat ongeldige tekens.' });
    return;
  }

  try {
    const saved = runTransaction(db, () => {
      const createdAt = nowIso();
      let trip = getTripById(db, tripId);
      let tripCreated = false;

      if (!trip) {
        db.prepare(`INSERT INTO trips (id, name, created_at) VALUES (?, ?, ?)`).run(tripId, tripName, createdAt);
        trip = {
          id: tripId,
          name: tripName,
          createdAt,
        };
        tripCreated = true;
      } else if (tripName && trip.name !== tripName) {
        db.prepare(`UPDATE trips SET name = ? WHERE id = ?`).run(tripName, tripId);
        trip = {
          ...trip,
          name: tripName,
        };
      }

      const normalizedManifest = {
        ...manifest,
        trip: {
          ...manifest.trip,
          id: trip.id,
          name: trip.name,
        },
      };

      let version = null;
      let createdVersion = false;

      if (versionIdInput) {
        const existingVersion = getTripVersionById(db, versionIdInput);
        if (existingVersion) {
          if (existingVersion.tripId !== trip.id) {
            throw makeApiError(409, 'Version id hoort bij een andere trip.');
          }
          if (existingVersion.status !== 'draft') {
            throw makeApiError(409, 'Alleen draft versies kunnen overschreven worden.');
          }

          db.prepare(
            `UPDATE trip_versions
             SET manifest_json = ?
             WHERE id = ?`
          ).run(JSON.stringify(normalizedManifest), existingVersion.id);

          version = {
            id: existingVersion.id,
            tripId: existingVersion.tripId,
            status: 'draft',
            createdAt: existingVersion.createdAt,
            publishedAt: existingVersion.publishedAt,
          };
        } else {
          db.prepare(
            `INSERT INTO trip_versions (id, trip_id, manifest_json, status, created_at, published_at)
             VALUES (?, ?, ?, 'draft', ?, NULL)`
          ).run(versionIdInput, trip.id, JSON.stringify(normalizedManifest), createdAt);

          version = {
            id: versionIdInput,
            tripId: trip.id,
            status: 'draft',
            createdAt,
            publishedAt: null,
          };
          createdVersion = true;
        }
      } else {
        const latestDraft = getLatestDraftVersionByTripId(db, trip.id);
        if (latestDraft) {
          db.prepare(
            `UPDATE trip_versions
             SET manifest_json = ?
             WHERE id = ?`
          ).run(JSON.stringify(normalizedManifest), latestDraft.id);

          version = {
            id: latestDraft.id,
            tripId: latestDraft.tripId,
            status: 'draft',
            createdAt: latestDraft.createdAt,
            publishedAt: latestDraft.publishedAt,
          };
        } else {
          const versionId = makeId('trv');
          db.prepare(
            `INSERT INTO trip_versions (id, trip_id, manifest_json, status, created_at, published_at)
             VALUES (?, ?, ?, 'draft', ?, NULL)`
          ).run(versionId, trip.id, JSON.stringify(normalizedManifest), createdAt);

          version = {
            id: versionId,
            tripId: trip.id,
            status: 'draft',
            createdAt,
            publishedAt: null,
          };
          createdVersion = true;
        }
      }

      return {
        trip: {
          id: trip.id,
          name: trip.name,
          created: tripCreated,
        },
        version,
        createdVersion,
        manifest: normalizedManifest,
      };
    });

    respondJson(res, 200, saved);
  } catch (error) {
    const status = Number(error?.status) || 500;
    respondJson(res, status, {
      message: error instanceof Error ? error.message : 'Opslaan van trip draft mislukt.',
    });
  }
}

async function handlePublishTripVersionWithCode(db, req, res, versionId) {
  const version = getTripVersionById(db, versionId);
  if (!version) {
    respondJson(res, 404, { message: 'Trip version niet gevonden.' });
    return;
  }

  let body = {};
  try {
    body = await parseRequestBody(req);
  } catch (error) {
    respondJson(res, 400, { message: error.message });
    return;
  }

  const joinCodeInput = normalizeCode(body?.joinCode);
  if (joinCodeInput && !VALID_JOIN_CODE_REGEX.test(joinCodeInput)) {
    respondJson(res, 400, { message: 'joinCode bevat ongeldige tekens.' });
    return;
  }

  try {
    const published = runTransaction(db, () => {
      const parsedManifest = parseJsonSafely(String(version.manifestJson || ''));
      const trip = getTripById(db, version.tripId);
      const manifestTrip =
        parsedManifest.ok && parsedManifest.value?.trip
          ? parsedManifest.value.trip
          : { id: version.tripId, name: trip?.name || version.tripId };

      const publishedAt = nowIso();
      db.prepare(
        `UPDATE trip_versions
         SET status = 'archived'
         WHERE trip_id = ? AND status = 'published' AND id <> ?`
      ).run(version.tripId, version.id);

      db.prepare(
        `UPDATE trip_versions
         SET status = 'published', published_at = ?
         WHERE id = ?`
      ).run(publishedAt, version.id);

      let joinCode = joinCodeInput;
      if (joinCode) {
        const existingCode = db
          .prepare(`SELECT code, trip_id AS tripId FROM join_codes WHERE code = ? LIMIT 1`)
          .get(joinCode);
        if (existingCode && existingCode.tripId !== version.tripId) {
          throw makeApiError(409, 'Join code is al in gebruik door een andere trip.');
        }
      } else {
        joinCode = getLatestActiveJoinCodeForTrip(db, version.tripId) || generateUniqueJoinCode(db, manifestTrip);
      }

      const updatedAt = nowIso();
      db.prepare(
        `INSERT INTO join_codes (code, trip_id, trip_version_id, active, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           trip_id = excluded.trip_id,
           trip_version_id = excluded.trip_version_id,
           active = 1,
           updated_at = excluded.updated_at`
      ).run(joinCode, version.tripId, version.id, updatedAt, updatedAt);

      return {
        id: version.id,
        tripId: version.tripId,
        status: 'published',
        publishedAt,
        joinCode,
        manifestUrl: `/public/manifests/${encodeURIComponent(version.id)}`,
      };
    });

    respondJson(res, 200, published);
  } catch (error) {
    const status = Number(error?.status) || 500;
    respondJson(res, status, {
      message: error instanceof Error ? error.message : 'Publiceren van trip versie mislukt.',
    });
  }
}

function handleGetTripVersion(db, res, versionId) {
  if (!VALID_ID_REGEX.test(versionId)) {
    respondJson(res, 400, { message: 'versionId bevat ongeldige tekens.' });
    return;
  }

  const version = getTripVersionById(db, versionId);
  if (!version) {
    respondJson(res, 404, { message: 'Trip version niet gevonden.' });
    return;
  }

  const parsedManifest = parseJsonSafely(String(version.manifestJson || ''));
  if (!parsedManifest.ok) {
    respondJson(res, 500, { message: 'Trip version manifest is ongeldig opgeslagen.' });
    return;
  }

  respondJson(res, 200, {
    id: version.id,
    tripId: version.tripId,
    status: version.status,
    createdAt: version.createdAt,
    publishedAt: version.publishedAt || null,
    manifest: parsedManifest.value,
  });
}

async function handleUpsertJoinCode(db, req, res) {
  let body;
  try {
    body = await parseRequestBody(req);
  } catch (error) {
    respondJson(res, 400, { message: error.message });
    return;
  }

  const code = normalizeCode(body?.code);
  const tripVersionId = String(body?.tripVersionId || '').trim();

  if (!code || !tripVersionId) {
    respondJson(res, 400, { message: 'code en tripVersionId zijn verplicht.' });
    return;
  }

  const version = getTripVersionById(db, tripVersionId);
  if (!version) {
    respondJson(res, 404, { message: 'Trip version niet gevonden.' });
    return;
  }
  if (version.status !== 'published') {
    respondJson(res, 409, { message: 'Join code kan alleen naar een published version verwijzen.' });
    return;
  }

  const active = body?.active === false ? 0 : 1;
  const now = nowIso();
  db.prepare(
    `INSERT INTO join_codes (code, trip_id, trip_version_id, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET
       trip_id = excluded.trip_id,
       trip_version_id = excluded.trip_version_id,
       active = excluded.active,
       updated_at = excluded.updated_at`
  ).run(code, version.tripId, version.id, active, now, now);

  respondJson(res, 200, {
    code,
    tripId: version.tripId,
    tripVersionId: version.id,
    active: Boolean(active),
    updatedAt: now,
  });
}

async function handleImportLegacySpreadsheet(req, res) {
  let body;
  try {
    body = await parseRequestBody(req);
  } catch (error) {
    respondJson(res, 400, { message: error.message });
    return;
  }

  const tripTsv = String(body?.tripTsv || '');
  if (!tripTsv.trim()) {
    respondJson(res, 400, { message: 'tripTsv is verplicht.' });
    return;
  }

  try {
    const imported = importLegacyTripData({
      tripTsvContent: tripTsv,
      placesTsvContent: body?.placesTsv,
      tripId: body?.tripId,
      tripName: body?.tripName,
      timezone: body?.timezone,
      locale: body?.locale,
      defaultYear: body?.defaultYear,
    });

    const validationError = validateManifestShape(imported.manifest);
    if (validationError) {
      respondJson(res, 400, {
        message: `Geimporteerde data is ongeldig: ${validationError}`,
        warnings: imported.warnings,
      });
      return;
    }

    respondJson(res, 200, imported);
  } catch (error) {
    respondJson(res, 400, {
      message: error instanceof Error ? error.message : 'Import mislukt.',
    });
  }
}

async function handlePublishFromManifest(db, req, res) {
  let body;
  try {
    body = await parseRequestBody(req);
  } catch (error) {
    respondJson(res, 400, { message: error.message });
    return;
  }

  let manifest = body?.manifest;
  if (!manifest && typeof body?.manifestJson === 'string') {
    const parsed = parseJsonSafely(body.manifestJson);
    if (!parsed.ok) {
      respondJson(res, 400, { message: 'manifestJson is geen geldige JSON.' });
      return;
    }
    manifest = parsed.value;
  }

  const validationError = validateManifestShape(manifest);
  if (validationError) {
    respondJson(res, 400, { message: validationError });
    return;
  }

  const tripId = String(manifest.trip.id || '').trim();
  const tripName = String(manifest.trip.name || '').trim();
  if (!VALID_ID_REGEX.test(tripId)) {
    respondJson(res, 400, { message: 'trip.id bevat ongeldige tekens.' });
    return;
  }

  const versionIdInput = String(body?.versionId || '').trim();
  if (versionIdInput && !VALID_ID_REGEX.test(versionIdInput)) {
    respondJson(res, 400, { message: 'versionId bevat ongeldige tekens.' });
    return;
  }

  const joinCodeInput = normalizeCode(body?.joinCode);
  if (joinCodeInput && !VALID_JOIN_CODE_REGEX.test(joinCodeInput)) {
    respondJson(res, 400, { message: 'joinCode bevat ongeldige tekens.' });
    return;
  }

  try {
    const result = runTransaction(db, () => {
      const createdAt = nowIso();
      let trip = getTripById(db, tripId);
      let tripCreated = false;

      if (!trip) {
        db.prepare(`INSERT INTO trips (id, name, created_at) VALUES (?, ?, ?)`).run(tripId, tripName, createdAt);
        trip = {
          id: tripId,
          name: tripName,
          createdAt,
        };
        tripCreated = true;
      } else if (tripName && trip.name !== tripName) {
        db.prepare(`UPDATE trips SET name = ? WHERE id = ?`).run(tripName, tripId);
        trip = {
          ...trip,
          name: tripName,
        };
      }

      const versionId = versionIdInput || makeId('trv');
      if (getTripVersionById(db, versionId)) {
        throw makeApiError(409, 'Version id bestaat al.');
      }

      const normalizedManifest = {
        ...manifest,
        trip: {
          ...manifest.trip,
          id: trip.id,
          name: trip.name,
        },
      };

      db.prepare(
        `INSERT INTO trip_versions (id, trip_id, manifest_json, status, created_at, published_at)
         VALUES (?, ?, ?, 'draft', ?, NULL)`
      ).run(versionId, trip.id, JSON.stringify(normalizedManifest), createdAt);

      const publishedAt = nowIso();
      db.prepare(
        `UPDATE trip_versions
         SET status = 'archived'
         WHERE trip_id = ? AND status = 'published' AND id <> ?`
      ).run(trip.id, versionId);

      db.prepare(
        `UPDATE trip_versions
         SET status = 'published', published_at = ?
         WHERE id = ?`
      ).run(publishedAt, versionId);

      let joinCode = joinCodeInput;
      if (joinCode) {
        const existingCode = db
          .prepare(`SELECT code, trip_id AS tripId FROM join_codes WHERE code = ? LIMIT 1`)
          .get(joinCode);
        if (existingCode && existingCode.tripId !== trip.id) {
          throw makeApiError(409, 'Join code is al in gebruik door een andere trip.');
        }
      } else {
        joinCode = getLatestActiveJoinCodeForTrip(db, trip.id) || generateUniqueJoinCode(db, normalizedManifest.trip);
      }

      const updatedAt = nowIso();
      db.prepare(
        `INSERT INTO join_codes (code, trip_id, trip_version_id, active, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           trip_id = excluded.trip_id,
           trip_version_id = excluded.trip_version_id,
           active = 1,
           updated_at = excluded.updated_at`
      ).run(joinCode, trip.id, versionId, updatedAt, updatedAt);

      return {
        trip: {
          id: trip.id,
          name: trip.name,
          created: tripCreated,
        },
        version: {
          id: versionId,
          tripId: trip.id,
          status: 'published',
          createdAt,
          publishedAt,
        },
        joinCode,
        manifest: normalizedManifest,
      };
    });

    respondJson(res, 201, {
      ...result,
      manifestUrl: `/public/manifests/${encodeURIComponent(result.version.id)}`,
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    respondJson(res, status, {
      message: error instanceof Error ? error.message : 'Publish from manifest mislukt.',
    });
  }
}

async function handleUpsertTipLibrary(db, req, res) {
  let body;
  try {
    body = await parseRequestBody(req);
  } catch (error) {
    respondJson(res, 400, { message: error.message });
    return;
  }

  const tipInput = body?.tip && typeof body.tip === 'object' ? body.tip : body;
  const idInput = normalizeTipId(tipInput?.id);
  const id = idInput || makeId('tip');
  if (!VALID_TIP_ID_REGEX.test(id)) {
    respondJson(res, 400, { message: 'Tip id bevat ongeldige tekens.' });
    return;
  }

  const title = String(tipInput?.title || '').trim();
  const description = String(tipInput?.description || '').trim();
  const link = String(tipInput?.link || '').trim();
  const type = normalizeTipType(tipInput?.type);
  const emoji = normalizeTipEmoji(tipInput?.emoji);
  const destinationKeys = normalizeTipDestinationKeys(tipInput?.destinationKeys);
  const tags = Array.isArray(tipInput?.tags)
    ? tipInput.tags.map(item => String(item || '').trim()).filter(Boolean)
    : [];
  const active = tipInput?.active === false ? 0 : 1;

  if (!title) {
    respondJson(res, 400, { message: 'Tip title is verplicht.' });
    return;
  }
  if (!description) {
    respondJson(res, 400, { message: 'Tip description is verplicht.' });
    return;
  }
  if (!link) {
    respondJson(res, 400, { message: 'Tip link is verplicht.' });
    return;
  }
  if (!TIP_TYPES.has(type)) {
    respondJson(res, 400, { message: 'Tip type is ongeldig.' });
    return;
  }

  const now = nowIso();
  const existing = getTipById(db, id);
  if (existing) {
    db.prepare(
      `UPDATE tips_library
       SET title = ?, description = ?, link = ?, type = ?, emoji = ?, destination_keys_json = ?, tags_json = ?, active = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      title,
      description,
      link,
      type,
      emoji,
      JSON.stringify(destinationKeys),
      JSON.stringify(tags),
      active,
      now,
      id
    );
  } else {
    db.prepare(
      `INSERT INTO tips_library (id, title, description, link, type, emoji, destination_keys_json, tags_json, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      title,
      description,
      link,
      type,
      emoji,
      JSON.stringify(destinationKeys),
      JSON.stringify(tags),
      active,
      now,
      now
    );
  }

  const saved = listTipsLibrary(db).find(tip => tip.id === id) || null;
  respondJson(res, existing ? 200 : 201, {
    tip: saved,
    created: !existing,
  });
}

function handleDeleteTipLibrary(db, res, tipIdRaw) {
  const tipId = normalizeTipId(tipIdRaw);
  if (!tipId || !VALID_TIP_ID_REGEX.test(tipId)) {
    respondJson(res, 400, { message: 'Tip id is ongeldig.' });
    return;
  }

  const existing = getTipById(db, tipId);
  if (!existing) {
    respondJson(res, 404, { message: 'Tip niet gevonden.' });
    return;
  }

  db.prepare(`DELETE FROM tips_library WHERE id = ?`).run(tipId);
  respondJson(res, 200, { id: tipId, deleted: true });
}

async function handleUpsertActivityLibrary(db, req, res) {
  let body;
  try {
    body = await parseRequestBody(req);
  } catch (error) {
    respondJson(res, 400, { message: error.message });
    return;
  }

  const activityInput = body?.activity && typeof body.activity === 'object' ? body.activity : body;
  const idInput = normalizeTipId(activityInput?.id);
  const id = idInput || makeId('act_tpl');
  if (!VALID_TIP_ID_REGEX.test(id)) {
    respondJson(res, 400, { message: 'Activity id bevat ongeldige tekens.' });
    return;
  }

  const name = String(activityInput?.name || '').trim();
  const type = normalizeActivityLibraryType(activityInput?.type);
  const location = String(activityInput?.location || '').trim();
  const departFrom = String(activityInput?.departFrom || '').trim();
  const transport = String(activityInput?.transport || '').trim();
  const description = String(activityInput?.description || '').trim();
  const mapsLink = String(activityInput?.mapsLink || '').trim();
  const imageData = String(activityInput?.imageData || '').trim();
  const destinationKeys = normalizeTipDestinationKeys(activityInput?.destinationKeys);
  const tags = Array.isArray(activityInput?.tags)
    ? activityInput.tags.map(item => String(item || '').trim()).filter(Boolean)
    : [];
  const active = activityInput?.active === false ? 0 : 1;

  if (!name) {
    respondJson(res, 400, { message: 'Activity name is verplicht.' });
    return;
  }
  if (!ACTIVITY_LIBRARY_TYPES.has(type)) {
    respondJson(res, 400, { message: 'Activity type is ongeldig.' });
    return;
  }

  const now = nowIso();
  const existing = getActivityLibraryById(db, id);
  if (existing) {
    db.prepare(
      `UPDATE activity_library
       SET name = ?, type = ?, location = ?, depart_from = ?, transport = ?, description = ?, maps_link = ?, image_data = ?, destination_keys_json = ?, tags_json = ?, active = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      name,
      type,
      location,
      departFrom,
      transport,
      description,
      mapsLink,
      imageData,
      JSON.stringify(destinationKeys),
      JSON.stringify(tags),
      active,
      now,
      id
    );
  } else {
    db.prepare(
      `INSERT INTO activity_library (id, name, type, location, depart_from, transport, description, maps_link, image_data, destination_keys_json, tags_json, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      name,
      type,
      location,
      departFrom,
      transport,
      description,
      mapsLink,
      imageData,
      JSON.stringify(destinationKeys),
      JSON.stringify(tags),
      active,
      now,
      now
    );
  }

  const saved = listActivityLibrary(db).find(activity => activity.id === id) || null;
  respondJson(res, existing ? 200 : 201, {
    activity: saved,
    created: !existing,
  });
}

function handleDeleteActivityLibrary(db, res, activityIdRaw) {
  const activityId = normalizeTipId(activityIdRaw);
  if (!activityId || !VALID_TIP_ID_REGEX.test(activityId)) {
    respondJson(res, 400, { message: 'Activity id is ongeldig.' });
    return;
  }

  const existing = getActivityLibraryById(db, activityId);
  if (!existing) {
    respondJson(res, 404, { message: 'Activity template niet gevonden.' });
    return;
  }

  db.prepare(`DELETE FROM activity_library WHERE id = ?`).run(activityId);
  respondJson(res, 200, { id: activityId, deleted: true });
}

async function handleUpsertImageLibrary(db, req, res) {
  let body;
  try {
    body = await parseRequestBody(req);
  } catch (error) {
    respondJson(res, 400, { message: error.message });
    return;
  }

  const imageInput = body?.image && typeof body.image === 'object' ? body.image : body;
  const idInput = normalizeTipId(imageInput?.id);
  const imageData = String(imageInput?.imageData || '').trim();
  const label = String(imageInput?.label || '').trim();
  const usageType = normalizeImageUsageType(imageInput?.usageType);
  const destinationKeys = normalizeTipDestinationKeys(imageInput?.destinationKeys);
  const tags = Array.isArray(imageInput?.tags)
    ? imageInput.tags.map(item => String(item || '').trim()).filter(Boolean)
    : [];
  const tripId = String(imageInput?.tripId || '').trim();
  const tripName = String(imageInput?.tripName || '').trim();
  const active = imageInput?.active === false ? 0 : 1;

  if (!imageData) {
    respondJson(res, 400, { message: 'imageData is verplicht.' });
    return;
  }
  if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(imageData) && !/^https?:\/\//i.test(imageData)) {
    respondJson(res, 400, { message: 'imageData moet een data:image of https URL zijn.' });
    return;
  }

  if (idInput && !VALID_TIP_ID_REGEX.test(idInput)) {
    respondJson(res, 400, { message: 'Image id bevat ongeldige tekens.' });
    return;
  }

  const now = nowIso();
  const existingById = idInput ? getImageLibraryById(db, idInput) : null;
  const existingByImageData = !existingById ? getImageLibraryByImageData(db, imageData) : null;
  const targetId = existingById?.id || existingByImageData?.id || idInput || makeId('img_lib');
  const existing = existingById || existingByImageData;

  const mergedDestinationKeys = Array.from(
    new Set([
      ...parseJsonArray(existing?.destinationKeysJson || '[]')
        .map(normalizeTipDestinationKey)
        .filter(Boolean),
      ...destinationKeys,
    ])
  );
  const mergedTags = Array.from(
    new Set([
      ...parseJsonArray(existing?.tagsJson || '[]').map(item => String(item || '').trim()).filter(Boolean),
      ...tags,
    ])
  );

  if (existing) {
    db.prepare(
      `UPDATE image_library
       SET label = ?, image_data = ?, usage_type = ?, destination_keys_json = ?, tags_json = ?, trip_id = ?, trip_name = ?, active = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      label || existing.label || '',
      imageData,
      usageType || normalizeImageUsageType(existing.usageType),
      JSON.stringify(mergedDestinationKeys),
      JSON.stringify(mergedTags),
      tripId || existing.tripId || '',
      tripName || existing.tripName || '',
      active,
      now,
      targetId
    );
  } else {
    db.prepare(
      `INSERT INTO image_library (id, label, image_data, usage_type, destination_keys_json, tags_json, trip_id, trip_name, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      targetId,
      label,
      imageData,
      usageType,
      JSON.stringify(destinationKeys),
      JSON.stringify(tags),
      tripId,
      tripName,
      active,
      now,
      now
    );
  }

  const saved = listImageLibrary(db, { activeOnly: false }).find(image => image.id === targetId) || null;
  respondJson(res, existing ? 200 : 201, {
    image: saved,
    created: !existing,
  });
}

function handleDeleteImageLibrary(db, res, imageIdRaw) {
  const imageId = normalizeTipId(imageIdRaw);
  if (!imageId || !VALID_TIP_ID_REGEX.test(imageId)) {
    respondJson(res, 400, { message: 'Image id is ongeldig.' });
    return;
  }

  const existing = getImageLibraryById(db, imageId);
  if (!existing) {
    respondJson(res, 404, { message: 'Image niet gevonden.' });
    return;
  }

  db.prepare(`DELETE FROM image_library WHERE id = ?`).run(imageId);
  respondJson(res, 200, { id: imageId, deleted: true });
}

function handleDisableJoinCode(db, res, code) {
  const normalized = normalizeCode(code);
  if (!normalized) {
    respondJson(res, 400, { message: 'Code is verplicht.' });
    return;
  }

  const row = db
    .prepare(`SELECT code FROM join_codes WHERE code = ?`)
    .get(normalized);
  if (!row) {
    respondJson(res, 404, { message: 'Join code niet gevonden.' });
    return;
  }

  const now = nowIso();
  db.prepare(`UPDATE join_codes SET active = 0, updated_at = ? WHERE code = ?`).run(now, normalized);
  respondJson(res, 200, { code: normalized, active: false, updatedAt: now });
}

function handleResolveCode(db, req, res, body) {
  const code = normalizeCode(body?.code);
  if (!code) {
    respondJson(res, 400, { message: 'Code is verplicht.' });
    return;
  }

  const match = resolvePublishedCode(db, code);
  if (!match) {
    respondJson(res, 404, { message: 'Tripcode niet gevonden.' });
    return;
  }

  respondJson(res, 200, {
    tripCode: code,
    tripVersionId: match.tripVersionId,
    manifestUrl: `/public/manifests/${encodeURIComponent(match.tripVersionId)}`,
  });
}

function handleGetManifest(db, res, tripVersionId) {
  if (!VALID_ID_REGEX.test(tripVersionId)) {
    respondJson(res, 400, { message: 'Invalid tripVersionId.' });
    return;
  }

  const manifest = getPublishedManifest(db, tripVersionId);
  if (!manifest) {
    respondJson(res, 404, { message: 'Manifest niet gevonden.' });
    return;
  }

  respondJson(res, 200, manifest);
}

async function handleResolveMapLink(req, res) {
  let body;
  try {
    body = await parseRequestBody(req);
  } catch (error) {
    respondJson(res, 400, { message: error.message });
    return;
  }

  const rawUrl = String(body?.url || body?.link || '').trim();
  if (!rawUrl) {
    respondJson(res, 400, { message: 'url is verplicht.' });
    return;
  }

  let parsedUrl = null;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    respondJson(res, 400, { message: 'url is ongeldig.' });
    return;
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    respondJson(res, 400, { message: 'Alleen http(s) urls zijn toegestaan.' });
    return;
  }

  if (!isGoogleMapsHost(parsedUrl.hostname)) {
    respondJson(res, 400, { message: 'Alleen Google Maps urls worden ondersteund.' });
    return;
  }

  const resolved = await resolveGoogleMapsCoordinate(rawUrl);
  if (!resolved) {
    respondJson(res, 404, { message: 'Geen coordinaten gevonden in maps link.' });
    return;
  }

  respondJson(res, 200, {
    coordinate: resolved.coordinate,
    resolvedUrl: resolved.resolvedUrl,
  });
}

async function createServer() {
  await ensureDirectories();
  const db = openDatabase();
  await bootstrapSeedData(db);

  return http.createServer(async (req, res) => {
    const method = req.method || 'GET';
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    try {
      if (method === 'GET' && pathname === '/health') {
        respondJson(res, 200, { ok: true, service: 'trip-code-api' });
        return;
      }

      if (method === 'GET' && pathname === '/admin') {
        await serveAdminPage(res);
        return;
      }

      if (method === 'GET' && pathname === '/admin/state') {
        respondJson(res, 200, {
          trips: listTrips(db),
          tripVersions: listTripVersions(db),
          joinCodes: listJoinCodes(db),
          tipsLibrary: listTipsLibrary(db),
          activityLibrary: listActivityLibrary(db),
          imageLibrary: listImageLibrary(db, { activeOnly: false }),
        });
        return;
      }

      if (method === 'GET' && pathname === '/admin/tips-library') {
        respondJson(res, 200, { tips: listTipsLibrary(db) });
        return;
      }

      if (method === 'POST' && pathname === '/admin/tips-library') {
        await handleUpsertTipLibrary(db, req, res);
        return;
      }

      if (method === 'GET' && pathname === '/admin/activity-library') {
        respondJson(res, 200, { activities: listActivityLibrary(db) });
        return;
      }

      if (method === 'POST' && pathname === '/admin/activity-library') {
        await handleUpsertActivityLibrary(db, req, res);
        return;
      }

      if (method === 'GET' && pathname === '/admin/image-library') {
        respondJson(res, 200, {
          images: listImageLibrary(db, {
            activeOnly: url.searchParams.get('active') !== 'all',
            usageType: url.searchParams.get('usage') || '',
            destinationKey: url.searchParams.get('destination') || '',
            tripId: url.searchParams.get('tripId') || '',
          }),
        });
        return;
      }

      if (method === 'POST' && pathname === '/admin/image-library') {
        await handleUpsertImageLibrary(db, req, res);
        return;
      }

      if (method === 'POST' && pathname === '/admin/trips') {
        await handleCreateTrip(db, req, res);
        return;
      }

      const createVersionMatch =
        method === 'POST' ? pathname.match(/^\/admin\/trips\/([^/]+)\/versions$/) : null;
      if (createVersionMatch) {
        const tripId = decodeURIComponent(createVersionMatch[1]);
        await handleCreateTripVersion(db, req, res, tripId);
        return;
      }

      const getVersionMatch =
        method === 'GET' ? pathname.match(/^\/admin\/trip-versions\/([^/]+)$/) : null;
      if (getVersionMatch) {
        const versionId = decodeURIComponent(getVersionMatch[1]);
        handleGetTripVersion(db, res, versionId);
        return;
      }

      const publishVersionMatch =
        method === 'POST' ? pathname.match(/^\/admin\/trip-versions\/([^/]+)\/publish$/) : null;
      if (publishVersionMatch) {
        const versionId = decodeURIComponent(publishVersionMatch[1]);
        await handlePublishTripVersion(db, req, res, versionId);
        return;
      }

      const publishVersionWithCodeMatch =
        method === 'POST' ? pathname.match(/^\/admin\/trip-versions\/([^/]+)\/publish-with-code$/) : null;
      if (publishVersionWithCodeMatch) {
        const versionId = decodeURIComponent(publishVersionWithCodeMatch[1]);
        await handlePublishTripVersionWithCode(db, req, res, versionId);
        return;
      }

      if (method === 'GET' && pathname === '/admin/join-codes') {
        respondJson(res, 200, { codes: listJoinCodes(db) });
        return;
      }

      if (method === 'POST' && pathname === '/admin/join-codes') {
        await handleUpsertJoinCode(db, req, res);
        return;
      }

      if (method === 'POST' && pathname === '/admin/save-trip-draft') {
        await handleSaveTripDraft(db, req, res);
        return;
      }

      if (method === 'POST' && pathname === '/admin/publish-from-manifest') {
        await handlePublishFromManifest(db, req, res);
        return;
      }

      if (method === 'POST' && pathname === '/admin/import/legacy-tsv') {
        await handleImportLegacySpreadsheet(req, res);
        return;
      }

      const disableCodeMatch =
        method === 'POST' ? pathname.match(/^\/admin\/join-codes\/([^/]+)\/disable$/) : null;
      if (disableCodeMatch) {
        const code = decodeURIComponent(disableCodeMatch[1]);
        handleDisableJoinCode(db, res, code);
        return;
      }

      const deleteTipMatch =
        method === 'POST' ? pathname.match(/^\/admin\/tips-library\/([^/]+)\/delete$/) : null;
      if (deleteTipMatch) {
        const tipId = decodeURIComponent(deleteTipMatch[1]);
        handleDeleteTipLibrary(db, res, tipId);
        return;
      }

      const deleteActivityMatch =
        method === 'POST' ? pathname.match(/^\/admin\/activity-library\/([^/]+)\/delete$/) : null;
      if (deleteActivityMatch) {
        const activityId = decodeURIComponent(deleteActivityMatch[1]);
        handleDeleteActivityLibrary(db, res, activityId);
        return;
      }

      const deleteImageMatch =
        method === 'POST' ? pathname.match(/^\/admin\/image-library\/([^/]+)\/delete$/) : null;
      if (deleteImageMatch) {
        const imageId = decodeURIComponent(deleteImageMatch[1]);
        handleDeleteImageLibrary(db, res, imageId);
        return;
      }

      if (method === 'GET' && pathname === '/admin/manifests') {
        const manifests = listTripVersions(db).map(row => ({
          id: row.id,
          tripId: row.tripId,
          status: row.status,
          createdAt: row.createdAt,
          publishedAt: row.publishedAt,
        }));
        respondJson(res, 200, { manifests });
        return;
      }

      if (method === 'POST' && pathname === '/public/resolve-code') {
        const body = await parseRequestBody(req);
        handleResolveCode(db, req, res, body);
        return;
      }

      if (method === 'GET' && pathname === '/public/tips-library') {
        respondJson(res, 200, { tips: listTipsLibrary(db, { activeOnly: true }) });
        return;
      }

      const manifestMatch =
        method === 'GET' ? pathname.match(/^\/public\/manifests\/([^/]+)$/) : null;
      if (manifestMatch) {
        const tripVersionId = decodeURIComponent(manifestMatch[1]);
        handleGetManifest(db, res, tripVersionId);
        return;
      }

      if (method === 'POST' && pathname === '/public/resolve-map-link') {
        await handleResolveMapLink(req, res);
        return;
      }

      respondJson(res, 404, { message: 'Not found' });
    } catch (error) {
      console.error('Unhandled server error:', error);
      respondJson(res, 500, { message: 'Internal server error.' });
    }
  });
}

createServer()
  .then(server => {
    server.listen(PORT, HOST, () => {
      console.log(`Trip code API running on http://${HOST}:${PORT}`);
    });
  })
  .catch(error => {
    console.error('Failed to start trip code API:', error);
    process.exit(1);
  });
