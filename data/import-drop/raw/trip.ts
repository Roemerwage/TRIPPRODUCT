import { z } from 'zod';
import { ImageSourcePropType } from 'react-native';

export const ActivityTypeSchema = z.enum(['travel', 'tour', 'hike', 'event', 'free_day', 'flight']);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;
export type PlaceType = 'food' | 'drink' | 'nightlife' | 'logistics' | 'spot' | 'other';

export const TripRowSchema = z.object({
  datum: z.string(),
  dag: z.string(),
  stadRegio: z.string(),
  verblijf: z.string(),
  verblijfLink: z.string(),
  verblijfAdres: z.string(),
  googleMapsLink: z.string(),
  activiteit: z.string(),
  activiteitType: z.string(),
  activiteitLocatie: z.string(),
  startTijd: z.string(),
  verzamelTijd: z.string(),
  vertrekVanaf: z.string(),
  vervoer: z.string(),
  reisTijd: z.string(),
  melding: z.string(),
  avondMelding: z.string(),
  beschrijving: z.string(),
});

export type TripRow = z.infer<typeof TripRowSchema>;

export interface Activity {
  id: string;
  naam: string;
  type: ActivityType;
  locatie: string;
  startTijd: Date | null;
  verzamelTijd: Date | null;
  vertrekVanaf: string;
  vervoer: string;
  reisTijd: number | null;
  beschrijving: string;
  mapsLink: string;
}

export interface Day {
  datum: Date;
  dagNaam: string;
  stadRegio: string;
  verblijf: string;
  verblijfLink: string;
  verblijfAdres: string;
  verblijfMapsLink: string;
  activiteiten: Activity[];
  places?: Place[];
  meldingTijd: Date | null;
  avondMelding?: string;
}

export interface Accommodation {
  naam: string;
  adres: string;
  link: string;
  mapsLink: string;
  dagen: Date[];
}

export interface PackingItem {
  id: string;
  naam: string;
  categorie: string;
  checked: boolean;
  suggested: boolean;
  // markeer als onderdeel van de persoonlijke set (wordt niet meegeteld in globale progress)
  personal?: boolean;
  // optionele koppeling naar participant id (bv 'p1', 'p2')
  assignedTo?: string | null;
}

export interface PlaceLink {
  label: string;
  url: string;
}

export interface Place {
  id: string;
  naam: string;
  type: PlaceType;
  locatie: string;
  mapsLink: string;
  startTijd: Date | null;
  beschrijving?: string;
  group?: string;
  links?: PlaceLink[];
  locations?: PlaceLink[];
}

export interface Participant {
  id: string;
  naam: string;
  bio: string;
  avatar?: ImageSourcePropType | null;
  emergencyContacts?: { naam: string; telefoon: string }[];
}
