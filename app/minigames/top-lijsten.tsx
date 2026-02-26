import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { Check, Plus, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTrip } from '@/contexts/TripContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FloatingActions } from '@/components/FloatingActions';
import { Spacing, Typography } from '@/constants/tokens';
import type { Participant } from '@/types/trip';

type TopListItem = {
  rank: number;
  answer: string;
};

type TopList = {
  id: number;
  title: string;
  type: string;
  source?: string;
  items: TopListItem[];
};

type SelectableParticipant = Omit<Participant, 'avatar'> & {
  avatar?: Participant['avatar'];
  isGuest?: boolean;
};

type GuestParticipant = SelectableParticipant & {
  id: string;
  naam: string;
  isGuest: true;
};

type BoardEntry = {
  rank: number;
  answer: string | null;
};

type ConfettiPiece = {
  id: number;
  left: number;
  size: number;
  drift: number;
  rotate: number;
  color: string;
};

type Stage = 'start' | 'play' | 'final' | 'error';

const LISTS_ASSET_RELATIVE = '../../assets/minigames/top-lijsten/top_lists.json';
const LISTS_ASSET_PATH = '/assets/minigames/top-lijsten/top_lists.json';
const LISTS_SCHEMA =
  '[{ "id": number, "title": string, "type": "top10|top5|top3", "source"?: string, "items": [{ "rank": number, "answer": string }] }] of { "lists": [...] }';

const MAX_CROSSES = 3;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;


