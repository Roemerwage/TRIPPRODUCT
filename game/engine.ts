import type { ImageSourcePropType } from 'react-native';

export type Player = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  avatarSource?: ImageSourcePropType;
};

export type Statement = {
  id: string;
  text: string;
};

export type GamePhase = 'SORTING' | 'CHOOSING' | 'REVEAL';

export type GameState = {
  players: Player[];
  statementsPool: Statement[];
  usedStatementIds: string[];
  roundNumber: number;
  sorterIndex: number;
  phase: GamePhase;
  currentStatementId: string;
  choiceStatementIds: string[];
  orderedPlayerIds: string[];
  groupChoiceStatementId: string | null;
  isCorrect: boolean | null;
};

export function shuffle<T>(input: T[]): T[] {
  const array = [...input];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function pickUniqueStatements(
  pool: Statement[],
  excludeIds: string[],
  count: number
): Statement[] {
  const excluded = new Set(excludeIds);
  const available = pool.filter(statement => !excluded.has(statement.id));
  if (available.length <= count) {
    return shuffle(available).slice(0, count);
  }
  return shuffle(available).slice(0, count);
}

export function createRound(state: GameState): GameState {
  if (state.statementsPool.length < 10) {
    return state;
  }

  let usedIds = state.usedStatementIds;
  if (usedIds.length >= state.statementsPool.length) {
    usedIds = [];
  }

  let available = state.statementsPool.filter(statement => !usedIds.includes(statement.id));
  if (available.length === 0) {
    usedIds = [];
    available = state.statementsPool;
  }

  const [statement] = shuffle(available);
  if (!statement) {
    return state;
  }

  const decoys = pickUniqueStatements(state.statementsPool, [statement.id], 9);
  const choiceStatementIds = shuffle([statement.id, ...decoys.map(item => item.id)]);
  const orderedPlayerIds = state.orderedPlayerIds.length
    ? state.orderedPlayerIds
    : state.players.map(player => player.id);

  return {
    ...state,
    usedStatementIds: [...usedIds, statement.id],
    currentStatementId: statement.id,
    choiceStatementIds,
    orderedPlayerIds,
    groupChoiceStatementId: null,
    isCorrect: null,
    phase: 'SORTING',
  };
}

export function rotateSorter(state: GameState): GameState {
  if (!state.players.length) {
    return state;
  }
  const nextIndex = (state.sorterIndex + 1) % state.players.length;
  return {
    ...state,
    sorterIndex: nextIndex,
  };
}
