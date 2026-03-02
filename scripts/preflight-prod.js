#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

function readJson(relativePath) {
  const absolute = path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function parseEnvFile(relativePath) {
  const absolute = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolute)) return {};
  const out = {};
  const lines = fs.readFileSync(absolute, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    out[key] = value;
  }
  return out;
}

const failures = [];
const warnings = [];
const notes = [];

const appConfig = readJson('app.json');
const expo = appConfig.expo || {};

const iosBundleId = expo.ios?.bundleIdentifier || '';
const androidPackage = expo.android?.package || '';
const slug = expo.slug || '';
const appVersion = expo.version || '';
const iosBuildNumber = expo.ios?.buildNumber || '';
const androidVersionCode = expo.android?.versionCode;

const envProduction = parseEnvFile('.env.production');
const envLocal = parseEnvFile('.env');

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  envProduction.EXPO_PUBLIC_API_BASE_URL ||
  envLocal.EXPO_PUBLIC_API_BASE_URL ||
  '';

if (!iosBundleId || iosBundleId.startsWith('com.example.')) {
  failures.push(
    `iOS bundleIdentifier is not production-ready (${iosBundleId || 'missing'}).`
  );
}

if (!androidPackage || androidPackage.startsWith('com.example.')) {
  failures.push(
    `Android package is not production-ready (${androidPackage || 'missing'}).`
  );
}

if (!slug || slug.includes('demo')) {
  warnings.push(`Expo slug looks like a demo value (${slug || 'missing'}).`);
}

if (!appVersion) {
  failures.push('App version is missing in app.json.');
}

if (!iosBuildNumber || Number.isNaN(Number(iosBuildNumber))) {
  failures.push(`iOS buildNumber is invalid (${iosBuildNumber || 'missing'}).`);
}

if (!Number.isInteger(androidVersionCode)) {
  failures.push(
    `Android versionCode is invalid (${String(androidVersionCode || 'missing')}).`
  );
}

if (!apiBaseUrl) {
  failures.push(
    'EXPO_PUBLIC_API_BASE_URL is missing (.env.production recommended for release builds).'
  );
} else {
  if (!/^https:\/\//i.test(apiBaseUrl)) {
    failures.push(`EXPO_PUBLIC_API_BASE_URL must use HTTPS in production (${apiBaseUrl}).`);
  }

  const localHostPattern = /localhost|127\.0\.0\.1|0\.0\.0\.0/i;
  if (localHostPattern.test(apiBaseUrl)) {
    failures.push(
      `EXPO_PUBLIC_API_BASE_URL points to local host (${apiBaseUrl}). TestFlight users cannot reach this.`
    );
  }
}

notes.push('Reminder: protect /admin before going public (reverse proxy auth or network allowlist).');
notes.push('Reminder: publish a trip + join code and validate join flow on 2+ physical devices.');

function printList(label, values) {
  if (!values.length) return;
  console.log(`\n${label}`);
  for (const value of values) {
    console.log(`- ${value}`);
  }
}

console.log('Production preflight check');
console.log(`- iOS bundleIdentifier: ${iosBundleId || '(missing)'}`);
console.log(`- Android package: ${androidPackage || '(missing)'}`);
console.log(`- EXPO_PUBLIC_API_BASE_URL: ${apiBaseUrl || '(missing)'}`);

printList('Failures', failures);
printList('Warnings', warnings);
printList('Notes', notes);

if (failures.length) {
  console.log(`\nResult: FAILED (${failures.length} blocking item${failures.length === 1 ? '' : 's'})`);
  process.exit(1);
}

console.log('\nResult: PASS');
process.exit(0);
