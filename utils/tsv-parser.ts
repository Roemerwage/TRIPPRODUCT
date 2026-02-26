import { TripRow, Day, Activity, ActivityType, Place, PlaceType } from '@/types/trip';
import { resolveActivityLink } from '@/constants/media';

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, Mei: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Okt: 9, Nov: 10, Dec: 11,
};

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === 'x' || dateStr.toLowerCase() === 'unknown' || dateStr.toLowerCase() === 'tba') {
    return null;
  }
  
  const parts = dateStr.trim().split(' ');
  if (parts.length >= 2) {
    const day = parseInt(parts[0], 10);
    const month = MONTH_MAP[parts[1]];
    if (!isNaN(day) && month !== undefined) {
      return new Date(2026, month, day);
    }
  }
  return null;
}

function parseTime(timeStr: string, baseDate: Date): Date | null {
  if (!timeStr || timeStr === 'x' || timeStr.toLowerCase() === 'unknown' || timeStr.toLowerCase() === 'tba') {
    return null;
  }
  
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      const date = new Date(baseDate);
      date.setHours(hours, minutes, 0, 0);
      return date;
    }
  }
  return null;
}

function parseMinutes(minutesStr: string): number | null {
  if (!minutesStr || minutesStr === 'x' || minutesStr.toLowerCase() === 'unknown' || minutesStr.toLowerCase() === 'tba') {
    return null;
  }
  const num = parseInt(minutesStr, 10);
  return isNaN(num) ? null : num;
}

function normalizeActivityType(type: string): ActivityType {
  const normalized = type.toLowerCase().trim();
  if (normalized === 'travel') return 'travel';
  if (normalized === 'tour') return 'tour';
  if (normalized === 'hike') return 'hike';
  if (normalized === 'event') return 'event';
  if (normalized === 'free_day') return 'free_day';
  if (normalized === 'flight') return 'flight';
  return 'event';
}

function normalizePlaceType(type: string): PlaceType {
  const normalized = type.toLowerCase().trim();
  if (normalized === 'food') return 'food';
  if (normalized === 'drink') return 'drink';
  if (normalized === 'nightlife') return 'nightlife';
  if (normalized === 'logistics') return 'logistics';
  if (normalized === 'spot') return 'spot';
  return 'other';
}

const unescapeNewlines = (value?: string | null) =>
  value == null ? undefined : value.replace(/\\n/g, '\n');

