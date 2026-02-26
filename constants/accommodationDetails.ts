export interface AccommodationDetail {
  name: string;
  description: string;
  highlights: string[];
  notes?: string;
}

export const ACCOMMODATION_DETAILS: Record<string, AccommodationDetail> = {
  "accommodation 1": {
    name: "Accommodation 1",
    description:
      "Neutrale beschrijving van een verblijf. Dit is een geanonimiseerde placeholder zonder specifieke locatie- of merkdetails.",
    highlights: [
      "Centrale ligging",
      "Basisvoorzieningen aanwezig",
      "Geschikt voor groepen",
    ],
  },
  "accommodation 2": {
    name: "Accommodation 2",
    description:
      "Korte, algemene omschrijving van het verblijf. Details zijn bewust geanonimiseerd.",
    highlights: [
      "Rustige omgeving",
      "Gedeelde ruimtes",
      "Flexibele check-in",
    ],
  },
  "accommodation 3": {
    name: "Accommodation 3",
    description:
      "Algemene placeholdertekst voor een accommodatie. Geen persoonlijke of locatiegebonden informatie.",
    highlights: [
      "Comfortabele kamers",
      "Basiskeuken aanwezig",
      "Wi-Fi beschikbaar",
    ],
  },
  "accommodation 4": {
    name: "Accommodation 4",
    description:
      "Generieke verblijfssamenvatting. Alle specifieke verwijzingen zijn verwijderd.",
    highlights: [
      "Geschikt voor grotere groepen",
      "Gemeenschappelijke lounge",
      "Buitenruimte aanwezig",
    ],
  },
};
