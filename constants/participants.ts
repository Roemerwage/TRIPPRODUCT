import { Participant } from "@/types/trip";

const ANON_BIO =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
const ANON_CONTACTS = [{ naam: 'Noodcontact', telefoon: '+00 000000000' }];

const STOCK_AVATARS = [
  'https://picsum.photos/seed/avatar-1/600/600',
  'https://picsum.photos/seed/avatar-2/600/600',
  'https://picsum.photos/seed/avatar-3/600/600',
  'https://picsum.photos/seed/avatar-4/600/600',
  'https://picsum.photos/seed/avatar-5/600/600',
  'https://picsum.photos/seed/avatar-6/600/600',
  'https://picsum.photos/seed/avatar-7/600/600',
  'https://picsum.photos/seed/avatar-8/600/600',
  'https://picsum.photos/seed/avatar-9/600/600',
  'https://picsum.photos/seed/avatar-10/600/600',
];

const makeParticipant = (id: string, naam: string, avatarUrl: string): Participant => ({
  id,
  naam,
  bio: ANON_BIO,
  emergencyContacts: ANON_CONTACTS,
  avatar: { uri: avatarUrl },
});

export const PARTICIPANTS: Participant[] = [
  makeParticipant('p1', 'Person 1', STOCK_AVATARS[0]),
  makeParticipant('p2', 'Person 2', STOCK_AVATARS[1]),
  makeParticipant('p3', 'Person 3', STOCK_AVATARS[2]),
  makeParticipant('p4', 'Person 4', STOCK_AVATARS[3]),
  makeParticipant('p5', 'Person 5', STOCK_AVATARS[4]),
  makeParticipant('p6', 'Person 6', STOCK_AVATARS[5]),
  makeParticipant('p7', 'Person 7', STOCK_AVATARS[6]),
  makeParticipant('p8', 'Person 8', STOCK_AVATARS[7]),
  makeParticipant('p9', 'Person 9', STOCK_AVATARS[8]),
  makeParticipant('p10', 'Person 10', STOCK_AVATARS[9]),
];
