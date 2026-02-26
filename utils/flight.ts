import { Activity } from '@/types/trip';

export function getFlightArrivalTime(activity: Activity): Date | null {
  if (!activity.startTijd || !activity.reisTijd) return null;
  const arrival = new Date(activity.startTijd);
  arrival.setMinutes(arrival.getMinutes() + activity.reisTijd);
  return arrival;
}

export function getFlightLayoverMinutes(current: Activity, next?: Activity | null): number | null {
  if (
    !current ||
    current.type !== 'flight' ||
    !next ||
    next.type !== 'flight' ||
    !next.startTijd
  ) {
    return null;
  }
  const arrival = getFlightArrivalTime(current);
  if (!arrival) return null;
  const diffMinutes = Math.round((next.startTijd.getTime() - arrival.getTime()) / 60000);
  return diffMinutes > 0 ? diffMinutes : null;
}

export function formatMinutesLabel(minutes?: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'uur' : 'uur'}`);
  }
  if (remainder > 0) {
    parts.push(`${remainder} ${remainder === 1 ? 'minuut' : 'minuten'}`);
  }
  return parts.length > 0 ? parts.join(' ') : `${minutes} minuten`;
}