export function parseTSV(tsvContent: string): Day[] {
  const lines = tsvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('TSV moet minimaal een header en één rij bevatten');
  }

  const rows: TripRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('\t');
    if (cells.length < 18) continue;
    
    rows.push({
      datum: cells[0] || '',
      dag: cells[1] || '',
      stadRegio: cells[2] || '',
      verblijf: cells[3] || '',
      verblijfLink: cells[4] || '',
      verblijfAdres: cells[5] || '',
      googleMapsLink: cells[6] || '',
      activiteit: cells[7] || '',
      activiteitType: cells[8] || '',
      activiteitLocatie: cells[9] || '',
      startTijd: cells[10] || '',
      verzamelTijd: cells[11] || '',
      vertrekVanaf: cells[12] || '',
      vervoer: cells[13] || '',
      reisTijd: cells[14] || '',
      melding: cells[15] || '',
      avondMelding: cells[16] || '',
      beschrijving: cells[17] || '',
    });
  }

  const dayMap = new Map<string, Day>();

  rows.forEach((row, index) => {
    const datum = parseDate(row.datum);
    if (!datum) return;

    const dateKey = datum.toISOString().split('T')[0];
    
    if (!dayMap.has(dateKey)) {
      const sameDay = row.avondMelding?.toLowerCase().includes('zelfde dag');
      const meldingTijd = parseTime(row.melding, new Date(datum));
      if (meldingTijd && !sameDay) {
        meldingTijd.setDate(meldingTijd.getDate() - 1);
      }

      dayMap.set(dateKey, {
        datum,
        dagNaam: row.dag,
        stadRegio: row.stadRegio,
        verblijf: row.verblijf,
        verblijfLink: row.verblijfLink,
        verblijfAdres: row.verblijfAdres,
        verblijfMapsLink: row.googleMapsLink,
        activiteiten: [],
        meldingTijd,
        avondMelding: row.avondMelding,
      });
    }

    const day = dayMap.get(dateKey)!;
    
    const activity: Activity = {
      id: `${dateKey}-${index}`,
      naam: row.activiteit,
      type: normalizeActivityType(row.activiteitType),
      locatie: row.activiteitLocatie,
      startTijd: parseTime(row.startTijd, datum),
      verzamelTijd: parseTime(row.verzamelTijd, datum),
      vertrekVanaf: row.vertrekVanaf,
      vervoer: row.vervoer,
      reisTijd: parseMinutes(row.reisTijd),
      beschrijving: unescapeNewlines(row.beschrijving) ?? '',
      mapsLink: resolveActivityLink(row.activiteit, row.activiteitLocatie, row.googleMapsLink) ?? '',
    };

    day.activiteiten.push(activity);
    day.avondMelding = unescapeNewlines(day.avondMelding);
  });

  const days = Array.from(dayMap.values());
  
  days.forEach(day => {
    day.activiteiten.sort((a, b) => {
      const aTime = a.verzamelTijd || a.startTijd;
      const bTime = b.verzamelTijd || b.startTijd;
      
      if (aTime && bTime) return aTime.getTime() - bTime.getTime();
      if (aTime) return -1;
      if (bTime) return 1;
      return 0;
    });
  });

  return days.sort((a, b) => a.datum.getTime() - b.datum.getTime());
}

export function parsePlacesTSV(tsvContent: string): Map<string, Place[]> {
  const trimmed = tsvContent.trim();
  if (!trimmed) return new Map();
  const lines = trimmed.split('\n');
  if (lines.length < 2) return new Map();

  const placeMap = new Map<string, Place[]>();
  const parseLinkPairs = (labelsRaw: string, urlsRaw: string) => {
    const labels = labelsRaw
      .split(' | ')
      .map(value => value.trim())
      .filter(Boolean);
    const urls = urlsRaw
      .split(' | ')
      .map(value => value.trim())
      .filter(Boolean);
    if (labels.length === 0 || urls.length === 0) return undefined;
    const count = Math.min(labels.length, urls.length);
    return Array.from({ length: count }, (_, idx) => ({
      label: labels[idx],
      url: urls[idx],
    }));
  };

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('\t');
    if (cells.length < 8) continue;

    const datum = parseDate(cells[0] || '');
    if (!datum) continue;
    const dateKey = datum.toISOString().split('T')[0];
    const group = cells[1] || '';
    const naam = cells[2] || '';
    const type = normalizePlaceType(cells[3] || '');
    const locatie = cells[4] || '';
    const mapsLink = cells[5] || '';
    const startTijd = parseTime(cells[6] || '', datum);
    const beschrijving = unescapeNewlines(cells[7] || '');
    const linkLabel = cells[8] || '';
    const linkUrl = cells[9] || '';
    const links = linkLabel && linkUrl ? [{ label: linkLabel, url: linkUrl }] : undefined;
    const locationLabels = cells[10] || '';
    const locationUrls = cells[11] || '';
    const locations = locationLabels && locationUrls ? parseLinkPairs(locationLabels, locationUrls) : undefined;

    const place: Place = {
      id: `${dateKey}-place-${i}`,
      naam,
      type,
      locatie,
      mapsLink,
      startTijd,
      beschrijving,
      group: group || undefined,
      links,
      locations,
    };

    if (!placeMap.has(dateKey)) {
      placeMap.set(dateKey, []);
    }
    placeMap.get(dateKey)!.push(place);
  }

  return placeMap;
}
