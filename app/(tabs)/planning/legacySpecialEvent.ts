export type LegacySpecialEventOptionKey = 'optionA' | 'optionB';

export const LEGACY_SPECIAL_EVENT_TABS: {
  key: LegacySpecialEventOptionKey;
  label: string;
  icon: string;
}[] = [
  { key: 'optionA', label: 'Optie A', icon: '🎉' },
  { key: 'optionB', label: 'Optie B', icon: '🎭' },
];

export const LEGACY_SPECIAL_EVENT_OPTIONS: {
  key: LegacySpecialEventOptionKey;
  title: string;
  body: string;
  details: string[];
  links: { label: string; url: string }[];
  note?: string;
}[] = [
  {
    key: 'optionA',
    title: 'Optie 1: Dagprogramma',
    body: 'Openluchtprogramma met muziek, workshops en informele activiteiten. Details volgen in de app.',
    details: ['Start: 08:00', 'Locatie: Stadscentrum', 'Toegang: Gratis'],
    links: [
      { label: 'Info', url: 'https://example.com/event-info' },
      { label: 'Maps', url: 'https://example.com/map' },
    ],
  },
  {
    key: 'optionB',
    title: 'Optie 2: Ochtendprogramma',
    body: 'Groot evenement met veel bezoekers, muziek en entertainment.',
    details: ['Start: 07:00', 'Adres: Hoofdstraat'],
    links: [
      { label: 'Info', url: 'https://example.com/event-details' },
      { label: 'Maps', url: 'https://example.com/map' },
    ],
  },
];

// Archived from day planning so the planning UI stays generic for all trips.
// Keep this file as reference if you want to reintroduce a dedicated special-event
// module later.
