import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { Check, Plus, Search, X } from 'lucide-react-native';
import { useTrip } from '@/contexts/TripContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FloatingActions } from '@/components/FloatingActions';
import { Spacing, Typography } from '@/constants/tokens';
import type { Participant } from '@/types/trip';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TriviaItem = {
  id: number;
  question: string;
  answer: number;
  unit: string;
  category: string;
};

type Stage =
  | 'start'
  | 'pass-rader'
  | 'rader'
  | 'pass-kiezer'
  | 'kiezer'
  | 'result'
  | 'final'
  | 'error';

type ResultState = {
  guess: number;
  answer: number;
  choice: 'higher' | 'lower' | 'exact';
  outcome: 'kiezer' | 'rader' | 'exact' | 'rader-exact';
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

const TRIVIA_ASSET_RELATIVE = '../../assets/minigames/hoger-lager/higher_lower_trivia_500.json';
const TRIVIA_ASSET_PATH = '/assets/minigames/hoger-lager/higher_lower_trivia_500.json';
const TRIVIA_SCHEMA =
  '[{ "id": number, "question": string, "answer": number, "unit": string, "category": string }]';

export default function HigherLowerScreen() {
  const { participants } = useTrip();
  const { colors } = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const actionBarOffset = insets.top + 44;
  const contentPaddingBottom = Math.max(Spacing.lg + insets.bottom + 24, 240);
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
  const [scores, setScores] = useState<Record<string, number>>({});
  const [roleIndex, setRoleIndex] = useState(0);
  const [questions, setQuestions] = useState<TriviaItem[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [guessInput, setGuessInput] = useState('');
  const [guessValue, setGuessValue] = useState<number | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [guestPlayers, setGuestPlayers] = useState<GuestParticipant[]>([]);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);
  const [participantSearch, setParticipantSearch] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [guessSecondsInput, setGuessSecondsInput] = useState('15');
  const [choiceSecondsInput, setChoiceSecondsInput] = useState('10');
  const [targetScoreInput, setTargetScoreInput] = useState('10');
  const [targetScore, setTargetScore] = useState(10);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const guessInputRef = useRef(guessInput);

  const { items: triviaItems, error: triviaError } = useMemo(() => {
    let raw: unknown = null;
    try {
      raw = require(TRIVIA_ASSET_RELATIVE);
    } catch (err) {
      return { items: [] as TriviaItem[], error: 'Bestand ontbreekt of kan niet worden geladen.' };
    }

    const normalized = (raw as any)?.default ?? raw;
    return validateTrivia(normalized);
  }, []);

  const allParticipants = useMemo<SelectableParticipant[]>(
    () => [...participants, ...guestPlayers],
    [participants, guestPlayers]
  );
  const sortedParticipants = useMemo(
    () =>
      [...allParticipants].sort((a, b) =>
        a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' })
      ),
    [allParticipants]
  );
  const participantSearchQuery = participantSearch.trim().toLowerCase();
  const visibleParticipants = useMemo(() => {
    if (!participantSearchQuery) return sortedParticipants;
    return sortedParticipants.filter(person =>
      person.naam.toLowerCase().includes(participantSearchQuery)
    );
  }, [sortedParticipants, participantSearchQuery]);
  const activePlayers = players.length
    ? players
    : allParticipants.filter(p => selectedIds.includes(p.id));
  const rader = players.length ? players[roleIndex] : null;
  const kiezer = players.length ? players[(roleIndex + 1) % players.length] : null;
  const currentQuestion = questions[questionIndex] || null;
  const winner = winnerId ? players.find(person => person.id === winnerId) ?? null : null;
  const hasWinner = Boolean(winner);
  const winnerScore = winner ? scores[winner.id] ?? 0 : 0;

  const scoreboardLayout = useMemo(() => {
    const count = activePlayers.length;
    let avatarSize = 67;
    if (count <= 2) avatarSize = 96;
    else if (count === 3) avatarSize = 80;
    else if (count === 4) avatarSize = 72;
    const tileWidth = avatarSize + 24;
    const wrap = count > 3;
    const fontSize = Math.max(16, Math.round(avatarSize * 0.35));
    return { avatarSize, tileWidth, wrap, fontSize };
  }, [activePlayers.length]);

  const parseSeconds = (value: string, fallback: number) => {
    const parsed = Number(value.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.max(1, Math.round(parsed));
  };

  const parsePositiveInt = (value: string, fallback: number) => {
    const parsed = Number(value.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.max(1, Math.round(parsed));
  };

  const guessSeconds = parseSeconds(guessSecondsInput, 15);
  const choiceSeconds = parseSeconds(choiceSecondsInput, 10);
  const targetScoreDraft = parsePositiveInt(targetScoreInput, 10);
  const displayedTargetScore = stage === 'start' ? targetScoreDraft : targetScore;

  const canStart =
    selectedIds.length >= 2 && selectedIds.length <= 8 && triviaItems.length > 0 && targetScoreDraft > 0;
  const canToggleMore = selectedIds.length < 8;

  const determineWinner = (scoreboard: Record<string, number>) => {
    if (!players.length) return null;
    const ordered = players
      .map(person => ({ id: person.id, score: scoreboard[person.id] ?? 0 }))
      .sort((a, b) => b.score - a.score);

    const leader = ordered[0];
    const runnerUpScore = ordered[1]?.score ?? 0;
    const hasTieAtTop = ordered.length > 1 && leader.score === ordered[1].score;

    if (!leader) return null;
    if (hasTieAtTop) return null;
    if (leader.score < targetScore) return null;
    if (leader.score - runnerUpScore < 2) return null;
    return leader.id;
  };

  useEffect(() => {
    guessInputRef.current = guessInput;
  }, [guessInput]);

  if (triviaError) {
    return (
      <>
        <Stack.Screen options={{ title: 'Hoger of lager', headerShown: false }} />
        <View style={[styles.errorContainer, { paddingTop: actionBarOffset }]}>
          <Card style={styles.errorCard}>
            <Text style={styles.errorTitle}>Offline trivia ontbreekt of is ongeldig</Text>
            <Text style={styles.errorText}>
              Kon het lokale bestand niet laden of valideren. Controleer dit pad:
            </Text>
            <Text style={styles.errorPath}>{TRIVIA_ASSET_PATH}</Text>
            <Text style={styles.errorText}>Voorbeeld schema:</Text>
            <Text style={styles.errorSchema}>{TRIVIA_SCHEMA}</Text>
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
    const ids = sortedParticipants.map(person => person.id).slice(0, 8);
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
    clearTimer();
    setStage('start');
    setPlayers([]);
    setScores({});
    setRoleIndex(0);
    setQuestions([]);
    setQuestionIndex(0);
    setGuessInput('');
    setGuessValue(null);
    setResult(null);
    setInputError(null);
    setGuestError(null);
    setGuestName('');
    setWinnerId(null);
  };

  const startGame = () => {
    clearTimer();
    const selectedPlayers = allParticipants.filter(person => selectedIds.includes(person.id));
    const shuffledQuestions = shuffleArray(triviaItems);
    const initialScores: Record<string, number> = {};
    selectedPlayers.forEach(person => {
      initialScores[person.id] = 0;
    });
    setTargetScore(targetScoreDraft);
    setWinnerId(null);
    setPlayers(selectedPlayers);
    setScores(initialScores);
    setQuestions(shuffledQuestions);
    setQuestionIndex(0);
    setRoleIndex(0);
    setGuessInput('');
    setGuessValue(null);
    setResult(null);
    setInputError(null);
    setStage('pass-rader');
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const commitGuess = (value: number) => {
    clearTimer();
    setInputError(null);
    setGuessValue(value);
    setStage('pass-kiezer');
  };

  const confirmGuess = () => {
    Keyboard.dismiss();
    const normalized = guessInput.replace(',', '.').trim();
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      setInputError('Vul een geldig getal in.');
      return;
    }
    commitGuess(parsed);
  };

  const chooseAnswer = (choice: 'higher' | 'lower' | 'exact') => {
    clearTimer();
    if (!currentQuestion || guessValue === null || !rader || !kiezer) return;
    const answer = currentQuestion.answer;
    let outcome: ResultState['outcome'] = 'rader';

    if (choice === 'exact') {
      outcome = answer === guessValue ? 'exact' : 'rader';
    } else if (answer === guessValue) {
      outcome = 'rader-exact';
    } else if ((answer > guessValue && choice === 'higher') || (answer < guessValue && choice === 'lower')) {
      outcome = 'kiezer';
    }

    setScores(prev => {
      let updated = prev;
      if (outcome !== 'exact') {
        updated = { ...prev };
        const winnerId = outcome === 'kiezer' ? kiezer.id : rader.id;
        const points = outcome === 'rader-exact' ? 2 : 1;
        updated[winnerId] = (updated[winnerId] || 0) + points;
      }

      setWinnerId(determineWinner(updated));
      return outcome === 'exact' ? prev : updated;
    });

    setResult({
      guess: guessValue,
      answer,
      choice,
      outcome,
    });
    setStage('result');
  };

  const handleRaderTimeout = () => {
    Keyboard.dismiss();
    const normalized = guessInputRef.current.replace(',', '.').trim();
    const parsed = Number(normalized);
    const fallback = Number.isFinite(parsed) ? parsed : 0;
    commitGuess(fallback);
  };

  const handleKiezerTimeout = () => {
    if (!currentQuestion || guessValue === null || !rader || !kiezer) return;
    setScores(prev => {
      const updated = { ...prev };
      updated[rader.id] = (updated[rader.id] || 0) + 1;
      setWinnerId(determineWinner(updated));
      return updated;
    });
    setResult({
      guess: guessValue,
      answer: currentQuestion.answer,
      choice: 'lower',
      outcome: 'rader',
    });
    setStage('result');
  };

  useEffect(() => {
    clearTimer();
    if (stage === 'rader') {
      setTimeLeft(guessSeconds);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev === null) return prev;
          if (prev <= 1) {
            clearTimer();
            handleRaderTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }
    if (stage === 'kiezer') {
      setTimeLeft(choiceSeconds);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev === null) return prev;
          if (prev <= 1) {
            clearTimer();
            handleKiezerTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }
    setTimeLeft(null);
  }, [stage, guessSeconds, choiceSeconds]);

  useEffect(() => {
    return () => clearTimer();
  }, []);

  const nextRound = () => {
    clearTimer();
    if (winnerId) {
      setStage('final');
      return;
    }
    if (!players.length) return;
    const nextRole = (roleIndex + 1) % players.length;
    const nextQuestionIndex = questionIndex + 1;
    if (nextQuestionIndex >= questions.length) {
      setQuestions(shuffleArray(questions));
      setQuestionIndex(0);
    } else {
      setQuestionIndex(nextQuestionIndex);
    }
    setRoleIndex(nextRole);
    setGuessInput('');
    setGuessValue(null);
    setResult(null);
    setInputError(null);
    setStage('pass-rader');
  };

  const renderScoreboard = () => (
    <Card style={styles.scoreboardCard}>
      <Text style={styles.hintText}>
        Spelen tot {displayedTargetScore} punten, minimaal 2 punten verschil.
      </Text>
      {scoreboardLayout.wrap ? (
        <View style={[styles.scoreboardRow, styles.scoreboardRowWrap]}>
          {activePlayers.map(player => {
            const showFallback = player.isGuest || !player.avatar || imageErrors[player.id];
            const initials = player.naam
              .split(' ')
              .map(part => part[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();
            const avatarStyle = {
              width: scoreboardLayout.avatarSize,
              height: scoreboardLayout.avatarSize,
              borderRadius: scoreboardLayout.avatarSize / 2,
            };
            return (
              <View
                key={player.id}
                style={[styles.scoreboardPlayer, { width: scoreboardLayout.tileWidth }]}
              >
                {showFallback ? (
                  <View style={[styles.scoreboardAvatarFallback, avatarStyle]}>
                    <Text style={[styles.scoreboardAvatarText, { fontSize: scoreboardLayout.fontSize }]}>
                      {initials}
                    </Text>
                  </View>
                ) : (
                  <Image
                    source={player.avatar as Participant['avatar']}
                    style={[styles.scoreboardAvatar, avatarStyle]}
                    onError={() =>
                      setImageErrors(prev => ({
                        ...prev,
                        [player.id]: true,
                      }))
                    }
                  />
                )}
                <Text style={styles.scoreValue}>{scores[player.id] ?? 0}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.scoreboardRow}>
            {activePlayers.map(player => {
              const showFallback = player.isGuest || !player.avatar || imageErrors[player.id];
              const initials = player.naam
                .split(' ')
                .map(part => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              const avatarStyle = {
                width: scoreboardLayout.avatarSize,
                height: scoreboardLayout.avatarSize,
                borderRadius: scoreboardLayout.avatarSize / 2,
              };
              return (
                <View
                  key={player.id}
                  style={[styles.scoreboardPlayer, { width: scoreboardLayout.tileWidth }]}
                >
                  {showFallback ? (
                    <View style={[styles.scoreboardAvatarFallback, avatarStyle]}>
                      <Text style={[styles.scoreboardAvatarText, { fontSize: scoreboardLayout.fontSize }]}>
                        {initials}
                      </Text>
                    </View>
                ) : (
                  <Image
                      source={player.avatar as Participant['avatar']}
                      style={[styles.scoreboardAvatar, avatarStyle]}
                      onError={() =>
                        setImageErrors(prev => ({
                          ...prev,
                          [player.id]: true,
                        }))
                      }
                    />
                  )}
                  <Text style={styles.scoreValue}>{scores[player.id] ?? 0}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </Card>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Hoger of lager', headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <Animated.ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.content,
            { paddingTop: actionBarOffset, paddingBottom: contentPaddingBottom, flexGrow: 1 },
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
                <Text style={styles.title}>Hoger of lager</Text>
                <TouchableOpacity onPress={() => setShowRules(true)}>
                  <Text style={styles.rulesLink}>Spelregels bekijken</Text>
                </TouchableOpacity>
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
                <View style={styles.searchRow}>
                  <View style={styles.searchInputWrap}>
                    <Search size={15} color={colors.textSecondary} />
                    <TextInput
                      value={participantSearch}
                      onChangeText={setParticipantSearch}
                      placeholder="Zoek deelnemer"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.searchInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {participantSearch.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setParticipantSearch('')}
                        style={styles.searchClearButton}
                        activeOpacity={0.8}
                      >
                        <X size={14} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <Text style={styles.hintText}>Kies 2 tot 8 spelers.</Text>
                {participantSearchQuery.length > 0 && visibleParticipants.length === 0 && (
                  <Text style={styles.searchEmptyText}>Geen deelnemers gevonden.</Text>
                )}
                <View style={styles.participantGrid}>
                  {visibleParticipants.map(person => {
                    const selected = selectedIds.includes(person.id);
                    const disabled = !selected && !canToggleMore;
                    const showFallback = person.isGuest || !person.avatar || imageErrors[person.id];
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

              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Spelinstellingen</Text>
                <View style={styles.timeField}>
                  <Text style={styles.timeLabel}>Spelen tot (punten)</Text>
                  <TextInput
                    style={[styles.input, styles.timeInput]}
                    keyboardType="numeric"
                    value={targetScoreInput}
                    onChangeText={setTargetScoreInput}
                  />
                  <Text style={styles.hintText}>Win met minstens 2 punten verschil.</Text>
                </View>
                <View style={styles.timeRow}>
                  <View style={styles.timeField}>
                    <Text style={styles.timeLabel}>Schatten (sec)</Text>
                    <TextInput
                      style={[styles.input, styles.timeInput]}
                      keyboardType="numeric"
                      value={guessSecondsInput}
                      onChangeText={setGuessSecondsInput}
                    />
                  </View>
                  <View style={styles.timeField}>
                    <Text style={styles.timeLabel}>Hoger/Lager (sec)</Text>
                    <TextInput
                      style={[styles.input, styles.timeInput]}
                      keyboardType="numeric"
                      value={choiceSecondsInput}
                      onChangeText={setChoiceSecondsInput}
                    />
                  </View>
                </View>
              </Card>

              <Button label="Start spel" onPress={startGame} disabled={!canStart} />
            </>
          )}

        {stage === 'pass-rader' && rader && (
          <Card style={styles.stageCard}>
            <Text style={styles.stageTitle}>Geef door</Text>
            <Text style={styles.stageBody}>Geef de telefoon aan: {rader.naam}</Text>
            <Button label="Ik ben er klaar voor" onPress={() => setStage('rader')} />
          </Card>
        )}

        {stage === 'rader' && currentQuestion && rader && (
          <Card style={styles.stageCard}>
            <Text style={styles.stageTitle}>Vraag voor {rader.naam}</Text>
            {timeLeft !== null && (
              <View style={styles.timerWrap}>
                <Text style={styles.timerLabel}>Tijd voor schatting</Text>
                <Text style={[styles.timerValue, timeLeft <= 3 && styles.timerValueUrgent]}>
                  {timeLeft}
                </Text>
              </View>
            )}
            <Text style={styles.questionText}>{currentQuestion.question}</Text>
            <Text style={styles.metricText}>Metric: {currentQuestion.unit || 'n.v.t.'}</Text>
            <TextInput
              style={styles.input}
              placeholder="Jouw schatting"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              autoFocus
              value={guessInput}
              onChangeText={setGuessInput}
            />
            {inputError ? <Text style={styles.inputError}>{inputError}</Text> : null}
            <Button label="Bevestig schatting" onPress={confirmGuess} />
          </Card>
        )}

        {stage === 'pass-kiezer' && kiezer && (
          <Card style={styles.stageCard}>
            <Text style={styles.stageTitle}>Geef door</Text>
            <Text style={styles.stageBody}>Geef de telefoon aan: {kiezer.naam}</Text>
            <Button label="Ik ben er klaar voor" onPress={() => setStage('kiezer')} />
          </Card>
        )}

        {stage === 'kiezer' && currentQuestion && rader && kiezer && (
          <Card style={styles.stageCard}>
            <Text style={styles.stageTitle}>Kies hoger, lager of exact</Text>
            {timeLeft !== null && (
              <View style={styles.timerWrap}>
                <Text style={styles.timerLabel}>Tijd om te kiezen</Text>
                <Text style={[styles.timerValue, timeLeft <= 2 && styles.timerValueUrgent]}>
                  {timeLeft}
                </Text>
              </View>
            )}
            <Text style={styles.questionText}>{currentQuestion.question}</Text>
            <Text style={styles.metricText}>Metric: {currentQuestion.unit || 'n.v.t.'}</Text>
            <Text style={styles.guessText}>
              Schatting van {rader.naam}: {guessValue}
            </Text>
            <View style={styles.choiceRow}>
              <View style={[styles.choiceSlot, styles.choiceSlotLeft]}>
                <Button label="Lager" onPress={() => chooseAnswer('lower')} variant="secondary" style={styles.choiceButton} />
              </View>
              <View style={[styles.choiceSlot, styles.choiceSlotCenter]}>
                <Button label="Gelijk" onPress={() => chooseAnswer('exact')} variant="secondary" style={styles.choiceButton} />
              </View>
              <View style={[styles.choiceSlot, styles.choiceSlotRight]}>
                <Button label="Hoger" onPress={() => chooseAnswer('higher')} style={styles.choiceButton} />
              </View>
            </View>
          </Card>
        )}

        {stage === 'result' && result && currentQuestion && rader && kiezer && (
          <Card style={styles.stageCard}>
            <Text style={styles.stageTitle}>Uitslag</Text>
            <Text style={styles.resultAnswer}>
              Het echte antwoord: {result.answer} {currentQuestion.unit}
            </Text>
            {result.outcome === 'exact' ? (
              <Text style={styles.resultText}>
                Exact goed geraden! Niemand krijgt een punt.
              </Text>
            ) : result.outcome === 'rader-exact' ? (
              <Text style={styles.resultText}>
                Exact goed geschat. 2 punten voor {rader.naam}.
              </Text>
            ) : result.outcome === 'kiezer' ? (
              <Text style={styles.resultText}>
                Goed gekozen! Punt voor {kiezer.naam}.
              </Text>
            ) : (
              <Text style={styles.resultText}>
                Fout gekozen. Punt voor {rader.naam}.
              </Text>
            )}
            {hasWinner && winner ? (
              <Text style={styles.resultText}>
                {winner.naam} staat op {winnerScore} punten en wint met minimaal 2 punten verschil.
              </Text>
            ) : null}
            <View style={styles.resultActions}>
              <Button
                label={hasWinner ? 'Eindscore bekijken' : 'Volgende ronde'}
                onPress={hasWinner ? () => setStage('final') : nextRound}
              />
              <TouchableOpacity onPress={() => setStage('final')}>
                <Text style={styles.stopLink}>Stop spel</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {stage === 'final' && (
          <Card style={styles.stageCard}>
            <Text style={styles.stageTitle}>Eindscore</Text>
            {winner ? (
              <Text style={styles.stageBody}>
                {winner.naam} wint met {winnerScore} punten en minimaal 2 punten verschil.
              </Text>
            ) : (
              <Text style={styles.stageBody}>Goed gespeeld. Nog een ronde?</Text>
            )}
            <Button label="Nieuw spel" onPress={resetGame} />
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
              Dit spel werkt zonder internet en gebruikt een offline trivia-pack. Handig in het vliegtuig.
            </Text>
            <Text style={styles.modalBody}>
              1. Rader krijgt de vraag en vult een schatting in.
            </Text>
            <Text style={styles.modalBody}>
              2. Rader heeft {guessSeconds} seconden voor de schatting.
            </Text>
            <Text style={styles.modalBody}>
              3. Kiezer kiest hoger, lager of exact ({choiceSeconds} seconden).
            </Text>
            <Text style={styles.modalBody}>
              4. Score: Kiezer goed = Kiezer +1 punt. Kiezer fout = Rader +1 punt.
            </Text>
            <Text style={styles.modalBody}>
              5. Exact gekozen en gelijk? Niemand krijgt een punt.
            </Text>
            <Text style={styles.modalBody}>
              6. Kiezer kiest hoger/lager maar schatting is exact? Rader +2 punten.
            </Text>
            <Text style={styles.modalBody}>
              7. Spel klaar bij {displayedTargetScore} punten met 2 punten voorsprong.
            </Text>
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
    </>
  );
}

function validateTrivia(raw: unknown): { items: TriviaItem[]; error?: string } {
  if (!Array.isArray(raw)) {
    return { items: [], error: 'Bestand is geen array.' };
  }

  const invalid = raw.find(item => {
    if (!item || typeof item !== 'object') return true;
    const record = item as Record<string, unknown>;
    const question = record.question;
    const answer = record.answer;
    const unit = record.unit;
    const category = record.category;
    const id = record.id;

    return (
      typeof id !== 'number' ||
      typeof question !== 'string' ||
      question.trim().length === 0 ||
      typeof answer !== 'number' ||
      !Number.isFinite(answer) ||
      typeof unit !== 'string' ||
      typeof category !== 'string'
    );
  });

  if (invalid) {
    return { items: [], error: 'Bestand bevat ongeldige items.' };
  }

  return { items: raw as TriviaItem[] };
}

function shuffleArray<T>(input: T[]): T[] {
  const array = [...input];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
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
    pitch: {
      fontSize: Typography.body,
      color: palette.textSecondary,
      lineHeight: 22,
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
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    searchRow: {
      marginTop: 2,
    },
    searchInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: palette.background,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: palette.textPrimary,
      paddingVertical: 0,
    },
    searchClearButton: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchEmptyText: {
      fontSize: Typography.label,
      color: palette.textSecondary,
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
    scoreboardCard: {
      gap: Spacing.xs,
    },
    scoreboardRow: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gap: Spacing.sm,
    },
    scoreboardRowWrap: {
      flexWrap: 'wrap',
    },
    scoreboardPlayer: {
      alignItems: 'center',
      gap: Spacing.xs,
      width: 92,
    },
    scoreboardAvatar: {
      width: 67,
      height: 67,
      borderRadius: 34,
      borderWidth: 2,
      borderColor: palette.border,
    },
    scoreboardAvatarFallback: {
      width: 67,
      height: 67,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.border,
    },
    scoreboardAvatarText: {
      fontSize: Typography.title,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    scoreValue: {
      fontSize: Typography.section,
      color: palette.primary,
      fontWeight: '700',
    },
    stageCard: {
      gap: Spacing.sm,
    },
    stageTitle: {
      fontSize: Typography.section,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    timeRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    timeField: {
      flex: 1,
      gap: Spacing.xs,
    },
    timeLabel: {
      fontSize: Typography.label,
      color: palette.textSecondary,
      fontWeight: '600',
    },
    timeInput: {
      textAlign: 'center',
    },
    timerWrap: {
      alignItems: 'center',
      paddingVertical: Spacing.xs,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.danger,
      backgroundColor: `${palette.danger}12`,
    },
    timerLabel: {
      fontSize: Typography.label,
      color: palette.danger,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1.4,
    },
    timerValue: {
      fontSize: 36,
      fontWeight: '900',
      color: palette.danger,
    },
    timerValueUrgent: {
      color: palette.textPrimary,
      backgroundColor: palette.danger,
      paddingHorizontal: Spacing.sm,
      borderRadius: 12,
      overflow: 'hidden',
    },
    stageBody: {
      fontSize: Typography.body,
      color: palette.textSecondary,
    },
    questionText: {
      fontSize: Typography.body,
      color: palette.textPrimary,
      lineHeight: 22,
    },
    guessText: {
      fontSize: Typography.body,
      color: palette.textSecondary,
    },
    metricText: {
      fontSize: Typography.label,
      color: palette.textSecondary,
    },
    choiceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    choiceSlot: {
      flex: 1,
    },
    choiceSlotLeft: {
      alignItems: 'flex-start',
    },
    choiceSlotCenter: {
      alignItems: 'center',
    },
    choiceSlotRight: {
      alignItems: 'flex-end',
    },
    choiceButton: {
      minWidth: 110,
    },
    resultAnswer: {
      fontSize: Typography.body,
      color: palette.textPrimary,
      fontWeight: '600',
    },
    resultText: {
      fontSize: Typography.body,
      color: palette.textSecondary,
    },
    resultActions: {
      gap: Spacing.xs,
    },
    stopLink: {
      fontSize: Typography.label,
      color: palette.danger,
      fontWeight: '700',
      textAlign: 'center',
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
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.md,
    },
    modalCard: {
      width: '100%',
      maxWidth: 380,
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
  });
