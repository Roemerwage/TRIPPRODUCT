# ID-spel (minigame)

## Integratie
- Maak een route die de screen rendert, bijvoorbeeld:

```tsx
// app/minigames/id-spel.tsx
import IdGameScreen from '@/screens/IdGameScreen';

export default function IdSpelRoute() {
  return <IdGameScreen />;
}
```

## Data
- Spelers komen uit de crew van de trip (selecteerbaar in de startfase).
- Standaard worden stellingen geladen uit `assets/minigames/id-spel/statements.json`.
- Je kunt stellingen direct meegeven:

```tsx
<IdGameScreen statementsSeed={statements} />
```

## Spelverloop
- Er zijn steeds 10 keuzes (1 juiste stelling + 9 decoys).
- Zodra alle stellingen zijn gebruikt, reset het spel automatisch de gebruikte lijst en gaat het door.
