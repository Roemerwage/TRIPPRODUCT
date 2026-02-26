import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { Check, Info, Plus, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTrip } from '@/contexts/TripContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FloatingActions } from '@/components/FloatingActions';
import { Spacing, Typography } from '@/constants/tokens';
import type { Participant } from '@/types/trip';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type WordPair = {
  wordA: string;
  wordB: string;
  wordC: string;
};

type UndercoverRole = 'Civilian' | 'Undercover' | 'Mr. White';

type UndercoverPlayer = Omit<Participant, 'avatar'> & {
  avatar?: Participant['avatar'];
  role: UndercoverRole;
  secretWord: string | null;
  eliminated: boolean;
  isGuest?: boolean;
};

type SelectablePlayer = Omit<Participant, 'avatar'> & {
  avatar?: Participant['avatar'];
  isGuest?: boolean;
};

type GuestPlayer = SelectablePlayer & {
  id: string;
  naam: string;
  isGuest: true;
};

type Stage =
  | 'start'
  | 'pass-reveal'
  | 'reveal'
  | 'discussion'
  | 'eliminate'
  | 'reveal-role'
  | 'mrwhite-guess'
  | 'scores'
  | 'final'
  | 'error';

const WORDS_ASSET_RELATIVE = '../../assets/minigames/undercover/secret_words.json';
const WORDS_ASSET_PATH = '/assets/minigames/undercover/secret_words.json';
const WORDS_SCHEMA = '["woord1;woord2;woord3", ...] of [{ "wordA": string, "wordB": string, "wordC": string }]';
const USED_WORDS_KEY = 'undercover.used_word_pairs';

