import type { MinigameDefinition } from './types';

export const MINIGAMES: MinigameDefinition[] = [
  {
    id: 'undercover',
    titel: 'Undercover',
    beschrijving: 'Ontmasker de Undercover door te overleggen en iemand te elimineren.',
    route: '/minigames/undercover',
    assets: ['/assets/minigames/undercover/secret_words.json'],
  },
  {
    id: 'id-spel',
    titel: 'ID-spel',
    beschrijving: 'Sorteer de spelers en raad samen de juiste stelling.',
    route: '/minigames/id-spel',
    assets: [
      '/assets/minigames/id-spel/statements.json',
    ],
  },
  {
    id: 'top-lijsten',
    titel: 'Toplijsten raden',
    beschrijving: 'Raad de top-lijst en vul de ranks één voor één in.',
    route: '/minigames/top-lijsten',
    assets: ['/assets/minigames/top-lijsten/top_lists.json'],
  },
  {
    id: 'hoger-lager',
    titel: 'Hoger of lager',
    beschrijving: 'Schat en kies of het echte antwoord hoger of lager is.',
    route: '/minigames/hoger-lager',
    assets: ['/assets/minigames/hoger-lager/higher_lower_trivia_500.json'],
  },
  {
    id: 'team-verdeler',
    titel: 'Teams verdelen',
    beschrijving: 'Kies spelers, kies het aantal teams en laat de app willekeurig verdelen.',
    route: '/minigames/team-verdeler',
  },
  {
    id: 'random',
    titel: 'Random number generator',
    beschrijving: 'Genereer een willekeurig getal binnen je eigen bereik.',
    route: '/minigames/random',
  },
];

export const getMinigameById = (id: string) =>
  MINIGAMES.find(game => game.id === id) || null;
