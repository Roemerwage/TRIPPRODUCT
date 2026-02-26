import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Animated,
  Image,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { Check, Plus, X } from 'lucide-react-native';
import { useTrip } from '@/contexts/TripContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HoldToReveal } from '@/components/HoldToReveal';
import { PlayerCard } from '@/components/PlayerCard';
import { StatementChoiceCard } from '@/components/StatementChoiceCard';
import { FloatingActions } from '@/components/FloatingActions';
import { Spacing, Typography } from '@/constants/tokens';
import type { GameState, Player, Statement } from '@/game/engine';
import { createRound, rotateSorter } from '@/game/engine';
import type { Participant } from '@/types/trip';

type Action =
  | { type: 'START_GAME'; players: Player[]; orderedPlayerIds: string[] }
  | { type: 'CREATE_ROUND' }
  | { type: 'SET_ORDER'; orderedPlayerIds: string[] }
  | { type: 'FINISH_SORTING' }
  | { type: 'SET_GROUP_CHOICE'; statementId: string }
  | { type: 'CONFIRM_GROUP_CHOICE' }
  | { type: 'NEXT_ROUND' };

type IdGameScreenProps = {
  statementsSeed?: Statement[];
};

const STATEMENTS_ASSET_RELATIVE = '../assets/minigames/id-spel/statements.json';
const STATEMENTS_ASSET_PATH = '/assets/minigames/id-spel/statements.json';
const STATEMENTS_SCHEMA = '[{ "id": string, "text": string }]';
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const initGameState = (statements: Statement[]): GameState => ({
  players: [],
  statementsPool: statements,
  usedStatementIds: [],
  roundNumber: 0,
  sorterIndex: 0,
  phase: 'SORTING',
  currentStatementId: '',
  choiceStatementIds: [],
  orderedPlayerIds: [],
  groupChoiceStatementId: null,
  isCorrect: null,
});

const reducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    case 'START_GAME': {
      const base = {
        ...state,
        players: action.players,
        roundNumber: 1,
        sorterIndex: 0,
        usedStatementIds: [],
        orderedPlayerIds: action.orderedPlayerIds,
      };
      return createRound(base);
    }
    case 'CREATE_ROUND':
      return createRound(state);
    case 'SET_ORDER':
      return { ...state, orderedPlayerIds: action.orderedPlayerIds };
    case 'FINISH_SORTING':
      return { ...state, phase: 'CHOOSING' };
    case 'SET_GROUP_CHOICE':
      return { ...state, groupChoiceStatementId: action.statementId };
    case 'CONFIRM_GROUP_CHOICE': {
      if (!state.groupChoiceStatementId || !state.currentStatementId) return state;
      return {
        ...state,
        isCorrect: state.groupChoiceStatementId === state.currentStatementId,
        phase: 'REVEAL',
      };
    }
    case 'NEXT_ROUND': {
      const rotated = rotateSorter({ ...state, roundNumber: state.roundNumber + 1 });
      return createRound(rotated);
    }
    default:
      return state;
  }
};

