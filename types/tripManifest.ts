import { z } from 'zod';
import { ActivityTypeSchema } from '@/types/trip';

export const PlaceTypeSchema = z.enum([
  'food',
  'drink',
  'nightlife',
  'logistics',
  'spot',
  'other',
]);

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const IsoDateTimeFloatingSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/);

export const TripManifestLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().min(1),
});

export const TripManifestActivitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: ActivityTypeSchema,
  location: z.string().default(''),
  imageUrl: z.string().default(''),
  startTime: IsoDateTimeFloatingSchema.nullish(),
  meetTime: IsoDateTimeFloatingSchema.nullish(),
  departFrom: z.string().default(''),
  transport: z.string().default(''),
  travelMinutes: z.number().int().nonnegative().nullable().optional(),
  description: z.string().default(''),
  mapsLink: z.string().default(''),
});

export const TripManifestPlaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: PlaceTypeSchema,
  location: z.string().default(''),
  mapsLink: z.string().default(''),
  startTime: IsoDateTimeFloatingSchema.nullish(),
  description: z.string().optional(),
  group: z.string().optional(),
  links: z.array(TripManifestLinkSchema).optional(),
  locations: z.array(TripManifestLinkSchema).optional(),
});

export const TripManifestLodgingSchema = z.object({
  name: z.string().min(1),
  link: z.string().optional(),
  address: z.string().optional(),
  mapsLink: z.string().optional(),
});

export const TripManifestDaySchema = z.object({
  id: z.string().min(1),
  date: IsoDateSchema,
  dayName: z.string().default(''),
  region: z.string().default(''),
  lodging: TripManifestLodgingSchema.optional(),
  notification: z
    .object({
      time: IsoDateTimeFloatingSchema.nullish(),
      eveningTemplate: z.string().optional(),
    })
    .optional(),
  activities: z.array(TripManifestActivitySchema).default([]),
  places: z.array(TripManifestPlaceSchema).optional(),
});

export const TripManifestParticipantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  bio: z.string().default(''),
  avatarUrl: z.string().optional(),
  emergencyContacts: z
    .array(
      z.object({
        name: z.string().min(1),
        phone: z.string().min(1),
      })
    )
    .optional(),
});

export const TripManifestRoomAssignmentSchema = z.object({
  lodgingName: z.string().min(1),
  rooms: z.array(z.string().min(1)).default([]),
});

export const TripManifestEmergencyContactSchema = z.object({
  label: z.string().min(1),
  phone: z.string().min(1),
});

export const TripManifestEmergencySectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  contacts: z.array(TripManifestEmergencyContactSchema).default([]),
});

export const TripManifestPackingItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  category: z.string().min(1),
  suggested: z.boolean().optional(),
  personal: z.boolean().optional(),
  assignedTo: z.string().nullable().optional(),
});

export const TripManifestSchema = z.object({
  version: z.literal(1),
  trip: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    timezone: z.string().default('UTC'),
    locale: z.string().default('nl-NL'),
    startDate: IsoDateSchema,
    endDate: IsoDateSchema,
    tipIds: z.array(z.string().min(1)).optional(),
    source: z.enum(['seed', 'legacy-tsv', 'manifest-import']).optional(),
  }),
  days: z.array(TripManifestDaySchema).min(1),
  people: z
    .object({
      participants: z.array(TripManifestParticipantSchema).optional(),
      roomAssignments: z.array(TripManifestRoomAssignmentSchema).optional(),
    })
    .optional(),
  emergency: z
    .object({
      sections: z.array(TripManifestEmergencySectionSchema).optional(),
    })
    .optional(),
  packingTemplate: z.array(TripManifestPackingItemSchema).optional(),
});

export type TripManifest = z.infer<typeof TripManifestSchema>;
export type TripManifestDay = z.infer<typeof TripManifestDaySchema>;