export default function TopListsScreen() {
  const { participants } = useTrip();
  const { colors } = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const actionBarOffset = insets.top + 44;
  const actionBarTranslate = scrollY.interpolate({
    inputRange: [0, 40],
    outputRange: [0, -60],
    extrapolate: 'clamp',
  });
  const actionBarOpacity = scrollY.interpolate({
    inputRange: [0, 20],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const [stage, setStage] = useState<Stage>('start');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [players, setPlayers] = useState<SelectableParticipant[]>([]);
  const [roundScores, setRoundScores] = useState<Record<string, number>>({});
  const [matchScores, setMatchScores] = useState<Record<string, number>>({});
  const [crosses, setCrosses] = useState<Record<string, number>>({});
  const [eliminatedIds, setEliminatedIds] = useState<string[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [startingIndex, setStartingIndex] = useState(0);
  const [guessInput, setGuessInput] = useState('');
  const [roundMessage, setRoundMessage] = useState<string | null>(null);
  const [roundWinners, setRoundWinners] = useState<string[]>([]);
  const [scoredRoundId, setScoredRoundId] = useState<number | null>(null);
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
  const [showWrongGuesses, setShowWrongGuesses] = useState(false);
  const [activeList, setActiveList] = useState<TopList | null>(null);
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [usedAnswers, setUsedAnswers] = useState<string[]>([]);
  const [usedListIds, setUsedListIds] = useState<number[]>([]);
  const [revealUsed, setRevealUsed] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [guestPlayers, setGuestPlayers] = useState<GuestParticipant[]>([]);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCross, setShowCross] = useState(false);
  const [showCrossCount, setShowCrossCount] = useState(0);
  const crossAnim = useRef(new Animated.Value(0)).current;
  const crossRevealAnims = useRef<Record<string, Animated.Value[]>>({});
  const bigCrossAnims = useRef(
    Array.from({ length: MAX_CROSSES }, () => new Animated.Value(0))
  ).current;

  const confettiPieces = useMemo(() => createConfettiPieces(colors), [colors]);
  const confettiAnims = useRef<Animated.Value[]>([]);

  const { items: lists, error: listsError } = useMemo(() => {
    let raw: unknown = null;
    try {
      raw = require(LISTS_ASSET_RELATIVE);
    } catch (err) {
      return { items: [] as TopList[], error: 'Top-lijsten konden niet worden geladen.' };
    }
    const normalized = (raw as any)?.default ?? raw;
    return validateLists(normalized);
  }, []);

  const allParticipants = useMemo(
    () => [...participants, ...guestPlayers],
    [participants, guestPlayers]
  );
  const activePlayers = players.length
    ? players
    : allParticipants.filter(person => selectedIds.includes(person.id));
  const activePlayer = activePlayers[currentPlayerIndex] ?? null;

  const canStart = selectedIds.length >= MIN_PLAYERS && selectedIds.length <= MAX_PLAYERS && lists.length > 0;
  const canToggleMore = selectedIds.length < MAX_PLAYERS;

  if (listsError) {
    return (
      <>
        <Stack.Screen options={{ title: 'Toplijsten raden', headerShown: false }} />
        <View style={[styles.errorContainer, { paddingTop: actionBarOffset }]}>
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Top-lijsten ontbreken of zijn ongeldig</Text>
            <Text style={styles.errorText}>Kon het lokale bestand niet laden:</Text>
            <Text style={styles.errorPath}>{LISTS_ASSET_PATH}</Text>
            <Text style={styles.errorText}>Voorbeeld schema:</Text>
            <Text style={styles.errorSchema}>{LISTS_SCHEMA}</Text>
          </Card>
        </View>
        <FloatingActions
          showSettings={false}
          showLifeBuoy={false}
          animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
        />
      </>
    );
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      }
      if (!canToggleMore) return prev;
      return [...prev, id];
    });
  };

  const selectAll = () => {
    const ids = allParticipants.map(person => person.id).slice(0, MAX_PLAYERS);
    setSelectedIds(ids);
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const addGuest = () => {
    const trimmed = guestName.trim();
    if (!trimmed) {
      setGuestError('Vul een naam in.');
      return;
    }
    const normalized = trimmed.toLowerCase();
    const nameTaken = allParticipants.some(person => person.naam.toLowerCase() === normalized);
    if (nameTaken) {
      setGuestError('Naam bestaat al.');
      return;
    }
    const newGuest: GuestParticipant = {
      id: `guest-${Date.now()}`,
      naam: trimmed,
      bio: '',
      avatar: undefined,
      isGuest: true,
    };
    setGuestPlayers(prev => [...prev, newGuest]);
    setGuestName('');
    setGuestError(null);
    setShowGuestModal(false);
  };

  const resetGame = () => {
    setStage('start');
    setPlayers([]);
    setRoundScores({});
    setMatchScores({});
    setCrosses({});
    setEliminatedIds([]);
    setCurrentPlayerIndex(0);
    setStartingIndex(0);
    setGuessInput('');
    setRoundMessage(null);
    setRoundWinners([]);
    setScoredRoundId(null);
    setWrongGuesses([]);
    setShowWrongGuesses(false);
    setActiveList(null);
    setBoard([]);
    setUsedAnswers([]);
    setUsedListIds([]);
    setRevealUsed(false);
    crossRevealAnims.current = {};
  };

  const pickRandomList = (excludeId?: number | null) => {
    if (!lists.length) return null;
    const available = lists.filter(list => !usedListIds.includes(list.id));
    if (!available.length) return null;
    const pool = excludeId ? available.filter(list => list.id !== excludeId) : available;
    if (!pool.length) return null;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  };

  const startGame = (reusePlayers = false) => {
    if (!canStart) return;
    const selectedPlayers = reusePlayers
      ? players
      : allParticipants.filter(person => selectedIds.includes(person.id));
    const initialRoundScores: Record<string, number> = {};
    const initialCrosses: Record<string, number> = {};
    selectedPlayers.forEach(player => {
      initialRoundScores[player.id] = 0;
      initialCrosses[player.id] = 0;
    });
    const list = pickRandomList();
    if (!list) {
      Alert.alert('Geen nieuwe lijsten', 'Alle lijsten zijn gebruikt in deze game. Reset om opnieuw te beginnen.');
      return;
    }
    const initialMatchScores: Record<string, number> = reusePlayers
      ? { ...matchScores }
      : {};
    selectedPlayers.forEach(player => {
      if (initialMatchScores[player.id] === undefined) {
        initialMatchScores[player.id] = 0;
      }
    });
    const size = getBoardSize(list);
    const initialBoard = Array.from({ length: size }, (_, index) => ({
      rank: index + 1,
      answer: null,
    }));
    setPlayers(selectedPlayers);
    setRoundScores(initialRoundScores);
    setMatchScores(initialMatchScores);
    setCrosses(initialCrosses);
    setEliminatedIds([]);
    const nextStartingIndex = reusePlayers
      ? (startingIndex + 1) % Math.max(1, selectedPlayers.length)
      : 0;
    setStartingIndex(nextStartingIndex);
    setCurrentPlayerIndex(nextStartingIndex);
    setGuessInput('');
    setRoundMessage(null);
    setRoundWinners([]);
    setScoredRoundId(null);
    setWrongGuesses([]);
    setShowWrongGuesses(false);
    setActiveList(list);
    setBoard(initialBoard);
    setUsedAnswers([]);
    setUsedListIds(prev => (prev.includes(list.id) ? prev : [...prev, list.id]));
    setRevealUsed(false);
    setStage('play');
    ensureCrossRevealAnims(selectedPlayers);
  };

  const normalizedItems = useMemo(() => {
    if (!activeList) return [];
    return activeList.items.map(item => ({
      ...item,
      normalized: normalizeText(item.answer),
    }));
  }, [activeList]);

  const remainingSlots = board.filter(entry => !entry.answer).length;
  const activePlayerIds = activePlayers
    .map(player => player.id)
    .filter(id => !eliminatedIds.includes(id));

  const ensureCrossRevealAnims = (selectedPlayers: SelectableParticipant[]) => {
    selectedPlayers.forEach(player => {
      if (!crossRevealAnims.current[player.id]) {
        crossRevealAnims.current[player.id] = Array.from(
          { length: MAX_CROSSES },
          () => new Animated.Value(1)
        );
      }
    });
  };

  const triggerCrossReveal = (playerId: string, count: number) => {
    const anims = crossRevealAnims.current[playerId];
    if (!anims) return;
    anims.forEach((anim, index) => {
      anim.setValue(index < count ? 0 : 0.4);
    });
    Animated.stagger(
      140,
      anims.slice(0, count).map(anim =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start(() => {
    });
  };

  const handleGuess = () => {
    if (!activePlayer || !activeList) return;
    const trimmed = guessInput.trim();
    if (!trimmed) {
      setRoundMessage('Vul een antwoord in.');
      return;
    }
    const normalizedGuess = normalizeText(trimmed);
    const usedSet = new Set(usedAnswers);
    const match = findBestMatch(normalizedGuess, normalizedItems, board, usedSet);
    let nextEliminated = eliminatedIds;
    if (match) {
      setRoundScores(prev => ({
        ...prev,
        [activePlayer.id]: (prev[activePlayer.id] ?? 0) + 1,
      }));
      setBoard(prev =>
        prev.map(entry =>
          entry.rank === match.rank ? { ...entry, answer: match.answer } : entry
        )
      );
      setUsedAnswers(prev => [...prev, match.normalized]);
      setRoundMessage(`Juist! ${match.answer} staat op plek ${match.rank}.`);
      triggerConfetti();
    } else {
      const nextCrosses = Math.min((crosses[activePlayer.id] ?? 0) + 1, MAX_CROSSES);
      setCrosses(prev => ({ ...prev, [activePlayer.id]: nextCrosses }));
      if (nextCrosses >= MAX_CROSSES) {
        nextEliminated = [...eliminatedIds, activePlayer.id];
        setEliminatedIds(nextEliminated);
        setRoundMessage(`${activePlayer.naam} heeft ${MAX_CROSSES} kruisjes en ligt eruit.`);
      } else {
        setRoundMessage('Helaas, dat staat niet (meer) in de lijst.');
      }
      setWrongGuesses(prev => {
        const normalized = normalizeText(trimmed);
        if (!normalized) return prev;
        if (prev.some(item => normalizeText(item) === normalized)) return prev;
        return [...prev, trimmed];
      });
      triggerCross(nextCrosses);
      triggerCrossReveal(activePlayer.id, nextCrosses);
    }
    setGuessInput('');
    const nextIndex = getNextActiveIndex(currentPlayerIndex, activePlayers, nextEliminated);
    setCurrentPlayerIndex(nextIndex);
  };

  const endConditionMet = () => {
    if (remainingSlots === 0) return true;
    if (activePlayerIds.length <= 1) return true;
    return false;
  };

  useEffect(() => {
    if (stage !== 'play') return;
    if (!endConditionMet()) return;
    setStage('final');
  }, [stage, remainingSlots, activePlayerIds.length]);

  useEffect(() => {
    if (stage !== 'final') return;
    if (!activeList) return;
    if (scoredRoundId === activeList.id) return;
    const scores = activePlayers.map(player => ({
      id: player.id,
      score: roundScores[player.id] ?? 0,
    }));
    const maxScore = scores.reduce((max, entry) => Math.max(max, entry.score), 0);
    const winners = scores.filter(entry => entry.score === maxScore).map(entry => entry.id);
    setRoundWinners(winners);
    setMatchScores(prev => {
      const next = { ...prev };
      winners.forEach(id => {
        next[id] = (next[id] ?? 0) + 1;
      });
      return next;
    });
    setScoredRoundId(activeList.id);
  }, [stage, activeList, scoredRoundId, activePlayers, roundScores]);

  const skipList = () => {
    if (!activeList) return;
    const nextList = pickRandomList(activeList.id);
    if (!nextList || nextList.id === activeList.id) {
      Alert.alert('Geen nieuwe lijsten', 'Alle lijsten zijn gebruikt in deze game. Reset om opnieuw te beginnen.');
      return;
    }
    const size = getBoardSize(nextList);
    const initialBoard = Array.from({ length: size }, (_, index) => ({
      rank: index + 1,
      answer: null,
    }));
    const resetScores: Record<string, number> = {};
    players.forEach(player => {
      resetScores[player.id] = 0;
    });
    setRoundScores(resetScores);
    setCrosses({});
    setEliminatedIds([]);
    const nextStartingIndex = (startingIndex + 1) % Math.max(1, players.length);
    setStartingIndex(nextStartingIndex);
    setCurrentPlayerIndex(nextStartingIndex);
    setGuessInput('');
    setRoundMessage(null);
    setRoundWinners([]);
    setScoredRoundId(null);
    setWrongGuesses([]);
    setShowWrongGuesses(false);
    setActiveList(nextList);
    setBoard(initialBoard);
    setUsedAnswers([]);
    setUsedListIds(prev => (prev.includes(nextList.id) ? prev : [...prev, nextList.id]));
    setRevealUsed(false);
    setStage('play');
  };

  const revealOne = () => {
    if (revealUsed || !activeList) return;
    const openRanks = board.filter(entry => !entry.answer);
    if (!openRanks.length) return;
    const choice = openRanks[Math.floor(Math.random() * openRanks.length)];
    const match = activeList.items.find(item => item.rank === choice.rank);
    if (!match) return;
    setBoard(prev =>
      prev.map(entry =>
        entry.rank === match.rank ? { ...entry, answer: match.answer } : entry
      )
    );
    setUsedAnswers(prev => {
      const normalized = normalizeText(match.answer);
      return prev.includes(normalized) ? prev : [...prev, normalized];
    });
    setRevealUsed(true);
    setRoundMessage(`Gratis hint: plek ${match.rank} is ${match.answer}.`);
  };

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, event => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    confettiAnims.current = confettiPieces.map(() => new Animated.Value(0));
  }, [confettiPieces]);

  useEffect(() => {
    ensureCrossRevealAnims(activePlayers);
  }, [activePlayers]);

  useEffect(() => {
    activePlayers.forEach(player => {
      const anims = crossRevealAnims.current[player.id];
      if (!anims) return;
      const count = Math.min(crosses[player.id] ?? 0, MAX_CROSSES);
      anims.forEach((anim, index) => {
        anim.setValue(index < count ? 1 : 0.4);
      });
    });
  }, [crosses, activePlayers]);


  const triggerConfetti = () => {
    if (!confettiAnims.current.length) return;
    setShowConfetti(true);
    confettiAnims.current.forEach(anim => anim.setValue(0));
    Animated.stagger(
      35,
      confettiAnims.current.map(anim =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      )
    ).start(() => {
      setShowConfetti(false);
    });
  };

  const triggerCross = (count: number) => {
    const safeCount = Math.min(count, MAX_CROSSES);
    setShowCross(true);
    setShowCrossCount(safeCount);
    crossAnim.setValue(0);
    bigCrossAnims.forEach((anim, index) => {
      anim.setValue(index < safeCount ? 0 : 0);
    });
    Animated.sequence([
      Animated.timing(crossAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.back(1)),
        useNativeDriver: true,
      }),
      Animated.stagger(
        140,
        bigCrossAnims.slice(0, safeCount).map(anim =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        )
      ),
      Animated.delay(320),
      Animated.timing(crossAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowCross(false);
      setShowCrossCount(0);
    });
  };

  const renderScoreboard = () => (
    <Card style={styles.scoreboardCard}>
      <View style={styles.scoreboardHeader}>
        <Text style={styles.sectionTitle}>Scorebord</Text>
        <Text style={styles.scoreboardHint}>Match</Text>
      </View>
      <View style={styles.matchScoreList}>
        {activePlayers.map(player => {
          const eliminated = eliminatedIds.includes(player.id);
          const isActive = activePlayer?.id === player.id;
          const playerCrosses = Math.min(crosses[player.id] ?? 0, MAX_CROSSES);
          const anims = crossRevealAnims.current[player.id];
          return (
            <View
              key={player.id}
              style={[
                styles.matchScoreRow,
                isActive && styles.matchScoreRowActive,
                eliminated && styles.matchScoreRowEliminated,
              ]}
            >
              <View style={styles.matchScoreNameRow}>
                <Text style={[styles.matchScoreName, eliminated && styles.scoreNameEliminated]}>
                  {player.naam}
                </Text>
                <View style={styles.crossRow}>
                  {Array.from({ length: MAX_CROSSES }).map((_, index) => {
                    const isFilled = index < playerCrosses;
                    const opacity = anims ? anims[index] : isFilled ? 1 : 0.4;
                    const scale = anims
                      ? anims[index].interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] })
                      : 1;
                    return (
                      <Animated.View
                        key={`${player.id}-cross-${index}`}
                        style={{ opacity, transform: [{ scale }] }}
                      >
                        <X
                          size={12}
                          color={isFilled ? colors.danger : colors.border}
                          style={isFilled ? styles.crossIconFilled : styles.crossIcon}
                        />
                      </Animated.View>
                    );
                  })}
                </View>
              </View>
              <View style={styles.matchScoreMeta}>
                <Text style={styles.matchScoreLabel}>W</Text>
                <Text style={styles.matchScoreValue}>{matchScores[player.id] ?? 0}</Text>
              </View>
              <View style={styles.matchScoreMeta}>
                <Text style={styles.matchScoreLabel}>R</Text>
                <Text style={styles.matchScoreValue}>{roundScores[player.id] ?? 0}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={styles.scoreboardNote}>W = gewonnen lijsten • R = punten deze ronde</Text>
    </Card>
  );

  const renderBoard = (title?: string, revealAll = false) => {
    const revealedMap = revealAll && activeList
      ? new Map(activeList.items.map(item => [item.rank, item.answer]))
      : null;
    const sourceLabel = activeList?.source?.trim();
    const revealAvailable = !revealUsed && remainingSlots > 0 && !revealAll;
    return (
      <Card style={styles.boardCard}>
        <View style={styles.boardHeader}>
          <View style={styles.boardTitleWrap}>
            <Text style={styles.boardTitle}>{title ?? 'Toplijst'}</Text>
            {sourceLabel ? <Text style={styles.boardSource}>Bron: {sourceLabel}</Text> : null}
          </View>
          <View style={styles.boardActions}>
            <TouchableOpacity
              style={[styles.revealButton, !revealAvailable && styles.revealButtonDisabled]}
              onPress={revealOne}
              disabled={!revealAvailable}
            >
              <Text style={styles.revealButtonText}>{revealUsed ? 'Reveal op' : 'Gratis reveal'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipButton} onPress={skipList}>
              <Text style={styles.skipButtonText}>Sla over</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.boardList}>
          {board.map(entry => (
            <View
              key={entry.rank}
              style={[styles.boardRow, entry.answer && styles.boardRowFilled]}
            >
              <View style={styles.boardRankBadge}>
                <Text style={styles.boardRankText}>{entry.rank}</Text>
              </View>
              <Text style={entry.answer ? styles.boardAnswer : styles.boardPlaceholder}>
                {entry.answer ?? revealedMap?.get(entry.rank) ?? '—'}
              </Text>
            </View>
          ))}
        </View>
        {wrongGuesses.length > 0 && (
          <View style={styles.wrongGuessesWrap}>
            <TouchableOpacity
              style={styles.wrongGuessesToggle}
              onPress={() => setShowWrongGuesses(prev => !prev)}
            >
              <Text style={styles.wrongGuessesToggleText}>
                Fout ({wrongGuesses.length})
              </Text>
              <Text style={styles.wrongGuessesToggleHint}>
                {showWrongGuesses ? 'Verberg' : 'Toon'}
              </Text>
            </TouchableOpacity>
            {showWrongGuesses && (
              <View style={styles.wrongGuessesList}>
                {wrongGuesses.map((guess, index) => (
                  <View key={`${guess}-${index}`} style={styles.wrongGuessPill}>
                    <Text style={styles.wrongGuessText}>{guess}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </Card>
    );
  };

  const currentListTitle = activeList?.title ?? 'Toplijst';
  const crossScale = crossAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <>
      <Stack.Screen options={{ title: 'Toplijsten raden', headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <Animated.ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: actionBarOffset,
              paddingBottom: Math.max(
                Spacing.md,
                keyboardHeight + (Platform.OS === 'ios' ? Spacing.xl + 80 : Spacing.sm + 24)
              ),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          {stage !== 'start' && renderScoreboard()}

          {stage === 'start' && (
            <>
              <Card style={styles.introCard}>
                <Text style={styles.title}>Toplijsten raden</Text>
                <Text style={styles.subtitle}>Raad de top-lijst en vul het bord samen in.</Text>
                <Text style={styles.pitch}>
                  Spelers spelen om de beurt. Elke correcte gok vult de juiste rank in; bij {MAX_CROSSES} kruisjes lig je eruit.
                </Text>
              </Card>

              <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Crew selecteren</Text>
                  <View style={styles.sectionActions}>
                    <TouchableOpacity style={styles.linkButton} onPress={selectAll}>
                      <Text style={styles.linkButtonText}>Selecteer alles</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.linkButton} onPress={clearSelection}>
                      <Text style={styles.linkButtonText}>Wis selectie</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.hintText}>Kies {MIN_PLAYERS} tot {MAX_PLAYERS} spelers.</Text>
                <View style={styles.participantGrid}>
                  {allParticipants.map(person => {
                    const selected = selectedIds.includes(person.id);
                    const disabled = !selected && !canToggleMore;
                    const showFallback = (person as GuestParticipant).isGuest || !person.avatar || imageErrors[person.id];
                    const initials = person.naam
                      .split(' ')
                      .map(part => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <TouchableOpacity
                        key={person.id}
                        style={[
                          styles.participantTile,
                          selected && styles.participantTileSelected,
                          disabled && styles.participantTileDisabled,
                        ]}
                        onPress={() => toggleSelection(person.id)}
                        activeOpacity={0.85}
                        disabled={disabled}
                      >
                        <View style={[styles.avatarWrap, selected && styles.avatarWrapSelected]}>
                          {showFallback ? (
                            <View style={styles.avatarFallback}>
                              <Text style={styles.avatarFallbackText}>{initials}</Text>
                            </View>
                          ) : (
                            <Image
                              source={person.avatar as Participant['avatar']}
                              style={styles.avatar}
                              onError={() =>
                                setImageErrors(prev => ({
                                  ...prev,
                                  [person.id]: true,
                                }))
                              }
                            />
                          )}
                          {selected && (
                            <View style={styles.participantCheck}>
                              <Check size={16} color="#FFFFFF" />
                            </View>
                          )}
                        </View>
                        <Text style={styles.participantName}>{person.naam}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[styles.participantTile, styles.addGuestTile]}
                    onPress={() => setShowGuestModal(true)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.addGuestIcon}>
                      <Plus size={24} color={colors.primary} />
                    </View>
                    <Text style={styles.addGuestLabel}>Gast toevoegen</Text>
                  </TouchableOpacity>
                </View>
              </Card>

              <Button label="Start spel" onPress={() => startGame(false)} disabled={!canStart} />
            </>
          )}

          {stage === 'play' && activeList && (
            <>
              {renderBoard(currentListTitle)}

              {activePlayer && (
                <Card style={styles.turnCard}>
                  <Text style={styles.turnEyebrow}>Aan de beurt</Text>
                  <Text style={styles.turnPlayer}>{activePlayer.naam}</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.input, styles.guessInput]}
                      placeholder="Typ je gok"
                      value={guessInput}
                      onChangeText={setGuessInput}
                      autoCorrect={false}
                      autoCapitalize="sentences"
                      returnKeyType="done"
                      onSubmitEditing={handleGuess}
                    />
                    <Button label="Gok" onPress={handleGuess} />
                  </View>
                  {roundMessage ? <Text style={styles.roundMessage}>{roundMessage}</Text> : null}
                </Card>
              )}
            </>
          )}

          {stage === 'final' && (
            <>
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Ronde klaar</Text>
                <Text style={styles.hintText}>
                  {remainingSlots === 0 ? 'Alle items zijn geraden!' : 'Er is nog maar één speler over.'}
                </Text>
                {roundWinners.length > 0 && (
                  <Text style={styles.hintText}>
                    Winnaar: {roundWinners.map(id => activePlayers.find(p => p.id === id)?.naam).filter(Boolean).join(', ')}
                  </Text>
                )}
              </Card>

              {activeList ? renderBoard(currentListTitle, true) : null}

              <Button label="Nieuwe lijst (zelfde crew)" onPress={() => startGame(true)} />
              <Button label="Nieuwe setup" onPress={resetGame} variant="secondary" />
            </>
          )}
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      <Modal transparent visible={showGuestModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Gast toevoegen</Text>
            <TextInput
              style={styles.input}
              placeholder="Naam"
              value={guestName}
              onChangeText={text => {
                setGuestName(text);
                if (guestError) setGuestError(null);
              }}
              autoCorrect={false}
            />
            {guestError ? <Text style={styles.inputError}>{guestError}</Text> : null}
            <View style={styles.modalActions}>
              <Button label="Annuleren" variant="secondary" onPress={() => setShowGuestModal(false)} />
              <Button label="Toevoegen" onPress={addGuest} />
            </View>
          </View>
        </View>
      </Modal>

      {showConfetti && (
        <View pointerEvents="none" style={[styles.confettiOverlay, { top: actionBarOffset + 6 }]}>
          {confettiPieces.map((piece, index) => {
            const anim = confettiAnims.current[index];
            if (!anim) return null;
            const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 140] });
            const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, piece.drift] });
            const opacity = anim.interpolate({
              inputRange: [0, 0.2, 0.8, 1],
              outputRange: [0, 1, 1, 0],
            });
            return (
              <Animated.View
                key={`confetti-${piece.id}`}
                style={[
                  styles.confettiPiece,
                  {
                    left: piece.left,
                    width: piece.size,
                    height: piece.size * 1.6,
                    backgroundColor: piece.color,
                    opacity,
                    transform: [{ translateY }, { translateX }, { rotate: `${piece.rotate}deg` }],
                  },
                ]}
              />
            );
          })}
        </View>
      )}

      {showCross && (
        <Animated.View pointerEvents="none" style={[styles.crossOverlay, { opacity: crossAnim }]}>
          <Animated.View style={[styles.crossBadge, { transform: [{ scale: crossScale }] }]}>
            <View style={styles.bigCrossRow}>
              {Array.from({ length: MAX_CROSSES }).map((_, index) => {
                const show = index < showCrossCount;
                const anim = bigCrossAnims[index];
                const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
                return (
                  <Animated.View
                    key={`big-cross-${index}`}
                    style={{ opacity: show ? anim : 0, transform: [{ scale }] }}
                  >
                    <X size={54} color={colors.danger} strokeWidth={4} />
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        </Animated.View>
      )}

      <FloatingActions
        showSettings={false}
        showLifeBuoy={false}
        animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
      />
    </>
  );
}

const createConfettiPieces = (palette: any): ConfettiPiece[] => {
  const { width } = Dimensions.get('window');
  const paletteColors = [
    palette.accent,
    palette.primary,
    palette.success,
    palette.danger,
  ].filter(Boolean);
  return Array.from({ length: 14 }, (_, index) => ({
    id: index,
    left: 16 + Math.random() * Math.max(0, width - 32),
    size: 6 + Math.random() * 6,
    drift: (Math.random() - 0.5) * 40,
    rotate: Math.random() * 90 - 45,
    color: paletteColors[index % paletteColors.length] || palette.primary,
  }));
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\([^)]*\)/g, '')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');


const levenshtein = (a: string, b: string) => {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
};

const getBoardSize = (list: TopList) => {
  const match = list.type.toLowerCase().match(/top\s*(\d+)/);
  if (match?.[1]) return Number(match[1]);
  const maxRank = list.items.reduce((max, item) => Math.max(max, item.rank), 0);
  return maxRank || list.items.length || 10;
};

const getNextActiveIndex = (
  currentIndex: number,
  players: SelectableParticipant[],
  eliminatedIds: string[]
) => {
  if (!players.length) return 0;
  for (let offset = 1; offset <= players.length; offset += 1) {
    const nextIndex = (currentIndex + offset) % players.length;
    const nextPlayer = players[nextIndex];
    if (!eliminatedIds.includes(nextPlayer.id)) {
      return nextIndex;
    }
  }
  return currentIndex;
};

const findBestMatch = (
  normalizedGuess: string,
  items: Array<TopListItem & { normalized: string }>,
  board: BoardEntry[],
  usedSet: Set<string>
) => {
  const openRanks = new Set(board.filter(entry => !entry.answer).map(entry => entry.rank));
  let best: (TopListItem & { normalized: string }) | null = null;
  let bestScore = Infinity;
  for (const item of items) {
    if (!openRanks.has(item.rank)) continue;
    if (usedSet.has(item.normalized)) continue;
    if (item.normalized === normalizedGuess) {
      return item;
    }
    const tokens = item.normalized.split(' ').filter(Boolean);
    const tokenMatch = tokens.some(token => {
      if (token === normalizedGuess) return true;
      const distance = levenshtein(normalizedGuess, token);
      const threshold = token.length <= 4 ? 0 : token.length <= 7 ? 1 : 2;
      return distance <= threshold;
    });
    if (tokenMatch) {
      return item;
    }
    const distance = levenshtein(normalizedGuess, item.normalized);
    const threshold = item.normalized.length <= 4 ? 0 : item.normalized.length <= 7 ? 1 : 2;
    if (distance <= threshold && distance < bestScore) {
      best = item;
      bestScore = distance;
    }
  }
  return best;
};

const validateLists = (raw: unknown): { items: TopList[]; error?: string } => {
  const normalized = (raw as { lists?: unknown })?.lists ?? raw;
  if (!Array.isArray(normalized)) {
    return { items: [], error: 'Top-lijsten moeten een array zijn.' };
  }
  const lists: TopList[] = [];
  for (const entry of normalized) {
    if (
      typeof entry?.id !== 'number' ||
      typeof entry?.title !== 'string' ||
      typeof entry?.type !== 'string' ||
      !Array.isArray(entry?.items)
    ) {
      return { items: [], error: 'Top-lijsten hebben een ongeldig formaat.' };
    }
    const items: TopListItem[] = [];
    for (const item of entry.items) {
      if (typeof item?.rank !== 'number' || typeof item?.answer !== 'string') {
        return { items: [], error: 'Top-lijsten hebben ongeldige items.' };
      }
      items.push({ rank: item.rank, answer: item.answer });
    }
    const source = typeof entry.source === 'string' ? entry.source : undefined;
    lists.push({ id: entry.id, title: entry.title, type: entry.type, source, items });
  }
  return { items: lists };
};

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    content: {
      padding: Spacing.md,
      paddingBottom: Spacing.md,
      gap: Spacing.xs,
      flexGrow: 1,
    },
    title: {
      fontSize: Typography.title,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    subtitle: {
      fontSize: Typography.body,
      color: palette.textSecondary,
      lineHeight: 22,
    },
    pitch: {
      fontSize: Typography.body,
      color: palette.textSecondary,
      lineHeight: 22,
    },
    introCard: {
      gap: 4,
    },
    sectionCard: {
      gap: Spacing.xs,
    },
    sectionTitle: {
      fontSize: Typography.section,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    sectionActions: {
      flexDirection: 'row',
      gap: 10,
    },
    linkButton: {
      paddingVertical: 8,
    },
    linkButtonText: {
      color: palette.primary,
      fontWeight: '700',
    },
    hintText: {
      fontSize: Typography.label,
      color: palette.textSecondary,
    },
    participantGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 0,
      justifyContent: 'flex-start',
    },
    participantTile: {
      width: '33.3333%',
      flexBasis: '33.3333%',
      maxWidth: '33.3333%',
      minWidth: '33.3333%',
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 6,
      position: 'relative',
    },
    participantTileSelected: {
      backgroundColor: palette.surface,
    },
    participantTileDisabled: {
      opacity: 0.4,
    },
    avatarWrap: {
      position: 'relative',
    },
    avatarWrapSelected: {
      shadowColor: palette.primary,
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
    },
    avatar: {
      width: 102,
      height: 102,
      borderRadius: 51,
    },
    avatarFallback: {
      width: 102,
      height: 102,
      borderRadius: 51,
      backgroundColor: palette.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFallbackText: {
      fontSize: 22,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    participantCheck: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: palette.primary,
      borderRadius: 10,
      padding: 4,
    },
    participantName: {
      fontSize: 14,
      color: palette.textPrimary,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: 6,
    },
    addGuestTile: {
      borderStyle: 'dashed',
      justifyContent: 'center',
    },
    addGuestIcon: {
      width: 97,
      height: 97,
      borderRadius: 48.5,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: palette.primary,
    },
    addGuestLabel: {
      fontSize: 15,
      color: palette.primary,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: 8,
    },
    scoreboardCard: {
      gap: Spacing.xs,
    },
    scoreboardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    scoreboardHint: {
      fontSize: Typography.caption,
      color: palette.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    scoreNameEliminated: {
      textDecorationLine: 'line-through',
      color: palette.textSecondary,
    },
    matchScoreList: {
      gap: 6,
    },
    matchScoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 10,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    matchScoreRowActive: {
      borderColor: palette.accent,
      backgroundColor: palette.accent + '12',
    },
    matchScoreRowEliminated: {
      opacity: 0.6,
    },
    matchScoreNameRow: {
      flex: 1,
      gap: 4,
    },
    matchScoreName: {
      flex: 1,
      fontSize: Typography.body,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    crossRow: {
      flexDirection: 'row',
      gap: 2,
      alignItems: 'center',
    },
    crossIcon: {
      opacity: 0.4,
    },
    crossIconFilled: {
      opacity: 1,
    },
    matchScoreMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: palette.primary + '18',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    matchScoreLabel: {
      fontSize: Typography.caption,
      color: palette.textSecondary,
      fontWeight: '700',
    },
    matchScoreValue: {
      fontSize: Typography.body,
      fontWeight: '800',
      color: palette.textPrimary,
    },
    scoreboardNote: {
      fontSize: Typography.caption,
      color: palette.textSecondary,
    },
    boardCard: {
      gap: 4,
    },
    boardHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    boardTitleWrap: {
      flex: 1,
      gap: 2,
      paddingRight: Spacing.sm,
    },
    boardTitle: {
      fontSize: Typography.section,
      fontWeight: '800',
      color: palette.textPrimary,
    },
    boardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    boardSource: {
      fontSize: Typography.caption,
      color: palette.textSecondary,
    },
    boardList: {
      gap: 4,
    },
    boardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: 6,
      paddingHorizontal: 6,
      borderRadius: 10,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    boardRowFilled: {
      borderColor: palette.accent,
      backgroundColor: palette.accent + '18',
    },
    boardRankBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.primary,
    },
    boardRankText: {
      fontSize: 11,
      fontWeight: '800',
      color: palette.background,
    },
    boardAnswer: {
      flex: 1,
      fontSize: Typography.body,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    boardPlaceholder: {
      flex: 1,
      fontSize: Typography.body,
      color: palette.muted ?? palette.textSecondary,
      fontStyle: 'italic',
    },
    revealButton: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.accent + '12',
    },
    revealButtonDisabled: {
      opacity: 0.5,
    },
    revealButtonText: {
      fontSize: 11,
      color: palette.textPrimary,
      fontWeight: '700',
    },
    skipButton: {
      marginLeft: 'auto',
      paddingVertical: 2,
      paddingHorizontal: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    skipButtonText: {
      fontSize: 11,
      color: palette.textSecondary,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    turnCard: {
      gap: Spacing.xs,
      borderWidth: 1,
      borderColor: palette.accent,
      backgroundColor: palette.surface,
    },
    turnEyebrow: {
      fontSize: Typography.caption,
      textTransform: 'uppercase',
      letterSpacing: 1.4,
      color: palette.textSecondary,
    },
    turnPlayer: {
      fontSize: 22,
      fontWeight: '800',
      color: palette.primary,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: Typography.body,
      color: palette.textPrimary,
      backgroundColor: palette.surface,
    },
    guessInput: {
      flex: 1,
    },
    roundMessage: {
      fontSize: Typography.caption,
      color: palette.textSecondary,
    },
    wrongGuessesWrap: {
      gap: 6,
    },
    wrongGuessesToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    wrongGuessesToggleText: {
      fontSize: Typography.caption,
      color: palette.textPrimary,
      fontWeight: '700',
    },
    wrongGuessesToggleHint: {
      fontSize: Typography.caption,
      color: palette.textSecondary,
    },
    wrongGuessesList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    wrongGuessPill: {
      backgroundColor: palette.border,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    wrongGuessText: {
      fontSize: Typography.caption,
      color: palette.textPrimary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.md,
    },
    modalCard: {
      width: '100%',
      backgroundColor: palette.background,
      borderRadius: 16,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    modalTitle: {
      fontSize: Typography.section,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: Spacing.sm,
    },
    inputError: {
      fontSize: Typography.caption,
      color: palette.error,
    },
    confettiOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 180,
      zIndex: 12,
    },
    confettiPiece: {
      position: 'absolute',
      borderRadius: 4,
    },
    crossOverlay: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 14,
      backgroundColor: 'rgba(0,0,0,0.08)',
    },
    crossBadge: {
      padding: Spacing.md,
      borderRadius: 24,
      backgroundColor: palette.surface,
      borderWidth: 2,
      borderColor: palette.danger,
    },
    bigCrossRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.sm,
    },
    errorContainer: {
      flex: 1,
      backgroundColor: palette.background,
      padding: Spacing.md,
    },
    errorCard: {
      gap: Spacing.xs,
    },
    errorTitle: {
      fontSize: Typography.section,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    errorText: {
      fontSize: Typography.body,
      color: palette.textSecondary,
    },
    errorPath: {
      fontSize: Typography.caption,
      color: palette.primary,
    },
    errorSchema: {
      fontSize: Typography.caption,
      color: palette.textSecondary,
    },
  });
