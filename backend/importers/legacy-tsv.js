const MONTH_MAP = {
  jan: 0,
  feb: 1,
  mrt: 2,
  mar: 2,
  apr: 3,
  mei: 4,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  okt: 9,
  oct: 9,
  nov: 10,
  dec: 11,
};

const PLACEHOLDER_VALUES = new Set(['', 'x', 'unknown', 'tba', 'tbd', 'nvt', 'n/a', '-', 'na']);

const normalizeText = value => String(value ?? '').trim();
const normalizeLower = value => normalizeText(value).toLowerCase();
const hasMeaningfulText = value => !PLACEHOLDER_VALUES.has(normalizeLower(value));
const normalizeComparable = value =>
  normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const normalizeLinkComparable = value => normalizeComparable(value).replace(/\/+$/, '');
const stripPlacePrefix = value =>
  normalizeComparable(value).replace(/^verblijf:\s*/i, '').replace(/^accommodation:\s*/i, '').trim();

const pad2 = value => String(value).padStart(2, '0');

const formatDateOnly = value =>
  `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;

const formatDateTime = value => {
  if (!value) return null;
  return `${formatDateOnly(value)}T${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(
    value.getSeconds()
  )}`;
};

const slugify = value =>
  normalizeLower(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');

const sanitizeHeader = value => normalizeLower(value).replace(/[^a-z0-9]/g, '');

const normalizeActivityType = value => {
  const normalized = normalizeLower(value);
  if (normalized === 'travel') return 'travel';
  if (normalized === 'tour') return 'tour';
  if (normalized === 'hike') return 'hike';
  if (normalized === 'event') return 'event';
  if (normalized === 'breakfast' || normalized === 'ontbijt') return 'breakfast';
  if (normalized === 'lunch') return 'lunch';
  if (normalized === 'dinner' || normalized === 'diner') return 'dinner';
  if (normalized === 'drinks' || normalized === 'drink') return 'drinks';
  if (normalized === 'free_day' || normalized === 'freeday') return 'free_day';
  if (normalized === 'flight') return 'flight';
  return 'event';
};

const normalizePlaceType = value => {
  const normalized = normalizeLower(value);
  if (normalized === 'food') return 'food';
  if (normalized === 'drink') return 'drink';
  if (normalized === 'nightlife') return 'nightlife';
  if (normalized === 'logistics') return 'logistics';
  if (normalized === 'spot') return 'spot';
  return 'other';
};

const textIncludesAny = (value, candidates) => candidates.some(candidate => value.includes(candidate));

const inferActivityTypeFromPlace = input => {
  const hints = normalizeComparable(
    [input?.group, input?.name, input?.description].filter(Boolean).join(' ')
  );

  if (textIncludesAny(hints, ['ontbijt', 'breakfast', 'brunch'])) return 'breakfast';
  if (textIncludesAny(hints, ['lunch'])) return 'lunch';
  if (textIncludesAny(hints, ['diner', 'dinner', 'avondeten', 'supper'])) return 'dinner';
  if (textIncludesAny(hints, ['drinks', 'drink', 'borrel', 'cocktail', 'bier', 'wijn', 'wine', 'bar', 'night']))
    return 'drinks';

  const type = normalizeComparable(input?.type);
  if (type === 'food') return 'lunch';
  if (type === 'drink' || type === 'nightlife') return 'drinks';
  if (type === 'logistics') return 'travel';
  if (type === 'spot') return 'tour';
  return 'event';
};

const buildPlaceDescription = input => {
  const lines = [];
  const group = normalizeText(input?.group);
  const description = normalizeText(input?.description);
  if (hasMeaningfulText(group)) lines.push(`Moment: ${group}`);
  if (hasMeaningfulText(description)) lines.push(description.replace(/\\n/g, '\n'));

  (Array.isArray(input?.links) ? input.links : []).forEach(link => {
    const label = normalizeText(link?.label);
    const url = normalizeText(link?.url);
    if (!hasMeaningfulText(label) || !hasMeaningfulText(url)) return;
    lines.push(`${label}: ${url}`);
  });

  const normalizedPrimaryLink = normalizeLinkComparable(input?.primaryMapsLink);
  (Array.isArray(input?.locations) ? input.locations : []).forEach(link => {
    const label = normalizeText(link?.label);
    const url = normalizeText(link?.url);
    if (!hasMeaningfulText(label) || !hasMeaningfulText(url)) return;
    if (normalizedPrimaryLink && normalizeLinkComparable(url) === normalizedPrimaryLink) return;
    lines.push(`${label}: ${url}`);
  });

  return lines.join('\n').trim();
};

function detectDelimiter(sampleLine) {
  if (sampleLine.includes('\t')) return '\t';
  const semicolonCount = (sampleLine.match(/;/g) || []).length;
  const commaCount = (sampleLine.match(/,/g) || []).length;
  if (semicolonCount > commaCount) return ';';
  return ',';
}

function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map(value => value.replace(/\r$/, '').trim());
}

function parseDelimitedTable(content) {
  const trimmed = String(content || '').trim();
  if (!trimmed) {
    return { rows: [], header: [] };
  }

  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    return { rows: [], header: [] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const header = parseDelimitedLine(lines[0], delimiter);
  const rows = lines.slice(1).map(line => parseDelimitedLine(line, delimiter));
  return { rows, header };
}

function buildHeaderIndexMap(headerCells) {
  const map = new Map();
  for (let i = 0; i < headerCells.length; i += 1) {
    const key = sanitizeHeader(headerCells[i]);
    if (!key || map.has(key)) continue;
    map.set(key, i);
  }
  return map;
}

function getCell(cells, headerMap, candidates, fallbackIndex = -1) {
  for (const candidate of candidates) {
    const index = headerMap.get(sanitizeHeader(candidate));
    if (index !== undefined) {
      return normalizeText(cells[index] || '');
    }
  }
  if (fallbackIndex >= 0) {
    return normalizeText(cells[fallbackIndex] || '');
  }
  return '';
}

function parseDateValue(raw, defaultYear) {
  const value = normalizeText(raw);
  if (!hasMeaningfulText(value)) return null;

  let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const [, y, m, d] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  match = value.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  match = value.match(/^(\d{1,2})\s+([A-Za-zÀ-ÿ]{3,})\.?,?\s*(\d{4})?$/);
  if (match) {
    const [, d, monthRaw, y] = match;
    const month = MONTH_MAP[monthRaw.toLowerCase()];
    if (month === undefined) return null;
    const year = y ? Number(y) : defaultYear;
    const date = new Date(year, month, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function parseTimeValue(raw, baseDate) {
  const value = normalizeText(raw);
  if (!hasMeaningfulText(value) || !baseDate) return null;

  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  const [, hh, mm, ss] = match;
  const hours = Number(hh);
  const minutes = Number(mm);
  const seconds = ss ? Number(ss) : 0;
  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) return null;

  const date = new Date(baseDate.getTime());
  date.setHours(hours, minutes, seconds, 0);
  return date;
}

function parseMinutes(raw) {
  const value = normalizeText(raw);
  if (!hasMeaningfulText(value)) return null;
  const num = Number.parseInt(value, 10);
  return Number.isNaN(num) ? null : num;
}

function parseLinkPairs(labelsRaw, urlsRaw) {
  const labels = normalizeText(labelsRaw)
    .split('|')
    .map(value => value.trim())
    .filter(Boolean);
  const urls = normalizeText(urlsRaw)
    .split('|')
    .map(value => value.trim())
    .filter(Boolean);

  if (labels.length === 0 || urls.length === 0) return undefined;
  const count = Math.min(labels.length, urls.length);
  return Array.from({ length: count }, (_, idx) => ({
    label: labels[idx],
    url: urls[idx],
  }));
}

function parseTripRows(tripTsvContent, options, warnings) {
  const { rows, header } = parseDelimitedTable(tripTsvContent);
  if (rows.length === 0) {
    throw new Error('Trip spreadsheet moet minimaal 1 data-rij bevatten.');
  }

  const headerMap = buildHeaderIndexMap(header);
  const hasActivityMapsColumn =
    headerMap.has(sanitizeHeader('Activiteit maps link')) ||
    headerMap.has(sanitizeHeader('Activity maps link'));
  const dayMap = new Map();
  let parsedRows = 0;
  let skippedRows = 0;
  let activityCount = 0;

  rows.forEach((cells, idx) => {
    const rowNumber = idx + 2;
    const rowHasActivityMapsColumn = hasActivityMapsColumn && cells.length >= 19;
    const fallbackOffset = rowHasActivityMapsColumn ? 1 : 0;
    const datumRaw = getCell(cells, headerMap, ['Datum', 'Date'], 0);
    const dagRaw = getCell(cells, headerMap, ['Dag', 'Day'], 1);
    const regionRaw = getCell(cells, headerMap, ['Stad / Regio', 'Stad/Regio', 'Regio', 'Region'], 2);
    const verblijfRaw = getCell(cells, headerMap, ['Verblijf', 'Lodging'], 3);
    const verblijfLinkRaw = getCell(cells, headerMap, ['Verblijf link', 'Lodging link'], 4);
    const verblijfAdresRaw = getCell(cells, headerMap, ['Verblijf adres / pin', 'Verblijf adres', 'Lodging address'], 5);
    const mapsRaw = getCell(cells, headerMap, ['Google maps link', 'Maps link'], 6);
    const activiteitRaw = getCell(cells, headerMap, ['Activiteit', 'Activity'], 7);
    const activiteitTypeRaw = getCell(cells, headerMap, ['Activiteitstype', 'Activiteit type', 'Activity type'], 8);
    const activiteitLocatieRaw = getCell(cells, headerMap, ['Activiteit locatie', 'Activity location', 'Locatie'], 9);
    const activiteitMapsRaw = getCell(
      cells,
      headerMap,
      ['Activiteit maps link', 'Activity maps link'],
      rowHasActivityMapsColumn ? 10 : -1
    );
    const startRaw = getCell(cells, headerMap, ['Starttijd', 'Start time'], 10 + fallbackOffset);
    const meetRaw = getCell(cells, headerMap, ['Verzameltijd', 'Meet time'], 11 + fallbackOffset);
    const departRaw = getCell(cells, headerMap, ['Vertrek vanaf', 'Depart from'], 12 + fallbackOffset);
    const transportRaw = getCell(cells, headerMap, ['Vervoer', 'Transport'], 13 + fallbackOffset);
    const travelRaw = getCell(cells, headerMap, ['Reistijd', 'Travel minutes'], 14 + fallbackOffset);
    const meldingRaw = getCell(cells, headerMap, ['Melding', 'Notification time'], 15 + fallbackOffset);
    const avondRaw = getCell(
      cells,
      headerMap,
      ['Avondmelding (template)', 'Avondmelding', 'Evening notification'],
      16 + fallbackOffset
    );
    const beschrijvingRaw = getCell(cells, headerMap, ['Beschrijving', 'Description'], 17 + fallbackOffset);

    const datum = parseDateValue(datumRaw, options.defaultYear);
    if (!datum) {
      skippedRows += 1;
      warnings.push(`Trip row ${rowNumber} overgeslagen: ongeldige datum "${datumRaw}".`);
      return;
    }

    parsedRows += 1;
    const dateKey = formatDateOnly(datum);

    if (!dayMap.has(dateKey)) {
      const sameDayNotice = normalizeLower(avondRaw).includes('zelfde dag');
      const meldingTijd = parseTimeValue(meldingRaw, datum);
      if (meldingTijd && !sameDayNotice) {
        meldingTijd.setDate(meldingTijd.getDate() - 1);
      }

      const lodging =
        hasMeaningfulText(verblijfRaw) ||
        hasMeaningfulText(verblijfLinkRaw) ||
        hasMeaningfulText(verblijfAdresRaw) ||
        hasMeaningfulText(mapsRaw)
          ? {
              name: normalizeText(verblijfRaw),
              link: hasMeaningfulText(verblijfLinkRaw) ? normalizeText(verblijfLinkRaw) : undefined,
              address: hasMeaningfulText(verblijfAdresRaw) ? normalizeText(verblijfAdresRaw) : undefined,
              mapsLink: hasMeaningfulText(mapsRaw) ? normalizeText(mapsRaw) : undefined,
            }
          : undefined;

      dayMap.set(dateKey, {
        id: `day-${dateKey}`,
        date: dateKey,
        dayName: normalizeText(dagRaw),
        region: normalizeText(regionRaw),
        lodging,
        notification:
          meldingTijd || hasMeaningfulText(avondRaw)
            ? {
                time: formatDateTime(meldingTijd),
                eveningTemplate: hasMeaningfulText(avondRaw)
                  ? normalizeText(avondRaw).replace(/\\n/g, '\n')
                  : undefined,
              }
            : undefined,
        activities: [],
      });
    }

    const day = dayMap.get(dateKey);
    if (!day) return;

    const activityName = hasMeaningfulText(activiteitRaw)
      ? normalizeText(activiteitRaw)
      : `Activity ${day.activities.length + 1}`;

    const explicitActivityMapsLink = hasMeaningfulText(activiteitMapsRaw)
      ? normalizeText(activiteitMapsRaw)
      : '';

    let fallbackActivityMapsLink = '';
    if (!explicitActivityMapsLink && hasMeaningfulText(mapsRaw)) {
      const sharedMapLink = normalizeText(mapsRaw);
      const lodgingMapLink = normalizeText(day.lodging?.mapsLink || '');
      const lodgingLooksEmpty =
        !hasMeaningfulText(day.lodging?.name) &&
        !hasMeaningfulText(day.lodging?.link) &&
        !hasMeaningfulText(day.lodging?.address);

      if (!lodgingMapLink || sharedMapLink !== lodgingMapLink || lodgingLooksEmpty) {
        fallbackActivityMapsLink = sharedMapLink;
      }
    }

    day.activities.push({
      id: `${dateKey}-a-${rowNumber}`,
      name: activityName,
      type: normalizeActivityType(activiteitTypeRaw),
      location: hasMeaningfulText(activiteitLocatieRaw) ? normalizeText(activiteitLocatieRaw) : '',
      startTime: formatDateTime(parseTimeValue(startRaw, datum)),
      meetTime: formatDateTime(parseTimeValue(meetRaw, datum)),
      departFrom: hasMeaningfulText(departRaw) ? normalizeText(departRaw) : '',
      transport: hasMeaningfulText(transportRaw) ? normalizeText(transportRaw) : '',
      travelMinutes: parseMinutes(travelRaw),
      description: normalizeText(beschrijvingRaw).replace(/\\n/g, '\n'),
      mapsLink: explicitActivityMapsLink || fallbackActivityMapsLink,
    });
    activityCount += 1;
  });

  if (parsedRows === 0 || dayMap.size === 0) {
    throw new Error('Geen geldige trip-dagen gevonden in spreadsheet.');
  }

  const days = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  for (const day of days) {
    day.activities.sort((a, b) => {
      const aTime = a.meetTime || a.startTime;
      const bTime = b.meetTime || b.startTime;
      if (aTime && bTime) return aTime.localeCompare(bTime);
      if (aTime) return -1;
      if (bTime) return 1;
      return 0;
    });
  }

  return {
    days,
    stats: {
      tripRows: rows.length,
      parsedTripRows: parsedRows,
      skippedTripRows: skippedRows,
      activities: activityCount,
    },
  };
}

function parsePlacesRows(placesTsvContent, dayMap, options, warnings) {
  if (!placesTsvContent || !String(placesTsvContent).trim()) {
    return {
      placesRows: 0,
      parsedPlacesRows: 0,
      skippedPlacesRows: 0,
      places: 0,
      activitiesFromPlaces: 0,
    };
  }

  const { rows, header } = parseDelimitedTable(placesTsvContent);
  const headerMap = buildHeaderIndexMap(header);
  let parsedRows = 0;
  let skippedRows = 0;
  let placeCount = 0;
  let migratedActivityCount = 0;

  rows.forEach((cells, idx) => {
    const rowNumber = idx + 2;
    const datumRaw = getCell(cells, headerMap, ['Datum', 'Date'], 0);
    const groupRaw = getCell(cells, headerMap, ['Dagdeel', 'Group', 'Part of day'], 1);
    const naamRaw = getCell(cells, headerMap, ['Naam', 'Name'], 2);
    const typeRaw = getCell(cells, headerMap, ['Type'], 3);
    const locatieRaw = getCell(cells, headerMap, ['Locatie', 'Location'], 4);
    const mapsRaw = getCell(cells, headerMap, ['Maps link', 'Google maps link'], 5);
    const startRaw = getCell(cells, headerMap, ['Starttijd', 'Start time'], 6);
    const beschrijvingRaw = getCell(cells, headerMap, ['Beschrijving', 'Description'], 7);
    const linkLabelRaw = getCell(cells, headerMap, ['Link label'], 8);
    const linkUrlRaw = getCell(cells, headerMap, ['Link url', 'Link URL'], 9);
    const locationLabelsRaw = getCell(cells, headerMap, ['Locatie labels', 'Location labels'], 10);
    const locationLinksRaw = getCell(cells, headerMap, ['Locatie links', 'Location links'], 11);

    const datum = parseDateValue(datumRaw, options.defaultYear);
    if (!datum) {
      skippedRows += 1;
      warnings.push(`Places row ${rowNumber} overgeslagen: ongeldige datum "${datumRaw}".`);
      return;
    }

    const dateKey = formatDateOnly(datum);
    const day = dayMap.get(dateKey);
    if (!day) {
      skippedRows += 1;
      warnings.push(`Places row ${rowNumber} overgeslagen: dag ${dateKey} bestaat niet in trip data.`);
      return;
    }

    parsedRows += 1;
    const name = hasMeaningfulText(naamRaw) ? normalizeText(naamRaw) : `Place ${day.activities.length + 1}`;
    const links =
      hasMeaningfulText(linkLabelRaw) && hasMeaningfulText(linkUrlRaw)
        ? [{ label: normalizeText(linkLabelRaw), url: normalizeText(linkUrlRaw) }]
        : undefined;

    const placeNameRaw = normalizeComparable(name);
    const placeName = stripPlacePrefix(name);
    const placeLink = normalizeLinkComparable(mapsRaw);
    const lodgingName = normalizeComparable(day.lodging?.name || '');
    const lodgingLink = normalizeLinkComparable(day.lodging?.mapsLink || '');
    const activityNameSet = new Set(day.activities.map(activity => normalizeComparable(activity.name)).filter(Boolean));
    const activityLinkSet = new Set(
      day.activities.map(activity => normalizeLinkComparable(activity.mapsLink)).filter(Boolean)
    );
    const looksLikeAccommodation =
      placeNameRaw.startsWith('verblijf:') || placeNameRaw.startsWith('accommodation:');

    if (
      (looksLikeAccommodation && lodgingName) ||
      (lodgingName && placeName === lodgingName) ||
      (placeName && activityNameSet.has(placeName)) ||
      (placeLink && lodgingLink && placeLink === lodgingLink) ||
      (placeLink && activityLinkSet.has(placeLink))
    ) {
      skippedRows += 1;
      warnings.push(
        `Places row ${rowNumber} overgeslagen: "${name}" dupliceert verblijf of activiteit op ${dateKey}.`
      );
      return;
    }

    const locations = parseLinkPairs(locationLabelsRaw, locationLinksRaw);
    const normalizedMapsLink = hasMeaningfulText(mapsRaw)
      ? normalizeText(mapsRaw)
      : normalizeText(locations?.[0]?.url || '');
    const normalizedLocation = hasMeaningfulText(locatieRaw)
      ? normalizeText(locatieRaw)
      : normalizeText(locations?.[0]?.label || '');

    day.activities.push({
      id: `${dateKey}-a-place-${rowNumber}`,
      name,
      type: inferActivityTypeFromPlace({
        type: normalizePlaceType(typeRaw),
        group: groupRaw,
        name,
        description: beschrijvingRaw,
      }),
      location: normalizedLocation,
      startTime: formatDateTime(parseTimeValue(startRaw, datum)),
      meetTime: null,
      departFrom: '',
      transport: '',
      travelMinutes: null,
      description: buildPlaceDescription({
        group: groupRaw,
        description: beschrijvingRaw,
        links,
        locations,
        primaryMapsLink: normalizedMapsLink,
      }),
      mapsLink: normalizedMapsLink,
    });

    placeCount += 1;
    migratedActivityCount += 1;
  });

  return {
    placesRows: rows.length,
    parsedPlacesRows: parsedRows,
    skippedPlacesRows: skippedRows,
    places: placeCount,
    activitiesFromPlaces: migratedActivityCount,
  };
}

function cleanupDays(days) {
  return days.map(day => {
    const cleaned = { ...day };
    if (!cleaned.lodging) {
      delete cleaned.lodging;
    }
    if (!cleaned.notification || (!cleaned.notification.time && !cleaned.notification.eveningTemplate)) {
      delete cleaned.notification;
    }
    return cleaned;
  });
}

function importLegacyTripData(input) {
  const tripTsvContent = String(input?.tripTsvContent || '');
  const placesTsvContent = String(input?.placesTsvContent || '');
  const defaultYear = Number(input?.defaultYear) || 2026;

  const tripNameInput = normalizeText(input?.tripName);
  const tripIdInput = normalizeText(input?.tripId);
  const timezone = normalizeText(input?.timezone) || 'Europe/Amsterdam';
  const locale = normalizeText(input?.locale) || 'nl-NL';

  const warnings = [];
  const parsedTrip = parseTripRows(
    tripTsvContent,
    {
      defaultYear,
    },
    warnings
  );
  const dayMap = new Map(parsedTrip.days.map(day => [day.date, day]));
  const placeStats = parsePlacesRows(placesTsvContent, dayMap, { defaultYear }, warnings);

  const days = cleanupDays(Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date)));
  days.forEach(day => {
    day.activities.sort((a, b) => {
      const aTime = a.meetTime || a.startTime || '';
      const bTime = b.meetTime || b.startTime || '';
      if (aTime !== bTime) return String(aTime).localeCompare(String(bTime));
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  });
  const startDate = days[0].date;
  const endDate = days[days.length - 1].date;
  const tripName = tripNameInput || `Imported Trip ${startDate}`;
  const tripId = tripIdInput || `trip_${slugify(tripName)}_${startDate.replace(/-/g, '')}`;

  const manifest = {
    version: 1,
    trip: {
      id: tripId,
      name: tripName,
      timezone,
      locale,
      startDate,
      endDate,
      source: 'legacy-tsv',
    },
    days,
  };

  const stats = {
    ...parsedTrip.stats,
    ...placeStats,
    days: days.length,
    activities: (parsedTrip.stats.activities || 0) + (placeStats.activitiesFromPlaces || 0),
    places: 0,
  };

  return {
    manifest,
    stats,
    warnings,
  };
}

module.exports = {
  importLegacyTripData,
};
