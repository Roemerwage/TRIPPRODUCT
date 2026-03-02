import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
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
import { Check, Plus, Search, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTrip } from '@/contexts/TripContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FloatingActions } from '@/components/FloatingActions';
import { Spacing, Typography } from '@/constants/tokens';
import type { Participant } from '@/types/trip';

const MIN_PLAYERS = 3;
const MIN_TEAMS = 2;
const MAX_TEAMS = 5;

type SelectableParticipant = Omit<Participant, 'avatar'> & {
  avatar?: Participant['avatar'];
  isGuest?: boolean;
};

type GuestParticipant = SelectableParticipant & {
  id: string;
  naam: string;
  isGuest: true;
};

type Team = {
  id: number;
  members: SelectableParticipant[];
};

export default function TeamDividerScreen() {
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

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [guestPlayers, setGuestPlayers] = useState<GuestParticipant[]>([]);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);
  const [participantSearch, setParticipantSearch] = useState('');
  const [teamCount, setTeamCount] = useState(MIN_TEAMS);
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [revealMode, setRevealMode] = useState<'idle' | 'running' | 'done'>('idle');
  const [currentTeamIdx, setCurrentTeamIdx] = useState<number | null>(null);
  const [currentMemberIdx, setCurrentMemberIdx] = useState<number | null>(null);
  const [overviewUnlocked, setOverviewUnlocked] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(0.7)).current;
  const avatarOpacity = useRef(new Animated.Value(0)).current;
  const revealTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

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
  const selectedPlayers = useMemo(
    () => allParticipants.filter(person => selectedIds.includes(person.id)),
    [allParticipants, selectedIds]
  );

  const maxTeams = Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, selectedPlayers.length));
  const canStart = selectedPlayers.length >= MIN_PLAYERS && teamCount <= selectedPlayers.length;
  const canDecrement = teamCount > MIN_TEAMS;
  const canIncrement = teamCount < maxTeams;

  useEffect(() => {
    setTeamCount(prev => Math.min(Math.max(prev, MIN_TEAMS), maxTeams));
  }, [maxTeams]);

  useEffect(() => {
    setTeams([]);
    setError(null);
    setRevealMode('idle');
    setCurrentTeamIdx(null);
    setCurrentMemberIdx(null);
    setOverviewUnlocked(false);
  }, [selectedIds, teamCount, allParticipants.length]);

  useEffect(() => () => {
    revealTimers.current.forEach(timer => clearTimeout(timer));
    revealTimers.current = [];
  }, []);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(item => item !== id);
      return [...prev, id];
    });
  };

  const selectAll = () => {
    setSelectedIds(sortedParticipants.map(person => person.id));
  };

  const clearSelection = () => setSelectedIds([]);

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

  const generateTeams = () => {
    if (selectedPlayers.length < MIN_PLAYERS) {
      setError(`Selecteer minimaal ${MIN_PLAYERS} spelers.`);
      return;
    }
    if (teamCount > selectedPlayers.length) {
      setError('Te weinig spelers voor dit aantal teams.');
      return;
    }
    setError(null);
    const shuffled = shuffleArray(selectedPlayers);
    const targetSizes = computeBalancedTeamSizes(shuffled.length, teamCount);
    const capacities = [...targetSizes];

    const nextTeams: Team[] = Array.from({ length: teamCount }, (_, index) => ({
      id: index + 1,
      members: [],
    }));

    const remainingSlots = capacities.flatMap((size, index) => Array.from({ length: size }, () => index));
    const shuffledSlots = shuffleArray(remainingSlots);
    const shuffledRemaining = shuffleArray(shuffled);

    shuffledRemaining.forEach((player, idx) => {
      const slot = shuffledSlots[idx];
      nextTeams[slot].members.push(player);
    });
    setTeams(nextTeams);
    setRevealMode('idle');
    setCurrentTeamIdx(null);
    setCurrentMemberIdx(null);
    setOverviewUnlocked(false);
    Animated.timing(overlayOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
  };

  const schedule = (fn: () => void, delay = 500) => {
    const timer = setTimeout(fn, delay);
    revealTimers.current.push(timer);
  };

  const animateValue = (
    value: Animated.Value,
    toValue: number,
    duration: number,
    config?: Partial<Animated.TimingAnimationConfig>
  ) =>
    new Promise<void>(resolve => {
      Animated.timing(value, {
        toValue,
        duration,
        useNativeDriver: true,
        ...config,
      }).start(() => resolve());
    });

  const animateSpring = (
    value: Animated.Value,
    toValue: number,
    config?: Partial<Animated.SpringAnimationConfig>
  ) =>
    new Promise<void>(resolve => {
      Animated.spring(value, {
        toValue,
        useNativeDriver: true,
        friction: 7,
        tension: 130,
        ...config,
      }).start(() => resolve());
    });

  const runRevealSequence = async () => {
    if (!teams.length) return;
    setRevealMode('running');
    setOverviewUnlocked(false);
    setCurrentTeamIdx(null);
    setCurrentMemberIdx(null);
    overlayOpacity.setValue(0);
    titleOpacity.setValue(0);
    avatarOpacity.setValue(0);
    avatarScale.setValue(0.7);

    await animateValue(overlayOpacity, 1, 420);
    await new Promise<void>(resolve => schedule(resolve, 260));

    for (let t = 0; t < teams.length; t += 1) {
      setCurrentTeamIdx(t);
      setCurrentMemberIdx(null);
      titleOpacity.setValue(0);
      await animateValue(titleOpacity, 1, 480);
      await new Promise<void>(resolve => schedule(resolve, 340));

      const team = teams[t];
      for (let m = 0; m < team.members.length; m += 1) {
        setCurrentMemberIdx(m);
        avatarScale.setValue(0.45);
        avatarOpacity.setValue(0);
        await animateSpring(avatarScale, 1.1, { tension: 140, friction: 9 });
        await animateSpring(avatarScale, 1, { tension: 90, friction: 11 });
        await animateValue(avatarOpacity, 1, 220);
        await new Promise<void>(resolve => schedule(resolve, 3100));
        await animateValue(avatarOpacity, 0, 260);
      }

      await animateValue(titleOpacity, 0, 320);
      await new Promise<void>(resolve => schedule(resolve, 420));
    }

    await animateValue(overlayOpacity, 0, 520);
    setRevealMode('done');
    setOverviewUnlocked(true);
    setCurrentTeamIdx(null);
    setCurrentMemberIdx(null);
  };

  const startReveal = () => {
    if (!teams.length) return;
    setOverviewUnlocked(false);
    revealTimers.current.forEach(timer => clearTimeout(timer));
    revealTimers.current = [];
    runRevealSequence();
  };

  const skipToOverview = () => {
    revealTimers.current.forEach(timer => clearTimeout(timer));
    revealTimers.current = [];
    animateValue(overlayOpacity, 0, 220).finally(() => {
      setRevealMode('done');
      setOverviewUnlocked(true);
      setCurrentTeamIdx(null);
      setCurrentMemberIdx(null);
    });
  };

  const renderParticipant = (
    person: SelectableParticipant,
    options?: { selected?: boolean; disabled?: boolean }
  ) => {
    const selected = options?.selected ?? false;
    const disabled = options?.disabled ?? false;
    const showFallback = person.isGuest || !person.avatar || imageErrors[person.id];
    const initials = getInitials(person.naam);
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
  };

  const renderTeamMember = (person: SelectableParticipant) => {
    const showFallback = person.isGuest || !person.avatar || imageErrors[person.id];
    const initials = getInitials(person.naam);
    return (
      <View key={person.id} style={styles.teamMember}>
        {showFallback ? (
          <View style={styles.teamAvatarFallback}>
            <Text style={styles.teamAvatarText}>{initials}</Text>
          </View>
        ) : (
          <Image
            source={person.avatar as Participant['avatar']}
            style={styles.teamAvatar}
            onError={() =>
              setImageErrors(prev => ({
                ...prev,
                [person.id]: true,
              }))
            }
          />
        )}
        <Text style={styles.teamName}>{person.naam}</Text>
      </View>
    );
  };

  const currentTeam = currentTeamIdx !== null ? teams[currentTeamIdx] : null;
  const currentMember =
    currentTeam && currentMemberIdx !== null ? currentTeam.members[currentMemberIdx] : null;

  return (
    <>
      <Stack.Screen options={{ title: 'Teams verdelen', headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <Animated.ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.content,
            { paddingTop: actionBarOffset, paddingBottom: Spacing.lg + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          <Card style={styles.introCard}>
            <Text style={styles.title}>Teams verdelen</Text>
            <Text style={styles.subtitle}>
              Kies spelers, stel het aantal teams in en laat de app de teams willekeurig maken.
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
            <Text style={styles.hintText}>Kies minimaal {MIN_PLAYERS} spelers.</Text>
            {participantSearchQuery.length > 0 && visibleParticipants.length === 0 && (
              <Text style={styles.searchEmptyText}>Geen deelnemers gevonden.</Text>
            )}
            <View style={styles.participantGrid}>
              {visibleParticipants.map(person => {
                const selected = selectedIds.includes(person.id);
                return renderParticipant(person, { selected });
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
            <Text style={styles.sectionTitle}>Aantal teams</Text>
            <Text style={styles.hintText}>Kies tussen {MIN_TEAMS} en {maxTeams} teams.</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity
                style={[styles.counterButton, !canDecrement && styles.counterButtonDisabled]}
                onPress={() => setTeamCount(prev => Math.max(MIN_TEAMS, prev - 1))}
                disabled={!canDecrement}
              >
                <Text style={styles.counterButtonText}>-</Text>
              </TouchableOpacity>
              <View style={styles.counterValueBox}>
                <Text style={styles.counterValue}>{teamCount}</Text>
              </View>
              <TouchableOpacity
                style={[styles.counterButton, !canIncrement && styles.counterButtonDisabled]}
                onPress={() => setTeamCount(prev => Math.min(maxTeams, prev + 1))}
                disabled={!canIncrement}
              >
                <Text style={styles.counterButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </Card>

          {error ? <Text style={styles.inputError}>{error}</Text> : null}
          <Button
            label={teams.length ? 'Schud opnieuw' : 'Maak teams'}
            onPress={generateTeams}
            disabled={!canStart}
          />

          {teams.length > 0 && (
            <View style={styles.actionRow}>
              <Button
                label={revealMode === 'running' ? 'Bezig met reveal...' : 'Start reveal'}
                onPress={startReveal}
                disabled={revealMode === 'running'}
              />
            </View>
          )}

          {teams.length > 0 && revealMode !== 'done' && (
            <Card style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Reveal eerst</Text>
              <Text style={styles.noticeBody}>Het overzicht verschijnt zodra de reveal klaar is.</Text>
            </Card>
          )}

          {teams.length > 0 && revealMode === 'done' && overviewUnlocked && (
            <View style={styles.teamsWrap}>
              {teams.map(team => (
                <Card key={team.id} style={styles.teamCard}>
                  <View style={styles.teamHeader}>
                    <Text style={styles.teamTitle}>Team {team.id}</Text>
                    <Text style={styles.teamMeta}>{team.members.length} spelers</Text>
                  </View>
                  <View style={styles.teamMembers}>{team.members.map(renderTeamMember)}</View>
                </Card>
              ))}
            </View>
          )}
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      <FloatingActions
        showSettings={false}
        showLifeBuoy={false}
        animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
      />

      <Modal
        visible={revealMode === 'running'}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={skipToOverview}
      >
        <Animated.View style={[styles.cinemaOverlay, { opacity: overlayOpacity }]}>
          <View style={styles.cinemaHeader}>
            <Text style={styles.cinemaLabel}>Dramatische reveal</Text>
            <TouchableOpacity onPress={skipToOverview} style={styles.cinemaSkip}>
              <Text style={styles.cinemaSkipText}>Skip</Text>
            </TouchableOpacity>
          </View>

          {currentTeam ? (
            <Animated.Text style={[styles.cinemaTitle, { opacity: titleOpacity }]}>TEAM {currentTeam.id}</Animated.Text>
          ) : null}

          {currentMember && (
            <View style={styles.cinemaAvatarWrap}>
              <Animated.View
                style={[
                  styles.cinemaAvatarInner,
                  {
                    opacity: avatarOpacity,
                    transform: [{ scale: avatarScale }],
                  },
                ]}
              >
                {currentMember.isGuest || !currentMember.avatar || imageErrors[currentMember.id] ? (
                  <View style={styles.cinemaFallback}>
                    <Text
                      style={[
                        styles.cinemaFallbackText,
                        currentMember.isGuest && styles.cinemaFallbackGuest,
                      ]}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                    >
                      {currentMember.isGuest ? currentMember.naam : getInitials(currentMember.naam)}
                    </Text>
                  </View>
                ) : (
                  <Image
                    source={currentMember.avatar as Participant['avatar']}
                    style={styles.cinemaAvatar}
                    onError={() =>
                      setImageErrors(prev => ({
                        ...prev,
                        [currentMember.id]: true,
                      }))
                    }
                  />
                )}
              </Animated.View>
            </View>
          )}
        </Animated.View>
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

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const randomIndex = (limit: number) => Math.floor(Math.random() * Math.max(1, limit));

// Keep team sizes within one member difference.
const computeBalancedTeamSizes = (totalPlayers: number, teams: number) => {
  const baseSize = Math.floor(totalPlayers / teams);
  const remainder = totalPlayers % teams;
  return Array.from({ length: teams }, (_, index) => baseSize + (index < remainder ? 1 : 0));
};

const shuffleArray = <T,>(items: T[]) => {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

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
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      flexWrap: 'wrap',
    },
    noticeCard: {
      gap: Spacing.xs,
      borderWidth: 1,
      borderColor: `${palette.primary}55`,
      backgroundColor: `${palette.primary}0F`,
    },
    noticeTitle: {
      fontSize: Typography.section,
      fontWeight: '800',
      color: palette.textPrimary,
    },
    noticeBody: {
      fontSize: Typography.body,
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
    counterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    counterButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: palette.background,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    counterButtonDisabled: {
      opacity: 0.4,
    },
    counterButtonText: {
      fontSize: 18,
      color: palette.textPrimary,
      fontWeight: '700',
    },
    counterValueBox: {
      minWidth: 56,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    counterValue: {
      fontSize: 18,
      color: palette.textPrimary,
      fontWeight: '700',
    },
    teamsWrap: {
      gap: Spacing.sm,
    },
    teamCard: {
      gap: Spacing.sm,
    },
    teamHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    teamTitle: {
      fontSize: Typography.section,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    teamMeta: {
      fontSize: Typography.label,
      color: palette.textSecondary,
    },
    teamMembers: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    teamMember: {
      width: '33.3333%',
      flexBasis: '33.3333%',
      maxWidth: '33.3333%',
      minWidth: '33.3333%',
      flexGrow: 0,
      flexShrink: 0,
      paddingVertical: 8,
      paddingHorizontal: 6,
      alignItems: 'center',
    },
    teamAvatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
    },
    teamAvatarFallback: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.border,
    },
    teamAvatarText: {
      fontSize: 18,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    teamName: {
      fontSize: 13,
      color: palette.textPrimary,
      fontWeight: '700',
      textAlign: 'center',
      marginTop: 6,
    },
    cinemaOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#05060c',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    cinemaHeader: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.sm,
    },
    cinemaLabel: {
      color: '#FFFFFFAA',
      fontSize: Typography.label,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    cinemaSkip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#FFFFFF55',
      backgroundColor: '#FFFFFF10',
    },
    cinemaSkipText: {
      color: '#FFFFFF',
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    cinemaTitle: {
      fontSize: 42,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 3,
      textAlign: 'center',
      textShadowColor: '#000000AA',
      textShadowRadius: 10,
      textShadowOffset: { width: 0, height: 4 },
    },
    cinemaAvatarWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    cinemaAvatarInner: {
      width: 330,
      height: 330,
      borderRadius: 44,
      overflow: 'hidden',
      backgroundColor: palette.surface,
      borderWidth: 2,
      borderColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 16 },
      elevation: 10,
    },
    cinemaAvatar: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    cinemaFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.border,
    },
    cinemaFallbackText: {
      fontSize: 64,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 6,
      textAlign: 'center',
    },
    cinemaFallbackGuest: {
      fontSize: 40,
      letterSpacing: 2,
    },
    cinemaName: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
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
  });