export default function UndercoverScreen() {
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
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [guestPlayers, setGuestPlayers] = useState<GuestPlayer[]>([]);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [showRules, setShowRules] = useState(false);
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);
  const [players, setPlayers] = useState<UndercoverPlayer[]>([]);
  const [revealIndex, setRevealIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [numUndercovers, setNumUndercovers] = useState(0);
  const [numMrWhites, setNumMrWhites] = useState(1);
  const [civilWord, setCivilWord] = useState<string | null>(null);
  const [undercoverWord, setUndercoverWord] = useState<string | null>(null);
  const [mrWhiteStartWord, setMrWhiteStartWord] = useState<string | null>(null);
  const [mrWhiteStartUsed, setMrWhiteStartUsed] = useState(false);
  const [startingIndex, setStartingIndex] = useState(0);
  const [eliminationId, setEliminationId] = useState<string | null>(null);
  const [mrWhiteGuess, setMrWhiteGuess] = useState('');
  const [winner, setWinner] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [targetRounds, setTargetRounds] = useState(5);
  const [completedRounds, setCompletedRounds] = useState(0);
  const [lastCompletedRound, setLastCompletedRound] = useState(0);
  const [eliminationCount, setEliminationCount] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragY = React.useRef(new Animated.Value(0)).current;
  const dragStartIndex = React.useRef<number | null>(null);
  const ORDER_ROW_HEIGHT = 54;
  const [eliminatedPlayer, setEliminatedPlayer] = useState<UndercoverPlayer | null>(null);
  const [pendingResult, setPendingResult] = useState<string | null>(null);
  const [pendingMrWhiteGuess, setPendingMrWhiteGuess] = useState(false);
  const [revealDots, setRevealDots] = useState('');
  const revealOpacity = useRef(new Animated.Value(0)).current;
  const roleOpacity = useRef(new Animated.Value(0)).current;
  const nextStarterIndexRef = useRef<number | null>(null);

  const { items: wordPairs, error: wordError } = useMemo(() => {
    let raw: unknown = null;
    try {
      raw = require(WORDS_ASSET_RELATIVE);
    } catch (err) {
      return { items: [] as WordPair[], error: 'Woordlijst kon niet worden geladen.' };
    }

    const normalized = (raw as any)?.default ?? raw;
    return validateWordPairs(normalized);
  }, []);

  const MAX_PLAYERS = 12;
  const allPlayers = useMemo(() => [...participants, ...guestPlayers], [participants, guestPlayers]);
  const maxPlayers = Math.min(MAX_PLAYERS, allPlayers.length);
  const canToggleMore = selectedIds.length < MAX_PLAYERS;
  const playerLookup = useMemo(
    () => new Map(allPlayers.map(person => [person.id, person])),
    [allPlayers]
  );
  const orderedSelectedPlayers = useMemo(() => {
    if (!orderedIds.length) {
      return allPlayers.filter(person => selectedIds.includes(person.id));
    }
    return orderedIds
      .map(id => playerLookup.get(id))
      .filter(Boolean) as Participant[];
  }, [orderedIds, playerLookup, selectedIds, allPlayers]);
  const selectedPlayers = orderedSelectedPlayers;
  const canStart = selectedIds.length >= 3 && wordPairs.length > 0;
  const alivePlayers = players.filter(player => !player.eliminated);

  const scoreEntries = useMemo(() => {
    const base = (selectedPlayers.length ? selectedPlayers : allPlayers).filter(Boolean);
    const unique = new Map<string, Participant>();
    base.forEach(person => {
      if (!unique.has(person.id)) unique.set(person.id, person as Participant);
    });
    return Array.from(unique.values())
      .map(person => ({ id: person.id, name: person.naam, score: scores[person.id] ?? 0 }))
      .sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name));
  }, [selectedPlayers, allPlayers, scores]);

  useEffect(() => {
    if (!selectedIds.length) {
      setOrderedIds([]);
      return;
    }
    if (!orderedIds.length) {
      const initialOrder = allPlayers
        .filter(person => selectedIds.includes(person.id))
        .map(person => person.id);
      setOrderedIds(initialOrder);
    }
  }, [orderedIds.length, allPlayers, selectedIds]);

  useEffect(() => {
    if (selectedIds.length < 3) {
      setNumUndercovers(0);
      setNumMrWhites(1);
      return;
    }
    const maxUndercovers = Math.max(0, selectedIds.length - numMrWhites - 1);
    setNumUndercovers(prev => Math.min(Math.max(0, prev), maxUndercovers));
    const maxMrWhites = Math.max(1, selectedIds.length - numUndercovers - 1);
    setNumMrWhites(prev => Math.min(Math.max(1, prev), maxMrWhites));
  }, [selectedIds.length, numUndercovers, numMrWhites]);

  if (wordError) {
    return (
      <>
        <Stack.Screen options={{ title: 'Undercover', headerShown: false }} />
        <View style={[styles.errorContainer, { paddingTop: actionBarOffset }]}>
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Woordlijst ontbreekt of is ongeldig</Text>
            <Text style={styles.errorText}>Kon de lokale woordenlijst niet laden:</Text>
            <Text style={styles.errorPath}>{WORDS_ASSET_PATH}</Text>
            <Text style={styles.errorText}>Verwacht formaat:</Text>
            <Text style={styles.errorSchema}>{WORDS_SCHEMA}</Text>
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
        setOrderedIds(order => order.filter(item => item !== id));
        return prev.filter(item => item !== id);
      }
      if (!canToggleMore) return prev;
      setOrderedIds(order => [...order, id]);
      return [...prev, id];
    });
  };

  const selectAll = () => {
    const ids = allPlayers.map(player => player.id).slice(0, maxPlayers);
    setSelectedIds(ids);
    setOrderedIds(ids);
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setOrderedIds([]);
  };

  const addGuest = () => {
    const trimmed = guestName.trim();
    if (!trimmed) {
      setGuestError('Vul een naam in.');
      return;
    }
    const normalized = trimmed.toLowerCase();
    const nameTaken = allPlayers.some(person => person.naam.toLowerCase() === normalized);
    if (nameTaken) {
      setGuestError('Naam bestaat al.');
      return;
    }
    const newGuest: GuestPlayer = {
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

  const moveOrderToIndex = (id: string, targetIndex: number) => {
    setOrderedIds(prev => {
      const index = prev.indexOf(id);
      if (index === -1 || index === targetIndex) return prev;
      const updated = [...prev];
      updated.splice(index, 1);
      updated.splice(targetIndex, 0, id);
      return updated;
    });
  };

  const resetGame = () => {
    setStage('start');
    setPlayers([]);
    setRevealIndex(0);
    setRound(1);
    setCivilWord(null);
    setUndercoverWord(null);
    setMrWhiteStartWord(null);
    setMrWhiteStartUsed(false);
    setStartingIndex(0);
    setEliminationId(null);
    setMrWhiteGuess('');
    setWinner(null);
    setCompletedRounds(0);
    setLastCompletedRound(0);
    setScores({});
    setEliminationCount(0);
    setEliminatedPlayer(null);
    setPendingResult(null);
    setPendingMrWhiteGuess(false);
    setRevealDots('');
    revealOpacity.setValue(0);
    roleOpacity.setValue(0);
  };

  const applyScoreToPlayers = (ids: string[], delta: number) => {
    if (!ids.length || delta === 0) return;
    setScores(prev => {
      const next = { ...prev };
      ids.forEach(id => {
        next[id] = (next[id] ?? 0) + delta;
      });
      return next;
    });
  };

  const awardMrWhiteSurvival = () => {
    const aliveMrWhites = players.filter(player => !player.eliminated && player.role === 'Mr. White');
    applyScoreToPlayers(aliveMrWhites.map(p => p.id), 1);
  };

  const concludeGame = (
    result: string,
    opts?: { mrWhiteWasEliminated?: boolean; mrWhiteCorrectGuess?: boolean; mrWhiteId?: string | null }
  ) => {
    const alive = players.filter(player => !player.eliminated);
    const civilsAlive = alive.filter(player => player.role === 'Civilian');
    const undercoversAlive = alive.filter(player => player.role === 'Undercover');
    const mrWhitesAlive = alive.filter(player => player.role === 'Mr. White');

    if (result === 'Undercovers winnen') {
      applyScoreToPlayers(undercoversAlive.map(p => p.id), 3);
    }

    if (result === 'Mr. White wint') {
      if (opts?.mrWhiteWasEliminated) {
        if (opts?.mrWhiteCorrectGuess && opts.mrWhiteId) {
          applyScoreToPlayers([opts.mrWhiteId], 3);
        }
      } else {
        applyScoreToPlayers(mrWhitesAlive.map(p => p.id), 4);
      }
      if (undercoversAlive.length) {
        applyScoreToPlayers(undercoversAlive.map(p => p.id), 1);
      }
    }

    setWinner(result);
    setCompletedRounds(prev => {
      const next = Math.min(prev + 1, targetRounds);
      setLastCompletedRound(next);
      return next;
    });
    setStage('scores');
  };

  const getPairKey = (pair: WordPair) => `${pair.wordA};${pair.wordB};${pair.wordC}`;

  const pickStartingIndex = (roster: UndercoverPlayer[]) => {
    if (!roster.length) return 0;
    const total = roster.length;
    if (nextStarterIndexRef.current === null) {
      nextStarterIndexRef.current = Math.floor(Math.random() * total);
    } else {
      nextStarterIndexRef.current = (nextStarterIndexRef.current + 1) % total;
    }
    return nextStarterIndexRef.current;
  };

  const assignRoles = async () => {
    if (!selectedPlayers.length) return [];
    let usedKeys: string[] = [];
    try {
      const stored = await AsyncStorage.getItem(USED_WORDS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          usedKeys = parsed.filter(item => typeof item === 'string');
        }
      }
    } catch (err) {
      usedKeys = [];
    }

    const unusedPairs = wordPairs.filter(pair => !usedKeys.includes(getPairKey(pair)));
    const pool = unusedPairs.length ? unusedPairs : wordPairs;
    const pair = pool[Math.floor(Math.random() * pool.length)];
    const nextUsed = unusedPairs.length ? [...usedKeys, getPairKey(pair)] : [getPairKey(pair)];
    try {
      await AsyncStorage.setItem(USED_WORDS_KEY, JSON.stringify(nextUsed));
    } catch (err) {
      // Storage failures should not block gameplay.
    }

    const undercoverFirst = Math.random() < 0.5;
    const civil = undercoverFirst ? pair.wordB : pair.wordA;
    const undercover = undercoverFirst ? pair.wordA : pair.wordB;
    setCivilWord(civil);
    setUndercoverWord(undercover);
    setMrWhiteStartWord(pair.wordC);

    const shuffled = shuffleArray([...selectedPlayers]);
    const undercovers = shuffled.slice(0, numUndercovers).map(p => p.id);
    const mrWhites = shuffled
      .slice(numUndercovers, numUndercovers + numMrWhites)
      .map(p => p.id);

    return selectedPlayers.map(person => {
      let role: UndercoverRole = 'Civilian';
      let secretWord: string | null = civil;
      if (undercovers.includes(person.id)) {
        role = 'Undercover';
        secretWord = undercover;
      } else if (mrWhites.includes(person.id)) {
        role = 'Mr. White';
        secretWord = null;
      }
      return {
        ...person,
        role,
        secretWord,
        eliminated: false,
      };
    });
  };

  const startGame = async () => {
    const assigned = await assignRoles();
    if (!assigned.length) return;
    const initialStarter = pickStartingIndex(assigned);
    setPlayers(assigned);
    setRevealIndex(0);
    setRound(1);
    setEliminationId(null);
    setMrWhiteGuess('');
    setWinner(null);
    setMrWhiteStartUsed(false);
    setStartingIndex(initialStarter);
    setEliminationCount(0);
    setStage('pass-reveal');
  };

  const proceedToReveal = () => setStage('reveal');

  const nextReveal = () => {
    if (revealIndex + 1 >= players.length) {
      const nextIndex = getNextAliveIndex(startingIndex, players);
      setStartingIndex(nextIndex);
      setStage('discussion');
      return;
    }
    const revealing = players[revealIndex];
    if (
      revealing &&
      revealing.role === 'Mr. White' &&
      !mrWhiteStartUsed &&
      round === 1 &&
      getNextAliveIndex(startingIndex, players) === revealIndex &&
      mrWhiteStartWord
    ) {
      setMrWhiteStartUsed(true);
    }
    setRevealIndex(prev => prev + 1);
    setStage('pass-reveal');
  };

  const determineWinner = (updated: UndercoverPlayer[]) => {
    const alive = updated.filter(player => !player.eliminated);
    const civils = alive.filter(player => player.role === 'Civilian');
    const undercovers = alive.filter(player => player.role === 'Undercover');
    const mrWhites = alive.filter(player => player.role === 'Mr. White');

    if (undercovers.length === 0 && mrWhites.length === 0) return 'Burgers winnen';
    if (civils.length === 1 && mrWhites.length === 0 && undercovers.length > 0) return 'Undercovers winnen';
    if (undercovers.length === 0 && civils.length === 1 && mrWhites.length === 1) return 'Mr. White wint';
    if (undercovers.length === 0 && civils.length === 0 && mrWhites.length === 1) return 'Mr. White wint';
    return null;
  };

  const confirmElimination = () => {
    if (!eliminationId) return;
    const updated = players.map(player =>
      player.id === eliminationId ? { ...player, eliminated: true } : player
    );
    setPlayers(updated);
    const eliminated = updated.find(player => player.id === eliminationId) ?? null;
    const civilsAlive = updated.filter(player => !player.eliminated && player.role === 'Civilian');
    const undercoversAlive = updated.filter(player => !player.eliminated && player.role === 'Undercover');

    if (eliminated?.role === 'Mr. White') {
      applyScoreToPlayers(civilsAlive.map(p => p.id), 2);
    }

    if (eliminated?.role === 'Undercover') {
      applyScoreToPlayers(civilsAlive.map(p => p.id), 1);
      if (eliminationCount === 0) {
        applyScoreToPlayers([eliminated.id], -1);
      }
    }

    setEliminationCount(prev => prev + 1);
    const result = determineWinner(updated);
    setEliminatedPlayer(eliminated);
    setPendingResult(result);
    setPendingMrWhiteGuess(eliminated?.role === 'Mr. White');
    setEliminationId(null);
    setStage('reveal-role');
  };

  const submitMrWhiteGuess = () => {
    const normalizedGuess = mrWhiteGuess.trim().toLowerCase();
    const normalizedCivil = (civilWord ?? '').trim().toLowerCase();
    if (normalizedGuess && normalizedGuess === normalizedCivil) {
      const aliveMrWhites = players.filter(player => !player.eliminated && player.role === 'Mr. White');
      const otherMrWhiteAlive = aliveMrWhites.some(player => player.id !== eliminatedPlayer?.id);
      if (!otherMrWhiteAlive) {
        concludeGame('Mr. White wint', {
          mrWhiteWasEliminated: true,
          mrWhiteCorrectGuess: true,
          mrWhiteId: eliminatedPlayer?.id ?? null,
        });
        return;
      }
      if (eliminatedPlayer?.id) {
        applyScoreToPlayers([eliminatedPlayer.id], 3);
      }
    }

    const result = determineWinner(players);
    if (result) {
      concludeGame(result, { mrWhiteWasEliminated: false });
    } else {
      awardMrWhiteSurvival();
      setRound(prev => prev + 1);
      const nextIndex = getNextAliveIndex(startingIndex + 1, players);
      setStartingIndex(nextIndex);
      setStage('discussion');
    }
    setPendingMrWhiteGuess(false);
    setMrWhiteGuess('');
  };

  const currentPlayer = players[revealIndex] || null;
  const startingPlayer = players[getNextAliveIndex(startingIndex, players)] ?? null;
  const showMrWhiteStart =
    currentPlayer?.role === 'Mr. White' &&
    currentPlayer?.id === startingPlayer?.id &&
    !mrWhiteStartUsed &&
    round === 1 &&
    mrWhiteStartWord;
  const isGuestPlayer = (person: SelectablePlayer) => person.isGuest === true;
  const eliminatedRoleText = eliminatedPlayer?.role === 'Civilian'
    ? 'Burger'
    : eliminatedPlayer?.role === 'Undercover'
      ? 'Undercover'
      : eliminatedPlayer?.role === 'Mr. White'
        ? 'Mr. White'
        : 'Onbekend';

  useEffect(() => {
    if (stage !== 'reveal-role' || !eliminatedPlayer) return undefined;
    setRevealDots('');
    revealOpacity.setValue(0);
    roleOpacity.setValue(0);
    Animated.timing(revealOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    let dotIndex = 0;
    const dotTimer = setInterval(() => {
      dotIndex = (dotIndex + 1) % 5;
      setRevealDots('.'.repeat(dotIndex));
    }, 300);
    const roleTimer = Animated.sequence([
      Animated.delay(1400),
      Animated.timing(roleOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]);
    roleTimer.start();
    return () => {
      clearInterval(dotTimer);
      roleTimer.stop();
    };
  }, [stage, eliminatedPlayer, revealOpacity, roleOpacity]);

  const proceedAfterReveal = () => {
    if (pendingMrWhiteGuess) {
      setStage('mrwhite-guess');
      return;
    }
    if (pendingResult) {
      concludeGame(pendingResult, {
        mrWhiteWasEliminated: eliminatedPlayer?.role === 'Mr. White',
        mrWhiteId: eliminatedPlayer?.id ?? null,
      });
      return;
    }
    awardMrWhiteSurvival();
    setRound(prev => prev + 1);
    const nextIndex = getNextAliveIndex(startingIndex + 1, players);
    setStartingIndex(nextIndex);
    setStage('discussion');
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Undercover', headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <Animated.ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingTop: actionBarOffset }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollEnabled={!draggingId}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          {stage === 'start' && (
            <>
              <Card style={styles.introCard}>
                <Text style={styles.title}>Undercover</Text>
                <Text style={styles.subtitle}>Sociaal deductiespel voor 3-12 spelers.</Text>
                <TouchableOpacity onPress={() => setShowRules(true)}>
                  <Text style={styles.rulesLink}>Spelregels bekijken</Text>
                </TouchableOpacity>
              </Card>

              <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Deelnemers kiezen</Text>
                  <View style={styles.sectionActions}>
                    <TouchableOpacity style={styles.linkButton} onPress={selectAll}>
                      <Text style={styles.linkButtonText}>Selecteer alles</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.linkButton} onPress={clearSelection}>
                      <Text style={styles.linkButtonText}>Wis selectie</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.hintText}>
                  Kies 3 tot {maxPlayers} spelers.
                </Text>
                <View style={styles.participantGrid}>
                  {allPlayers.map(person => {
                    const selected = selectedIds.includes(person.id);
                    const disabled = !selected && !canToggleMore;
                    const showFallback = isGuestPlayer(person) || !person.avatar || imageErrors[person.id];
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
                            source={person.avatar}
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

              {selectedPlayers.length > 0 && (
                <Card style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Volgorde</Text>
                  <Text style={styles.hintText}>Bepaal de volgorde in de kring.</Text>
                  <View style={styles.orderList}>
                    {selectedPlayers.map((person, index) => {
                      const isDragging = draggingId === person.id;
                      const panResponder = PanResponder.create({
                        onStartShouldSetPanResponder: () => true,
                        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
                        onPanResponderGrant: () => {
                          setDraggingId(person.id);
                          dragStartIndex.current = index;
                          dragY.setValue(0);
                        },
                        onPanResponderMove: Animated.event([null, { dy: dragY }], { useNativeDriver: false }),
                        onPanResponderRelease: (_, gesture) => {
                          const from = dragStartIndex.current ?? index;
                          const delta = Math.round(gesture.dy / ORDER_ROW_HEIGHT);
                          const target = Math.max(0, Math.min(selectedPlayers.length - 1, from + delta));
                          moveOrderToIndex(person.id, target);
                          dragY.setValue(0);
                          dragStartIndex.current = null;
                          setDraggingId(null);
                        },
                        onPanResponderTerminate: () => {
                          dragY.setValue(0);
                          dragStartIndex.current = null;
                          setDraggingId(null);
                        },
                      });

                      return (
                        <Animated.View
                          key={person.id}
                          style={[
                            styles.orderRow,
                            isDragging && styles.orderRowDragging,
                            isDragging && { transform: [{ translateY: dragY }] },
                          ]}
                          {...panResponder.panHandlers}
                        >
                          <Text style={styles.orderName}>
                            {index + 1}. {person.naam}
                          </Text>
                        </Animated.View>
                      );
                    })}
                  </View>
                </Card>
              )}

              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Rollen</Text>
                <View style={styles.counterRow}>
                  <Text style={styles.counterLabel}>Mr. White</Text>
                  <View style={styles.counterControls}>
                    <TouchableOpacity
                      style={styles.counterButton}
                      onPress={() => setNumMrWhites(prev => Math.max(1, prev - 1))}
                      disabled={numMrWhites <= 1}
                    >
                      <Text style={styles.counterButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{numMrWhites}</Text>
                    <TouchableOpacity
                      style={styles.counterButton}
                      onPress={() =>
                        setNumMrWhites(prev =>
                          Math.min(prev + 1, Math.max(1, selectedIds.length - numUndercovers - 1))
                        )
                      }
                      disabled={selectedIds.length < 3 || numMrWhites >= selectedIds.length - numUndercovers - 1}
                    >
                      <Text style={styles.counterButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.counterRow}>
                  <Text style={styles.counterLabel}>Undercover (optioneel)</Text>
                  <View style={styles.counterControls}>
                    <TouchableOpacity
                      style={styles.counterButton}
                      onPress={() => setNumUndercovers(prev => Math.max(0, prev - 1))}
                      disabled={numUndercovers <= 0}
                    >
                      <Text style={styles.counterButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{numUndercovers}</Text>
                    <TouchableOpacity
                      style={styles.counterButton}
                      onPress={() =>
                        setNumUndercovers(prev =>
                          Math.min(prev + 1, Math.max(0, selectedIds.length - numMrWhites - 1))
                        )
                      }
                      disabled={selectedIds.length < 3 || numUndercovers >= selectedIds.length - numMrWhites - 1}
                    >
                      <Text style={styles.counterButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>

              <Card style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Aantal spellen</Text>
                  <View style={styles.counterControls}>
                    <TouchableOpacity
                      style={styles.counterButton}
                      onPress={() => setTargetRounds(prev => Math.max(1, prev - 1))}
                    >
                      <Text style={styles.counterButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{targetRounds}</Text>
                    <TouchableOpacity
                      style={styles.counterButton}
                      onPress={() => setTargetRounds(prev => Math.min(prev + 1, 20))}
                    >
                      <Text style={styles.counterButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>

              <Button label="Start spel" onPress={startGame} disabled={!canStart} />
            </>
          )}

          {stage === 'pass-reveal' && currentPlayer && (
            <Card style={styles.stageCard}>
              <Text style={styles.stageTitle}>Geef de telefoon door</Text>
              <Text style={styles.stageBody}>Geef de telefoon aan {currentPlayer.naam}.</Text>
              <View style={styles.passAvatarWrap}>
                {isGuestPlayer(currentPlayer) || !currentPlayer.avatar || imageErrors[currentPlayer.id] ? (
                  <View style={styles.passAvatarFallback}>
                    <Text style={styles.passAvatarText}>
                      {currentPlayer.naam
                        .split(' ')
                        .map(part => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </Text>
                  </View>
                ) : (
                  <Image
                    source={currentPlayer.avatar}
                    style={styles.passAvatar}
                    onError={() =>
                      setImageErrors(prev => ({
                        ...prev,
                        [currentPlayer.id]: true,
                      }))
                    }
                  />
                )}
              </View>
              <Button label="Bekijk mijn woord" onPress={proceedToReveal} />
            </Card>
          )}

          {stage === 'reveal' && currentPlayer && (
            <Card style={styles.stageCard}>
              <Text style={styles.stageTitle}>{currentPlayer.naam}</Text>
              {currentPlayer.role === 'Mr. White' ? (
                showMrWhiteStart ? (
                  <Text style={styles.mrWhiteStartText}>
                    Je bent mr. White en je moet beginnen. Je eerste woord is: {mrWhiteStartWord}
                  </Text>
                ) : (
                  <>
                    <Text style={styles.revealRole}>Je bent Mr. White.</Text>
                    <Text style={styles.revealHint}>Je krijgt geen geheim woord.</Text>
                  </>
                )
              ) : (
                <Text style={styles.revealWord}>{currentPlayer.secretWord?.toUpperCase()}</Text>
              )}
              <Button label="Verberg en ga door" onPress={nextReveal} />
            </Card>
          )}

          {stage === 'discussion' && (
            <Card style={styles.stageCard}>
              <Text style={styles.stageTitle}>Stemronde {round}</Text>
              {startingPlayer ? (
                <Text style={styles.stageBody}>{startingPlayer.naam} begint.</Text>
              ) : null}
              <Text style={styles.stageBody}>
                Bespreek en wijs daarna iemand aan om te elimineren.
              </Text>
              <Button label="Elimineer iemand" onPress={() => setStage('eliminate')} />
            </Card>
          )}

          {stage === 'eliminate' && (
            <Card style={styles.stageCard}>
              <Text style={styles.stageTitle}>Wie is geëlimineerd?</Text>
              <View style={styles.eliminateGrid}>
                {alivePlayers.map(player => {
                  const selected = eliminationId === player.id;
                  const showFallback = isGuestPlayer(player) || !player.avatar || imageErrors[player.id];
                  const initials = player.naam
                    .split(' ')
                    .map(part => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <TouchableOpacity
                      key={player.id}
                      style={[
                        styles.eliminateTile,
                        selected && styles.eliminateTileSelected,
                      ]}
                      onPress={() => setEliminationId(player.id)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.eliminateAvatarWrap}>
                        {showFallback ? (
                          <View style={styles.eliminateAvatarFallback}>
                            <Text style={styles.eliminateAvatarText}>{initials}</Text>
                          </View>
                        ) : (
                          <Image source={player.avatar} style={styles.eliminateAvatar} />
                        )}
                        {selected && (
                          <View style={styles.eliminateCross}>
                            <X size={64} color="#FFFFFF" />
                          </View>
                        )}
                      </View>
                      <Text style={styles.eliminateName}>{player.naam}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Button label="Bevestig eliminatie" onPress={confirmElimination} disabled={!eliminationId} />
            </Card>
          )}

          {stage === 'reveal-role' && eliminatedPlayer && (
            <Card style={styles.stageCard}>
              <Animated.View style={{ opacity: revealOpacity }}>
                <Text style={styles.revealName}>{eliminatedPlayer.naam} was</Text>
                <Text style={styles.revealDots}>{revealDots || '...'}</Text>
              </Animated.View>
              <Animated.Text style={[styles.revealRoleFinal, { opacity: roleOpacity }]}>
                {eliminatedRoleText}
              </Animated.Text>
              <Button label="Verder" onPress={proceedAfterReveal} />
            </Card>
          )}

          {stage === 'mrwhite-guess' && (
            <Card style={styles.stageCard}>
              <Text style={styles.stageTitle}>Mr. White gok</Text>
              <Text style={styles.stageBody}>
                {'Mr. White mag nu zijn gok doen.'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Jouw gok"
                placeholderTextColor={colors.muted}
                value={mrWhiteGuess}
                onChangeText={setMrWhiteGuess}
                autoFocus
              />
              <Button label="Gok indienen" onPress={submitMrWhiteGuess} />
            </Card>
          )}

          {stage === 'scores' && (
            <Card style={styles.stageCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.stageTitle}>Scores na spel {lastCompletedRound}</Text>
                <TouchableOpacity style={styles.iconButton} onPress={() => setShowScoreInfo(true)}>
                  <Info size={18} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              {winner ? <Text style={styles.stageBody}>Resultaat: {winner}</Text> : null}
              <Text style={styles.stageBody}>Rollen wisselen; start het volgende spel zodra je er klaar voor bent.</Text>

              <View style={styles.counterRow}>
                <Text style={styles.counterLabel}>Mr. White</Text>
                <View style={styles.counterControls}>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => setNumMrWhites(prev => Math.max(1, prev - 1))}
                    disabled={numMrWhites <= 1}
                  >
                    <Text style={styles.counterButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{numMrWhites}</Text>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() =>
                      setNumMrWhites(prev =>
                        Math.min(prev + 1, Math.max(1, selectedIds.length - numUndercovers - 1))
                      )
                    }
                    disabled={selectedIds.length < 3 || numMrWhites >= selectedIds.length - numUndercovers - 1}
                  >
                    <Text style={styles.counterButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.counterRow}>
                <Text style={styles.counterLabel}>Undercover (optioneel)</Text>
                <View style={styles.counterControls}>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => setNumUndercovers(prev => Math.max(0, prev - 1))}
                    disabled={numUndercovers <= 0}
                  >
                    <Text style={styles.counterButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{numUndercovers}</Text>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() =>
                      setNumUndercovers(prev =>
                        Math.min(prev + 1, Math.max(0, selectedIds.length - numMrWhites - 1))
                      )
                    }
                    disabled={selectedIds.length < 3 || numUndercovers >= selectedIds.length - numMrWhites - 1}
                  >
                    <Text style={styles.counterButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.scoreList}>
                {scoreEntries.length === 0 ? (
                  <Text style={styles.scoreMeta}>Nog geen scores.</Text>
                ) : (
                  scoreEntries.map(entry => {
                    const person = playerLookup.get(entry.id);
                    const showFallback = !person?.avatar || imageErrors[entry.id];
                    const initials = (person?.naam ?? entry.name)
                      .split(' ')
                      .map(part => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <View style={styles.scoreRowFull} key={entry.id}>
                        <View style={styles.scoreAvatarWrap}>
                          {showFallback ? (
                            <View style={styles.scoreAvatarFallback}>
                              <Text style={styles.scoreAvatarText}>{initials}</Text>
                            </View>
                          ) : (
                            <Image
                              source={person?.avatar}
                              style={styles.scoreAvatar}
                              onError={() =>
                                setImageErrors(prev => ({
                                  ...prev,
                                  [entry.id]: true,
                                }))
                              }
                            />
                          )}
                        </View>
                        <View style={styles.scoreTextWrap}>
                          <Text style={styles.scoreLabel}>{entry.name}</Text>
                        </View>
                        <Text style={styles.scoreValue}>{entry.score}</Text>
                      </View>
                    );
                  })
                )}
              </View>

              <Button label="Volgend spel" onPress={() => { void startGame(); }} />
            </Card>
          )}

          {stage === 'final' && (
            <Card style={styles.stageCard}>
              <Text style={styles.stageTitle}>Spel afgelopen</Text>
              <Text style={styles.resultText}>{winner}</Text>
              <Button label="Volgend spel" onPress={() => { void startGame(); }} />
            </Card>
          )}
        </Animated.ScrollView>
      </KeyboardAvoidingView>
      <FloatingActions
        showSettings={false}
        showLifeBuoy={false}
        animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
      />

      <Modal visible={showRules} transparent animationType="fade" onRequestClose={() => setShowRules(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Spelregels</Text>
              <TouchableOpacity onPress={() => setShowRules(false)}>
                <X size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalBody}>
              Burgers delen hetzelfde woord, Undercovers een ander woord en Mr. White krijgt geen woord.
            </Text>
            <Text style={styles.modalBody}>Iedereen zegt per stemronde één woord, daarna stemmen jullie iemand weg.</Text>
            <Text style={styles.modalBody}>Mr. White mag het burgerwoord raden als hij wordt geëlimineerd.</Text>
            <Text style={styles.modalBody}>Rollen wisselen elke spel; scores blijven per speler behouden.</Text>
            <Text style={styles.modalBody}>Puntentelling per speler:</Text>
            <Text style={styles.modalBody}>Burgers: +2 als Mr. White wordt ontmaskerd, +1 als een Undercover wordt ontmaskerd.</Text>
            <Text style={styles.modalBody}>Undercover: +3 als ondercovers winnen, +1 extra als Mr. White wint, -1 voor de eerste undercover die wordt uitgestemd.</Text>
            <Text style={styles.modalBody}>Mr. White: +4 als hij overleeft en wint, +3 als hij het woord raadt na eliminatie, +1 per stemronde die hij overleeft.</Text>
            <Text style={styles.modalBody}>Mr. White wint alleen als hij de laatste Mr. White in het spel is.</Text>
            <Text style={styles.modalBody}>Burgers winnen als alle Undercovers en Mr. Whites zijn geëlimineerd.</Text>
            <Text style={styles.modalBody}>Undercovers winnen als er nog maar één Burger over is en er geen Mr. White meer in het spel is.</Text>
          </Card>
        </View>
      </Modal>

      <Modal visible={showGuestModal} transparent animationType="fade" onRequestClose={() => setShowGuestModal(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gast toevoegen</Text>
              <TouchableOpacity onPress={() => setShowGuestModal(false)}>
                <X size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Naam gast"
              placeholderTextColor={colors.muted}
              value={guestName}
              onChangeText={text => {
                setGuestName(text);
                setGuestError(null);
              }}
              autoFocus
            />
            {guestError ? <Text style={styles.inputError}>{guestError}</Text> : null}
            <Button label="Gast toevoegen" onPress={addGuest} />
          </Card>
        </View>
      </Modal>

      <Modal visible={showScoreInfo} transparent animationType="fade" onRequestClose={() => setShowScoreInfo(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Puntentelling</Text>
              <TouchableOpacity onPress={() => setShowScoreInfo(false)}>
                <X size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalBody}>Burgers: +2 als Mr. White wordt ontmaskerd, +1 als een Undercover wordt ontmaskerd.</Text>
            <Text style={styles.modalBody}>Undercover: +3 als ondercovers winnen, +1 extra als Mr. White wint, -1 voor de eerste undercover die wordt uitgestemd.</Text>
            <Text style={styles.modalBody}>Mr. White: +4 als hij overleeft en wint, +3 als hij het woord raadt na eliminatie, +1 per stemronde die hij overleeft.</Text>
            <Text style={styles.modalBody}>Mr. White wint alleen als hij de laatste Mr. White in het spel is.</Text>
          </Card>
        </View>
      </Modal>
    </>
  );
}

function validateWordPairs(raw: unknown): { items: WordPair[]; error?: string } {
  if (!Array.isArray(raw)) {
    return { items: [], error: 'Woordlijst is geen lijst.' };
  }

  const parsed = raw.map(item => {
    if (typeof item === 'string') {
      const parts = item.split(';').map(part => part.trim()).filter(Boolean);
      if (parts.length >= 3) {
        return { wordA: parts[0], wordB: parts[1], wordC: parts[2] };
      }
      return null;
    }
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      if (
        typeof record.wordA === 'string' &&
        typeof record.wordB === 'string' &&
        typeof record.wordC === 'string'
      ) {
        return { wordA: record.wordA, wordB: record.wordB, wordC: record.wordC };
      }
    }
    return null;
  });

  if (parsed.some(entry => !entry)) {
    return { items: [], error: 'Woordlijst bevat ongeldige regels.' };
  }

  return { items: parsed as WordPair[] };
}

function shuffleArray<T>(input: T[]): T[] {
  const array = [...input];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getNextAliveIndex(startIndex: number, list: UndercoverPlayer[]) {
  if (!list.length) return 0;
  const len = list.length;
  for (let offset = 0; offset < len; offset += 1) {
    const idx = (startIndex + offset + len) % len;
    if (!list[idx].eliminated) return idx;
  }
  return 0;
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    content: {
      padding: Spacing.md,
      paddingBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    introCard: {
      gap: Spacing.xs,
    },
    title: {
      fontSize: Typography.title,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    subtitle: {
      fontSize: Typography.body,
      color: palette.textSecondary,
    },
    rulesLink: {
      fontSize: Typography.label,
      color: palette.primary,
      fontWeight: '700',
    },
    sectionCard: {
      gap: Spacing.sm,
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
      paddingVertical: 8,
      paddingHorizontal: 6,
      alignItems: 'center',
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
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.border,
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
      borderWidth: 2,
      borderColor: palette.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addGuestLabel: {
      fontSize: 15,
      color: palette.primary,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: 8,
    },
    orderList: {
      gap: Spacing.xs,
    },
    orderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 54,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.background,
    },
    orderRowDragging: {
      borderColor: palette.primary,
      backgroundColor: palette.surface,
      shadowColor: palette.primary,
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 10,
      elevation: 3,
      zIndex: 5,
    },
    orderName: {
      fontSize: Typography.body,
      color: palette.textPrimary,
      fontWeight: '600',
    },
    counterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    counterLabel: {
      fontSize: Typography.body,
      color: palette.textPrimary,
      fontWeight: '600',
    },
    counterControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    counterButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.background,
    },
    counterButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    counterValue: {
      fontSize: 16,
      fontWeight: '700',
      color: palette.textPrimary,
      minWidth: 24,
      textAlign: 'center',
    },
    iconButton: {
      padding: 6,
      borderRadius: 8,
    },
    stageCard: {
      gap: Spacing.sm,
    },
    stageTitle: {
      fontSize: Typography.section,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    stageBody: {
      fontSize: Typography.body,
      color: palette.textSecondary,
    },
    revealName: {
      fontSize: Typography.section,
      fontWeight: '700',
      color: palette.textPrimary,
      textAlign: 'center',
    },
    revealDots: {
      fontSize: Typography.title,
      fontWeight: '700',
      color: palette.textSecondary,
      textAlign: 'center',
      letterSpacing: 4,
      marginTop: Spacing.xs,
    },
    revealRoleFinal: {
      fontSize: 28,
      fontWeight: '800',
      color: palette.danger,
      textAlign: 'center',
      marginTop: Spacing.sm,
      textTransform: 'uppercase',
    },
    passAvatarWrap: {
      alignItems: 'center',
      marginVertical: Spacing.xs,
    },
    passAvatar: {
      width: 180,
      height: 180,
      borderRadius: 90,
      borderWidth: 2,
      borderColor: palette.border,
    },
    passAvatarFallback: {
      width: 180,
      height: 180,
      borderRadius: 90,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.border,
    },
    passAvatarText: {
      fontSize: 36,
      fontWeight: '800',
      color: palette.textPrimary,
    },
    mrWhiteStartText: {
      fontSize: Typography.body,
      color: palette.textPrimary,
      fontWeight: '700',
    },
    revealRole: {
      fontSize: Typography.body,
      color: palette.textPrimary,
      fontWeight: '700',
    },
    revealWord: {
      fontSize: Typography.title,
      color: palette.primary,
      fontWeight: '800',
      textAlign: 'center',
    },
    revealHint: {
      fontSize: Typography.body,
      color: palette.textSecondary,
    },
    eliminateGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    eliminateTile: {
      width: '47%',
      flexBasis: '47%',
      maxWidth: '47%',
      minWidth: '47%',
      flexGrow: 0,
      flexShrink: 0,
      backgroundColor: palette.background,
      borderRadius: 12,
      padding: Spacing.sm,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: 'center',
    },
    eliminateTileSelected: {
      borderColor: palette.primary,
      backgroundColor: palette.surface,
    },
    eliminateAvatarWrap: {
      position: 'relative',
    },
    eliminateAvatar: {
      width: 120,
      height: 120,
      borderRadius: 60,
    },
    eliminateAvatarFallback: {
      width: 120,
      height: 120,
      borderRadius: 60,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.border,
    },
    eliminateAvatarText: {
      fontSize: Typography.section,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    eliminateCross: {
      position: 'absolute',
      top: -8,
      left: -8,
      right: -8,
      bottom: -8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${palette.danger}B3`,
      borderRadius: 70,
    },
    eliminateName: {
      fontSize: Typography.body,
      color: palette.textPrimary,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: Spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 10,
      padding: Spacing.sm,
      color: palette.textPrimary,
      backgroundColor: palette.surface,
    },
    inputError: {
      fontSize: Typography.caption,
      color: palette.danger,
    },
    resultText: {
      fontSize: Typography.body,
      color: palette.textSecondary,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.md,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      gap: Spacing.sm,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: Typography.section,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    modalBody: {
      fontSize: Typography.body,
      color: palette.textSecondary,
      lineHeight: 22,
    },
    errorContainer: {
      flex: 1,
      backgroundColor: palette.background,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.md,
    },
    errorCard: {
      gap: Spacing.xs,
      width: '100%',
      maxWidth: 420,
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
      fontSize: Typography.body,
      color: palette.primary,
      fontWeight: '600',
    },
    errorSchema: {
      fontSize: Typography.caption,
      color: palette.textSecondary,
    },
    scoreList: {
      gap: Spacing.sm,
    },
    scoreRowFull: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      backgroundColor: palette.surface,
      padding: Spacing.sm,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    scoreAvatarWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      overflow: 'hidden',
      backgroundColor: palette.border,
    },
    scoreAvatar: {
      width: '100%',
      height: '100%',
    },
    scoreAvatarFallback: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.border,
    },
    scoreAvatarText: {
      fontSize: Typography.body,
      fontWeight: '800',
      color: palette.textPrimary,
    },
    scoreTextWrap: {
      flex: 1,
    },
    scoreLabel: {
      fontSize: Typography.body,
      color: palette.textPrimary,
      fontWeight: '700',
    },
    scoreMeta: {
      fontSize: Typography.label,
      color: palette.textSecondary,
    },
    scoreValue: {
      fontSize: Typography.title,
      fontWeight: '800',
      color: palette.textPrimary,
      minWidth: 32,
      textAlign: 'right',
    },
  });