export default function IdGameScreen({ statementsSeed }: IdGameScreenProps) {
  const { participants } = useTrip();
  const insets = useSafeAreaInsets();
  const { colors } = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  const [started, setStarted] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [compareVisible, setCompareVisible] = useState(false);
  const [guestPlayers, setGuestPlayers] = useState<GuestPlayer[]>([]);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);
  const [selectionTouched, setSelectionTouched] = useState(false);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragStartIndex = useRef<number | null>(null);
  const skipPulse = useRef(new Animated.Value(0)).current;
  const ORDER_ROW_HEIGHT = 62;

  const { items: statements, error: statementsError } = useMemo(() => {
    if (statementsSeed) return { items: statementsSeed, error: undefined };
    let raw: unknown = null;
    try {
      raw = require(STATEMENTS_ASSET_RELATIVE);
    } catch (err) {
      return { items: [] as Statement[], error: 'Stellingenbestand kon niet worden geladen.' };
    }
    const normalized = (raw as any)?.default ?? raw;
    return validateStatements(normalized);
  }, [statementsSeed]);

  const [state, dispatch] = useReducer(reducer, statements, initGameState);

  const crew = useMemo(() => [...participants, ...guestPlayers], [participants, guestPlayers]);
  const crewPlayers = useMemo(() => crew.map(mapPersonToPlayer), [crew]);

  useEffect(() => {
    if (selectionTouched || started) return;
    setSelectedIds(crew.map(person => person.id));
  }, [crew, selectionTouched, started]);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);
  const playerMap = useMemo(() => new Map(state.players.map(player => [player.id, player])), [state.players]);
  const statementMap = useMemo(
    () => new Map(state.statementsPool.map(statement => [statement.id, statement])),
    [state.statementsPool]
  );

  const currentStatement = statementMap.get(state.currentStatementId) ?? null;
  const orderedPlayers = state.orderedPlayerIds
    .map(id => playerMap.get(id))
    .filter(Boolean) as Player[];
  const choiceStatements = state.choiceStatementIds
    .map(id => statementMap.get(id))
    .filter(Boolean) as Statement[];
  const groupChoice = state.groupChoiceStatementId
    ? statementMap.get(state.groupChoiceStatementId) ?? null
    : null;

  const splitIndex = Math.ceil(orderedPlayers.length / 2);
  const leftColumnPlayers = orderedPlayers.slice(0, splitIndex);
  const rightColumnPlayers = orderedPlayers.slice(splitIndex);

  const hasStatements = statements.length >= 10;
  const hasPlayers = selectedIds.length >= 2;
  const canStart = hasStatements && hasPlayers && !statementsError;

  const startGame = () => {
    if (!canStart) return;
    const selectedPlayers = crewPlayers.filter(player => selectedIds.includes(player.id));
    const initialOrder = selectedPlayers.map(player => player.id);
    dispatch({
      type: 'START_GAME',
      players: selectedPlayers,
      orderedPlayerIds: initialOrder,
    });
    setStarted(true);
  };

  const resetGame = () => {
    setStarted(false);
  };

  const handleNewStatement = () => {
    dispatch({ type: 'CREATE_ROUND' });
    skipPulse.setValue(0);
    Animated.sequence([
      Animated.timing(skipPulse, {
        toValue: 1,
        duration: 140,
        useNativeDriver: false,
      }),
      Animated.delay(600),
      Animated.timing(skipPulse, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const toggleSelection = (id: string) => {
    setSelectionTouched(true);
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      }
      return [...prev, id];
    });
  };

  const selectAll = () => {
    setSelectionTouched(true);
    setSelectedIds(crew.map(person => person.id));
  };

  const clearSelection = () => {
    setSelectionTouched(true);
    setSelectedIds([]);
  };

  const addGuest = () => {
    const trimmed = guestName.trim();
    if (!trimmed) {
      setGuestError('Vul een naam in.');
      return;
    }
    const normalized = trimmed.toLowerCase();
    const nameTaken = crew.some(person => person.naam.toLowerCase() === normalized);
    if (nameTaken) {
      setGuestError('Naam bestaat al.');
      return;
    }
    const newGuest: GuestPlayer = {
      id: `guest-${Date.now()}`,
      naam: trimmed,
      isGuest: true,
    };
    setGuestPlayers(prev => [...prev, newGuest]);
    setSelectedIds(prev => [...prev, newGuest.id]);
    setGuestName('');
    setGuestError(null);
    setShowGuestModal(false);
  };

  const moveOrderToIndex = (ids: string[], id: string, targetIndex: number) => {
    const index = ids.indexOf(id);
    if (index === -1 || index === targetIndex) return ids;
    const updated = [...ids];
    updated.splice(index, 1);
    updated.splice(targetIndex, 0, id);
    return updated;
  };

  const errorMessage = statementsError
    ? {
        title: 'Stellingenbestand ontbreekt',
        body: statementsError,
        path: STATEMENTS_ASSET_PATH,
        schema: STATEMENTS_SCHEMA,
      }
    : !hasStatements
      ? {
          title: 'Te weinig stellingen',
          body: 'Voeg minstens 10 stellingen toe.',
          path: STATEMENTS_ASSET_PATH,
          schema: STATEMENTS_SCHEMA,
        }
      : null;

  return (
    <>
      <Stack.Screen options={{ title: 'ID-spel', headerShown: false }} />
      <Animated.ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: actionBarOffset }]}
        scrollEnabled={!draggingId}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {!started && (
          <>
            <Card style={styles.introCard}>
              <Text style={styles.title}>ID-spel</Text>
              <Text style={styles.subtitle}>Orden de spelers en raad samen de juiste stelling.</Text>
              <Text style={styles.bodyText}>
                Een speler ziet de stelling via een hold-to-reveal knop. De groep kiest daarna
                samen welke stelling echt was. De ordenaar kan een stelling overslaan via
                "Nieuwe stelling".
              </Text>
            </Card>

            {errorMessage ? (
              <Card style={styles.errorCard}>
                <Text style={styles.errorTitle}>{errorMessage.title}</Text>
                <Text style={styles.errorText}>{errorMessage.body}</Text>
                <Text style={styles.errorPath}>{errorMessage.path}</Text>
                <Text style={styles.errorSchema}>{errorMessage.schema}</Text>
              </Card>
            ) : (
              <>
                <Card style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Kaartjes kiezen</Text>
                    <View style={styles.sectionActions}>
                      <TouchableOpacity style={styles.linkButton} onPress={selectAll}>
                        <Text style={styles.linkButtonText}>Selecteer alles</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.linkButton} onPress={clearSelection}>
                        <Text style={styles.linkButtonText}>Wis selectie</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.hintText}>Kies minimaal 2 spelers uit de crew.</Text>
                  <View style={styles.participantGrid}>
                    {crew.map(person => {
                      const selected = selectedIds.includes(person.id);
                      const avatarSource = 'avatar' in person ? person.avatar : undefined;
                      const showFallback = imageErrors[person.id] || !avatarSource;
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
                          ]}
                          onPress={() => toggleSelection(person.id)}
                          activeOpacity={0.85}
                        >
                          <View style={[styles.avatarWrap, selected && styles.avatarWrapSelected]}>
                            {showFallback ? (
                              <View style={styles.avatarFallback}>
                                <Text style={styles.avatarFallbackText}>{initials}</Text>
                              </View>
                            ) : (
                              <Image
                                source={avatarSource}
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

              </>
            )}

            <Button label="Start spel" onPress={startGame} disabled={!canStart} />
          </>
        )}

        {started && (
          <>
            {state.phase === 'SORTING' && (
              <>
                <Card style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Stelling (verborgen)</Text>
                    <AnimatedTouchableOpacity
                      style={[
                        styles.tinyGhostButton,
                        {
                          backgroundColor: skipPulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [colors.surface, '#d1f5e3'],
                          }),
                          borderColor: skipPulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [colors.border, colors.success],
                          }),
                        },
                      ]}
                      onPress={handleNewStatement}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.tinyGhostButtonText}>Nieuwe stelling</Text>
                    </AnimatedTouchableOpacity>
                  </View>
                  <HoldToReveal>
                    <Text style={styles.statementText}>
                      {currentStatement?.text ?? 'Stelling wordt geladen...'}
                    </Text>
                  </HoldToReveal>
                </Card>

                <Card style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Ordenen van meest passend naar minst passend</Text>
                  <View style={styles.orderedList}>
                    {orderedPlayers.map((player, index) => {
                      const isDragging = draggingId === player.id;
                      const panResponder = PanResponder.create({
                        onStartShouldSetPanResponder: () => true,
                        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
                        onPanResponderGrant: () => {
                          setDraggingId(player.id);
                          dragStartIndex.current = index;
                          dragY.setValue(0);
                        },
                        onPanResponderMove: (_, gesture) => {
                          dragY.setValue(gesture.dy);
                          const from = dragStartIndex.current ?? index;
                          const delta = Math.round(gesture.dy / ORDER_ROW_HEIGHT);
                          const target = Math.max(0, Math.min(orderedPlayers.length - 1, from + delta));
                          if (target !== from) {
                            LayoutAnimation.configureNext({
                              duration: 380,
                              update: {
                                type: LayoutAnimation.Types.easeInEaseOut,
                              },
                              create: {
                                type: LayoutAnimation.Types.easeInEaseOut,
                                property: LayoutAnimation.Properties.opacity,
                              },
                              delete: {
                                type: LayoutAnimation.Types.easeInEaseOut,
                                property: LayoutAnimation.Properties.opacity,
                              },
                            });
                            const updated = moveOrderToIndex(state.orderedPlayerIds, player.id, target);
                            dispatch({ type: 'SET_ORDER', orderedPlayerIds: updated });
                            dragStartIndex.current = target;
                          }
                        },
                        onPanResponderRelease: (_, gesture) => {
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
                              key={player.id}
                              style={[
                                styles.orderRow,
                                isDragging && styles.orderRowDragging,
                                isDragging && { transform: [{ translateY: dragY }] },
                              ]}
                              {...panResponder.panHandlers}
                            >
                          <PlayerCard player={player} rank={index + 1} compact dense />
                        </Animated.View>
                      );
                    })}
                  </View>
                </Card>

                <View style={styles.buttonRow}>
                  <Button label="Klaar met ordenen" onPress={() => dispatch({ type: 'FINISH_SORTING' })} />
                </View>
              </>
            )}

            {state.phase === 'CHOOSING' && (
              <>
                <Card style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Geordende spelers</Text>
                  <View style={styles.playerColumns}>
                    <View style={styles.playerColumn}>
                      {leftColumnPlayers.map((player, index) => (
                        <PlayerCard
                          key={player.id}
                          player={player}
                          rank={index + 1}
                          showAvatar={false}
                          dense
                          compact
                          style={styles.compactPlayerCard}
                        />
                      ))}
                    </View>
                    <View style={styles.playerColumn}>
                      {rightColumnPlayers.map((player, index) => (
                        <PlayerCard
                          key={player.id}
                          player={player}
                          rank={splitIndex + index + 1}
                          showAvatar={false}
                          dense
                          compact
                          style={styles.compactPlayerCard}
                        />
                      ))}
                    </View>
                  </View>
                </Card>

                <Card style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Kies de juiste stelling</Text>
                  <View style={styles.choiceGrid}>
                    {choiceStatements.map(statement => (
                      <View key={statement.id} style={styles.choiceRow}>
                        <StatementChoiceCard
                          statement={statement}
                          selected={statement.id === state.groupChoiceStatementId}
                          onPress={() => dispatch({ type: 'SET_GROUP_CHOICE', statementId: statement.id })}
                          compact
                          style={styles.choiceCard}
                        />
                        {statement.id === state.groupChoiceStatementId ? (
                          <TouchableOpacity
                            style={styles.compareButton}
                            onPress={() => setCompareVisible(true)}
                          >
                            <Text style={styles.compareButtonText}>Vergelijk</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ))}
                  </View>
                  <Button
                    label="Bevestig keuze"
                    onPress={() => dispatch({ type: 'CONFIRM_GROUP_CHOICE' })}
                    disabled={!state.groupChoiceStatementId}
                  />
                </Card>
              </>
            )}

            {state.phase === 'REVEAL' && (
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Reveal</Text>
                <Text style={styles.revealStatement}>
                  Echte stelling: {currentStatement?.text ?? 'Onbekend'}
                </Text>
                <Text style={styles.revealChoice}>
                  Jullie keuze: {groupChoice?.text ?? 'Geen keuze'}
                </Text>
                <Text style={[styles.revealResult, state.isCorrect ? styles.revealCorrect : styles.revealWrong]}>
                  {state.isCorrect ? 'Correct!' : 'Helaas fout'}
                </Text>
                <Button label="Nieuwe stelling" onPress={handleNewStatement} />
                <TouchableOpacity onPress={resetGame}>
                  <Text style={styles.secondaryLink}>Stop spel</Text>
                </TouchableOpacity>
              </Card>
            )}
          </>
        )}
      </Animated.ScrollView>
      <FloatingActions
        showSettings={false}
        showLifeBuoy={false}
        animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
      />

      <Modal
        visible={compareVisible && state.phase === 'CHOOSING'}
        animationType="slide"
        onRequestClose={() => setCompareVisible(false)}
      >
        <View style={[styles.compareScreen, { paddingTop: insets.top + Spacing.sm }]}>
          <Text style={styles.compareTitle}>Vergelijk</Text>
          <Text style={styles.compareStatement}>
            {groupChoice?.text ?? 'Kies een stelling om te vergelijken.'}
          </Text>
          <ScrollView contentContainerStyle={styles.compareList}>
            {orderedPlayers.map((player, index) => {
              const showFallback = imageErrors[player.id] || (!player.avatarUrl && !player.avatarSource);
              const initials = player.displayName
                .split(' ')
                .map(part => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              return (
                <View key={player.id} style={styles.compareRow}>
                  <View style={styles.compareRank}>
                    <Text style={styles.compareRankText}>{index + 1}</Text>
                  </View>
                  {showFallback ? (
                    <View style={styles.compareAvatarFallback}>
                      <Text style={styles.compareAvatarText}>{initials}</Text>
                    </View>
                  ) : (
                    <Image
                      source={player.avatarSource ?? { uri: player.avatarUrl ?? '' }}
                      style={styles.compareAvatar}
                      onError={() =>
                        setImageErrors(prev => ({
                          ...prev,
                          [player.id]: true,
                        }))
                      }
                    />
                  )}
                  <Text style={styles.compareName}>{player.displayName}</Text>
                </View>
              );
            })}
          </ScrollView>
          <View style={styles.compareActions}>
            <Button label="Terug" variant="secondary" onPress={() => setCompareVisible(false)} />
            <Button
              label="Bevestig keuze"
              onPress={() => {
                dispatch({ type: 'CONFIRM_GROUP_CHOICE' });
                setCompareVisible(false);
              }}
              disabled={!state.groupChoiceStatementId}
            />
          </View>
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

function validateStatements(raw: unknown): { items: Statement[]; error?: string } {
  if (!Array.isArray(raw)) {
    return { items: [], error: 'Stellingenbestand is geen lijst.' };
  }
  const invalid = raw.find(item => {
    if (!item || typeof item !== 'object') return true;
    const record = item as Record<string, unknown>;
    return typeof record.id !== 'string' || typeof record.text !== 'string' || record.text.trim().length === 0;
  });
  if (invalid) {
    return { items: [], error: 'Stellingenbestand bevat ongeldige items.' };
  }
  return { items: raw as Statement[] };
}

type GuestPlayer = {
  id: string;
  naam: string;
  isGuest: true;
};

type SelectablePerson = Participant | GuestPlayer;

function mapPersonToPlayer(person: SelectablePerson): Player {
  return {
    id: person.id,
    displayName: person.naam,
    avatarSource: 'avatar' in person ? person.avatar : undefined,
  };
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
    bodyText: {
      fontSize: Typography.body,
      color: palette.textSecondary,
      lineHeight: 22,
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
    statementText: {
      fontSize: Typography.body,
      color: palette.textPrimary,
      textAlign: 'center',
    },
    buttonRow: {
      gap: Spacing.xs,
      alignItems: 'center',
    },
    secondaryLink: {
      fontSize: Typography.label,
      color: palette.primary,
      fontWeight: '700',
      textAlign: 'center',
    },
    tinyGhostButton: {
      paddingVertical: 6,
      paddingHorizontal: Spacing.sm,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    tinyGhostButtonText: {
      fontSize: Typography.label,
      fontWeight: '700',
      color: palette.primary,
    },
    orderedList: {
      gap: Spacing.xs,
    },
    playerColumns: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    playerColumn: {
      flex: 1,
      gap: Spacing.xs,
    },
    compactPlayerCard: {
      width: '100%',
    },
    orderRow: {
      borderRadius: 10,
      minHeight: 62,
    },
    orderRowDragging: {
      borderWidth: 1,
      borderColor: palette.primary,
      backgroundColor: palette.surface,
      shadowColor: palette.primary,
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 10,
      elevation: 3,
      zIndex: 5,
    },
    choiceGrid: {
      gap: Spacing.xs,
    },
    choiceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    choiceCard: {
      flex: 1,
    },
    compareButton: {
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.primary,
      backgroundColor: palette.surface,
    },
    compareButtonText: {
      fontSize: Typography.label,
      fontWeight: '700',
      color: palette.primary,
    },
    compareScreen: {
      flex: 1,
      backgroundColor: palette.background,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    compareTitle: {
      fontSize: Typography.section,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    compareStatement: {
      fontSize: Typography.title,
      fontWeight: '700',
      color: palette.textPrimary,
      lineHeight: 28,
    },
    compareList: {
      gap: 4,
      paddingBottom: Spacing.sm,
    },
    compareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
    },
    compareRank: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: palette.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compareRankText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: Typography.body,
    },
    compareAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
    },
    compareAvatarFallback: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.border,
    },
    compareAvatarText: {
      fontSize: Typography.body,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    compareName: {
      flex: 1,
      fontSize: Typography.section,
      color: palette.textPrimary,
      fontWeight: '600',
    },
    compareActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      justifyContent: 'space-between',
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
    revealStatement: {
      fontSize: Typography.body,
      color: palette.textPrimary,
      fontWeight: '600',
    },
    revealChoice: {
      fontSize: Typography.body,
      color: palette.textSecondary,
    },
    revealResult: {
      fontSize: Typography.section,
      fontWeight: '700',
      textAlign: 'center',
    },
    revealCorrect: {
      color: palette.success,
    },
    revealWrong: {
      color: palette.danger,
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
      fontSize: Typography.body,
      color: palette.primary,
      fontWeight: '600',
    },
    errorSchema: {
      fontSize: Typography.caption,
      color: palette.textSecondary,
    },
  });
