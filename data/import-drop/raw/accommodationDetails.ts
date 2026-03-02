export interface AccommodationDetail {
  name: string;
  description: string;
  highlights: string[];
  notes?: string;
}

export const ACCOMMODATION_DETAILS: Record<string, AccommodationDetail> = {
  "b&b rio hotel copacabana": {
    name: "B&B Rio Hotel Copacabana",
    description:
      "B&B Hotels Rio Copacabana Posto 5 ligt strak tussen Ipanema en Copacabana in. Het hotel scoort goed in de reviews en staat bekend om zijn uitstekende ontbijt: een stevig continentaal ontbijt waarmee je de dag sterk begint. Kortom: de perfecte uitvalsbasis.",
    highlights: [
      "Ontbijt op het dakterras",
      "Strand op 2 minuten lopen",
      "24/7 receptie voor late aankomsten",
      "Single beds",
    ],
  },
  "airbnb ilha grande": {
    name: "Airbnb Ilha Grande",
    description:
      "Beachfront villa midden in Abraão. We zitten naast twee beach bars waar het 's avonds erg gezellig schijnt te zijn... ",
    highlights: [
      "Privéterras met uitzicht op zee",
      "Airconditioning in alle kamers",
      "Ruime woonkamer voor afterparty's",
      "Wasmachine aanwezig",
    ],
    notes: "Er is geen pinautomaat op het eiland, dus zorg dat je voldoende cash meeneemt.",
  },
  "casa búzios": {
    name: "Casa Búzios",
    description:
      "Pimpige hilltop villa in Búzios met uitzicht de stad. Vijf suites, waarvan twee met jacuzzi (voor de singles!), infinity pool, lounge en een lekker uitzicht",
    highlights: [
      "Infinity pool met strak uitzicht over Búzios",
      "Buitenkeuken met bbq en pizza oven",
      "Pooltafel en meerdere loungeplekken",
    ],
  },
  "hut met pizza en bier": {
    name: "Hut met pizza en bier",
    description:
      "Primitieve berghut midden in de natuur, wel met steenoven en lokaal gebrouwen biertjes. Verwacht geen luxe. Vergeet je oordoppen en melatonine niet: de kans is groot dat je met Tijs in één ruimte slaapt.",
    highlights: [],
  },
};
