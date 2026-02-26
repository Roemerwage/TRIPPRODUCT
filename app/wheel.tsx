import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useThemeMode } from '@/contexts/ThemeContext';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import { Stack } from 'expo-router';
import Svg, { G, Path } from 'react-native-svg';
import { Check, Plus, X } from 'lucide-react-native';
import { useTrip } from '@/contexts/TripContext';
import { Participant } from '@/types/trip';
import { FloatingActions } from '@/components/FloatingActions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WHEEL_COLORS = ['#0EA5E9', '#22C55E', '#F97316', '#F43F5E', '#14B8A6', '#F59E0B', '#38BDF8', '#111827'];
const WHEEL_SIZE = Math.min(Dimensions.get('window').width - 48, 360);

const STEPS = ['Deelnemers', 'Winnaars', 'Rad'] as const;

const WEIGHT_OVERRIDES: Record<string, number> = {};

type SelectableParticipant = Omit<Participant, 'avatar'> & {
  avatar?: Participant['avatar'];
  isGuest?: boolean;
};

type GuestParticipant = SelectableParticipant & {
  id: string;
  naam: string;
  isGuest: true;
};

export default function WheelScreen() {
  const { participants } = useTrip();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [winnerCount, setWinnerCount] = useState(1);
  const [winners, setWinners] = useState<SelectableParticipant[]>([]);
  const [spinAngle, setSpinAngle] = useState(0);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [spinCount, setSpinCount] = useState(0);
  const [wheelParticipants, setWheelParticipants] = useState<SelectableParticipant[]>([]);
  const [spotlightWinner, setSpotlightWinner] = useState<SelectableParticipant | null>(null);
  const spotlightTimer = useRef<NodeJS.Timeout | null>(null);
  const [guestPlayers, setGuestPlayers] = useState<GuestParticipant[]>([]);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);
  const [wheelSectionY, setWheelSectionY] = useState(0);
  const [selectionSectionY, setSelectionSectionY] = useState(0);
  const { colors } = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<Animated.ScrollView | null>(null);
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

  const allParticipants = useMemo(
    () => [...participants, ...guestPlayers],
    [participants, guestPlayers]
  );
  const selectedParticipants = useMemo(
    () => allParticipants.filter(p => selectedIds.includes(p.id)),
    [selectedIds, allParticipants]
  );

  useEffect(() => {
    const participantIds = new Set(participants.map(person => person.id));
    setSelectedIds(prev => {
      const guestIds = prev.filter(id => id.startsWith('guest-'));
      const participantSelection = prev.filter(id => participantIds.has(id));
      if (participantSelection.length === 0 && guestIds.length === 0) {
        return [...participants.map(person => person.id)];
      }
      return [...new Set([...participantSelection, ...guestIds])];
    });

    setWheelParticipants(prev => {
      if (prev.length === 0) return participants;
      return prev
        .map(person =>
          person.isGuest ? person : participants.find(item => item.id === person.id) ?? null
        )
        .filter(Boolean) as SelectableParticipant[];
    });
  }, [participants]);

  useEffect(() => {
    setWinnerCount(prev => {
      if (selectedParticipants.length === 0) {
        return 0;
      }
      const safePrev = prev === 0 ? 1 : prev;
      return Math.min(safePrev, selectedParticipants.length);
    });
    setWinners(prev => prev.filter(w => selectedIds.includes(w.id)));
  }, [selectedParticipants.length, selectedIds]);

  const prevSelectionKey = useRef<string>(selectedIds.join(','));

  useEffect(() => {
    const selectionKey = selectedIds.join(',');
    if (currentStep === 2 && !isSpinning && selectionKey !== prevSelectionKey.current) {
      setWheelParticipants(selectedParticipants);
      setWinners([]);
      setSpotlightWinner(null);
      prevSelectionKey.current = selectionKey;
    }
  }, [selectedIds, selectedParticipants, currentStep, isSpinning]);

  useEffect(() => {
    return () => {
      if (spotlightTimer.current) {
        clearTimeout(spotlightTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentStep === 0 && selectionSectionY > 0) {
      requestAnimationFrame(() => {
        const node = scrollRef.current?.getNode?.();
        node?.scrollTo?.({ y: Math.max(0, selectionSectionY - 12), animated: true });
      });
    }
  }, [currentStep, selectionSectionY]);

  useEffect(() => {
    if (currentStep === 2 && wheelSectionY > 0) {
      requestAnimationFrame(() => {
        const node = scrollRef.current?.getNode?.();
        node?.scrollTo?.({ y: Math.max(0, wheelSectionY - 16), animated: true });
      });
    }
  }, [currentStep, wheelSectionY]);

  const slices = useMemo(
    () => buildSlices(wheelParticipants, WHEEL_SIZE),
    [wheelParticipants]
  );

  const canSpin = slices.length > 0 && winnerCount > 0 && !isSpinning;
  const canIncrement = selectedParticipants.length > 0 && winnerCount < selectedParticipants.length;
  const canDecrement = winnerCount > (selectedParticipants.length === 0 ? 0 : 1);
  const wheelRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${spinAngle}deg`],
  });

  const toggleParticipant = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedIds(allParticipants.map(p => p.id));
  const clearSelection = () => {
    setSelectedIds([]);
    setWinners([]);
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
    setSelectedIds(prev => [...prev, newGuest.id]);
    setGuestName('');
    setGuestError(null);
    setShowGuestModal(false);
  };

  const spinOnce = () => {
    if (!canSpin) return;
    const baseList = selectedParticipants;
    const cappedCount = Math.min(winnerCount, baseList.length);
    const order = weightedOrder(baseList, cappedCount);
    if (order.length === 0) return;

    setWinners([]);
    setWheelParticipants(baseList);
    setSpinCount(0);
    runSpinSequence(order, baseList);
  };

  const runSpinSequence = (queue: SelectableParticipant[], currentList: SelectableParticipant[]) => {
    if (queue.length === 0 || currentList.length === 0) {
      setIsSpinning(false);
      return;
    }

    const winner = queue[0];
    const currentSlices = buildSlices(currentList, WHEEL_SIZE);
    const targetSlice = currentSlices.find(slice => slice.id === winner.id);
    const midAngle = targetSlice?.midAngle ?? Math.random() * 360;

    const extraRotations = 6 + Math.min(spinCount, 6);
    const randomNudge = (Math.random() * 6) - 3; // small wobble
    const target = extraRotations * 360 + (360 - midAngle) + randomNudge;

    setSpinAngle(target);
    setIsSpinning(true);
    spinAnim.setValue(0);

    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 10000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setWinners(prev => [...prev, winner]);
      const remainingList = currentList.filter(p => p.id !== winner.id);
      setWheelParticipants(remainingList);
      setSpinCount(prev => prev + 1);
      setIsSpinning(false);
      setSpotlightWinner(winner);
      if (spotlightTimer.current) {
        clearTimeout(spotlightTimer.current);
      }

      spotlightTimer.current = setTimeout(() => {
        setSpotlightWinner(null);
        if (queue.length > 1) {
          runSpinSequence(queue.slice(1), remainingList);
        }
      }, 4000);
    });
  };

  const goNext = () => {
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const renderParticipantAvatar = (participant: SelectableParticipant, large?: boolean) => {
    const showFallback = participant.isGuest || !participant.avatar || imageErrors[participant.id];
    const initials = getInitials(participant.naam);
    if (showFallback) {
      return (
        <View style={[styles.avatarFallback, large && styles.avatarFallbackLarge]}>
          <Text style={[styles.avatarFallbackText, large && styles.avatarFallbackTextLarge]}>{initials}</Text>
        </View>
      );
    }
    return (
      <Image
        source={participant.avatar as Participant['avatar']}
        style={large ? styles.avatarLarge : styles.avatar}
        onError={() =>
          setImageErrors(prev => ({
            ...prev,
            [participant.id]: true,
          }))
        }
      />
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Spin Wheel', headerShown: false }} />
      <Animated.ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: actionBarOffset }]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        ref={scrollRef}
      >
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Spin Wheel</Text>
        </View>

        <View style={styles.stepper}>
          {STEPS.map((label, idx) => {
            const isActive = idx === currentStep;
            const isComplete = idx < currentStep;
            return (
              <TouchableOpacity
                key={label}
                style={[
                  styles.stepPill,
                  isActive && styles.stepPillActive,
                  isComplete && styles.stepPillDone,
                ]}
                activeOpacity={0.8}
                onPress={() => setCurrentStep(idx)}
              >
                <Text
                  style={[
                    styles.stepPillText,
                    (isActive || isComplete) && styles.stepPillTextActive,
                  ]}
                >
                  {idx + 1}. {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {currentStep === 0 && (
          <View
            style={styles.section}
            onLayout={e => setSelectionSectionY(e.nativeEvent.layout.y)}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Kies deelnemers</Text>
              <View style={styles.sectionActions}>
                <TouchableOpacity style={styles.linkButton} onPress={selectAll}>
                  <Text style={styles.linkButtonText}>Selecteer alles</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkButton} onPress={clearSelection}>
                  <Text style={styles.linkButtonText}>Wis selectie</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.participantGrid}>
              {allParticipants.map(participant => {
                const isSelected = selectedIds.includes(participant.id);
                const showFallback = participant.isGuest || !participant.avatar || imageErrors[participant.id];
                const initials = getInitials(participant.naam);
                return (
                  <TouchableOpacity
                    key={participant.id}
                    style={[styles.participantTile, isSelected && styles.participantTileSelected]}
                    activeOpacity={0.85}
                    onPress={() => toggleParticipant(participant.id)}
                  >
                    <View style={[styles.avatarWrap, isSelected && styles.avatarWrapSelected]}>
                      {showFallback ? (
                        <View style={styles.avatarFallbackLarge}>
                          <Text style={[styles.avatarFallbackText, styles.avatarFallbackTextLarge]}>
                            {initials}
                          </Text>
                        </View>
                      ) : (
                        <Image
                          source={participant.avatar as Participant['avatar']}
                          style={styles.avatarLarge}
                          onError={() =>
                            setImageErrors(prev => ({
                              ...prev,
                              [participant.id]: true,
                            }))
                          }
                        />
                      )}
                      {isSelected && (
                        <View style={styles.participantCheck}>
                          <Check size={18} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                    <Text style={styles.participantName}>{participant.naam}</Text>
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

            <View style={styles.navRow}>
              <TouchableOpacity
                style={[styles.primaryButton, selectedParticipants.length === 0 && styles.primaryButtonDisabled]}
                onPress={goNext}
                disabled={selectedParticipants.length === 0}
              >
                <Text style={styles.primaryButtonText}>Volgende: winnaars</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {currentStep === 1 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hoeveel winnaars?</Text>
            <Text style={styles.helperText}>
              Max {selectedParticipants.length} geselecteerd • zonder duplicates
            </Text>
            <View style={styles.counterRow}>
              <TouchableOpacity
                style={[styles.counterButton, !canDecrement && styles.counterButtonDisabled]}
                onPress={() =>
                  setWinnerCount(prev =>
                    Math.max(selectedParticipants.length === 0 ? 0 : 1, prev - 1)
                  )
                }
                disabled={!canDecrement}
              >
                <Text style={styles.counterButtonText}>−</Text>
              </TouchableOpacity>
              <View style={styles.counterValueBox}>
                <Text style={styles.counterValue}>{winnerCount}</Text>
              </View>
              <TouchableOpacity
                style={[styles.counterButton, !canIncrement && styles.counterButtonDisabled]}
                onPress={() =>
                  setWinnerCount(prev => Math.min(prev + 1, selectedParticipants.length))
                }
                disabled={!canIncrement}
              >
                <Text style={styles.counterButtonText}>+</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={goBack}>
                <Text style={styles.secondaryButtonText}>Terug</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, (!selectedParticipants.length || !winnerCount) && styles.primaryButtonDisabled]}
                onPress={goNext}
                disabled={!selectedParticipants.length || !winnerCount}
              >
                <Text style={styles.primaryButtonText}>Naar het rad</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {currentStep === 2 && (
          <View
            style={styles.section}
            onLayout={e => setWheelSectionY(e.nativeEvent.layout.y)}
          >
            <View style={styles.wheelWrapper}>
              <View style={styles.pointer} />
                  {selectedParticipants.length === 0 ? (
                    <View style={styles.wheelPlaceholder}>
                      <Text style={styles.helperText}>Selecteer deelnemers om het wiel te vullen.</Text>
                    </View>
                  ) : (
                    <Animated.View
                      style={[styles.wheelCard, { transform: [{ rotate: wheelRotation }] }]}
                    >
                      <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
                        <G origin={`${WHEEL_SIZE / 2}, ${WHEEL_SIZE / 2}`}>
                          {slices.map(slice => (
                            <React.Fragment key={slice.id}>
                              <Path d={slice.path} fill={slice.color} />
                            </React.Fragment>
                          ))}
                        </G>
                      </Svg>
                      <View pointerEvents="none" style={styles.sliceAvatarOverlay}>
                        {slices.map(slice =>
                          slice.avatar ? (
                            <Image
                              key={`av-${slice.id}`}
                              source={slice.avatar}
                              style={[
                                styles.sliceAvatar,
                                {
                                  width: slice.avatarSize,
                                  height: slice.avatarSize,
                                  borderRadius: slice.avatarSize / 2,
                                  left: slice.labelPosition.x - slice.avatarSize / 2,
                                  top: slice.labelPosition.y - slice.avatarSize / 2,
                                },
                              ]}
                            />
                          ) : (
                            <View
                              key={`av-${slice.id}`}
                              style={[
                                styles.sliceAvatarFallback,
                                {
                                  width: slice.avatarSize,
                                  height: slice.avatarSize,
                                  borderRadius: slice.avatarSize / 2,
                                  left: slice.labelPosition.x - slice.avatarSize / 2,
                                  top: slice.labelPosition.y - slice.avatarSize / 2,
                                },
                              ]}
                            >
                              <Text style={styles.sliceAvatarFallbackText}>{slice.initials}</Text>
                            </View>
                          )
                        )}
                      </View>
                    </Animated.View>
                  )}
            </View>

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={goBack}>
                <Text style={styles.secondaryButtonText}>Terug</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, !canSpin && styles.primaryButtonDisabled]}
                onPress={spinOnce}
                disabled={!canSpin}
              >
                <Text style={styles.primaryButtonText}>{isSpinning ? 'Bezig...' : 'Draai!'}</Text>
              </TouchableOpacity>
            </View>

            {winners.length > 0 && (
              <View style={styles.winnerSection}>
                <Text style={styles.winnerTitle}>
                  Geselecteerde winnaar:
                </Text>
                <View style={styles.winnerRow}>
                  {winners.map(winner => (
                    <View key={winner.id} style={styles.winnerCard}>
                      {renderParticipantAvatar(winner, true)}
                      <Text style={styles.winnerName}>{winner.naam}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity style={styles.secondaryButton} onPress={spinOnce}>
                  <Text style={styles.secondaryButtonText}>Nog een keer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

      {spotlightWinner && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setSpotlightWinner(null)}>
          <View style={styles.spotlightBackdrop}>
            <View style={styles.spotlightCard}>
              {spotlightWinner.isGuest || !spotlightWinner.avatar ? (
                <Text style={styles.spotlightGuestName}>
                  {spotlightWinner.naam}!
                </Text>
              ) : (
                <Image source={spotlightWinner.avatar} style={styles.spotlightImage} />
              )}
            </View>
          </View>
        </Modal>
      )}
      </Animated.ScrollView>
      <FloatingActions
        showSettings={false}
        showLifeBuoy={false}
        animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
      />

      <Modal visible={showGuestModal} transparent animationType="fade" onRequestClose={() => setShowGuestModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
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
            <TouchableOpacity style={styles.modalButton} onPress={addGuest}>
              <Text style={styles.modalButtonText}>Gast toevoegen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function buildSlices(participants: SelectableParticipant[], size: number) {
  const radius = size / 2;
  const angle = participants.length > 0 ? 360 / participants.length : 0;
  const labelRadius = radius * 0.65;
  const arcLength = angle ? (2 * Math.PI * labelRadius) * (angle / 360) : 0;
  const minAvatarSize = Math.max(18, radius * 0.12);
  const maxAvatarSize = Math.min(110, radius * 0.55);
  const avatarSize = Math.min(Math.max(arcLength * 0.6, minAvatarSize), maxAvatarSize);

  return participants.map((participant, idx) => {
    const startAngle = angle * idx;
    const endAngle = startAngle + angle;
    const midAngle = startAngle + angle / 2;
    const color = WHEEL_COLORS[idx % WHEEL_COLORS.length];
    const path = describeSlice(radius, radius, radius, startAngle, endAngle);
    const labelPosition = polarToCartesian(radius, radius, labelRadius, startAngle + angle / 2);

    return {
      id: participant.id,
      label: participant.naam,
      avatar: participant.avatar,
      initials: getInitials(participant.naam),
      avatarSize,
      color,
      path,
      labelPosition,
      midAngle,
    };
  });
}

function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function weightedOrder(list: SelectableParticipant[], count: number): SelectableParticipant[] {
  const pool = [...list];
  const result: SelectableParticipant[] = [];
  const target = Math.min(count, pool.length);

  for (let i = 0; i < target; i++) {
    const totalWeight = pool.reduce((sum, p) => sum + getWeight(p), 0);
    let r = Math.random() * totalWeight;
    let selectedIndex = 0;

    for (let idx = 0; idx < pool.length; idx++) {
      r -= getWeight(pool[idx]);
      if (r <= 0) {
        selectedIndex = idx;
        break;
      }
    }

    const picked = pool[selectedIndex];
    result.push(picked);
    pool.splice(selectedIndex, 1);
  }

  return result;
}

function getWeight(participant: SelectableParticipant): number {
  return WEIGHT_OVERRIDES[participant.id] ?? 1;
}

const createStyles = (palette: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: 16,
    gap: 6,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 0,
    marginBottom: 0,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: palette.textPrimary,
  },
  stepper: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  stepPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
  },
  stepPillActive: {
    backgroundColor: palette.surface,
    borderColor: palette.primary,
  },
  stepPillDone: {
    borderColor: palette.primary,
  },
  stepPillText: {
    fontSize: 14,
    color: palette.textSecondary,
  },
  stepPillTextActive: {
    color: palette.textPrimary,
    fontWeight: '700',
  },
  section: {
    backgroundColor: palette.surface,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 6,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  helperText: {
    fontSize: 14,
    color: palette.textSecondary,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  listLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarLarge: {
    width: 102,
    height: 102,
    borderRadius: 51,
  },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.border,
  },
  avatarFallbackLarge: {
    width: 102,
    height: 102,
    borderRadius: 51,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.border,
  },
  avatarFallbackText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  avatarFallbackTextLarge: {
    fontSize: 22,
  },
  name: {
    fontSize: 16,
    color: palette.textPrimary,
    fontWeight: '600',
  },
  role: {
    fontSize: 13,
    color: palette.textSecondary,
  },
  participantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
    justifyContent: 'flex-start',
  },
  participantCard: {
    width: '48%',
    flexBasis: '48%',
    maxWidth: '48%',
    minWidth: '48%',
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: palette.background,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    position: 'relative',
  },
  participantCardSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.surface,
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
  participantName: {
    fontSize: 14,
    color: palette.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  participantRole: {
    fontSize: 13,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  participantCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: palette.primary,
    borderRadius: 10,
    padding: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    backgroundColor: palette.background,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: palette.primary,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
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
  counterButtonText: {
    fontSize: 18,
    color: palette.textPrimary,
    fontWeight: '700',
  },
  counterValue: {
    fontSize: 18,
    color: palette.textPrimary,
    fontWeight: '700',
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  wheelWrapper: {
    alignItems: 'center',
    marginVertical: 8,
  },
  pointer: {
    position: 'absolute',
    top: 6,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: palette.accent,
    zIndex: 10,
  },
  wheelCard: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    overflow: 'hidden',
  },
  wheelPlaceholder: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
  },
  sliceAvatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
  },
  sliceAvatar: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: palette.surface,
  },
  sliceAvatarFallback: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 2,
    borderColor: palette.surface,
  },
  sliceAvatarFallbackText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.textPrimary,
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
  winnerSection: {
    marginTop: 8,
    gap: 8,
  },
  winnerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  winnerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  winnerCard: {
    alignItems: 'center',
    padding: 8,
    backgroundColor: palette.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
  },
  winnerName: {
    marginTop: 4,
    fontSize: 14,
    color: palette.textPrimary,
  },
  spotlightBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  spotlightCard: {
    backgroundColor: palette.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  spotlightImage: {
    width: 320,
    height: 320,
    borderRadius: 160,
    marginBottom: 10,
  },
  spotlightGuestName: {
    fontSize: 72,
    fontWeight: '800',
    color: '#001F3F',
    textAlign: 'center',
    paddingVertical: 40,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  modalCard: {
    backgroundColor: palette.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    width: '100%',
    maxWidth: 340,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: palette.textPrimary,
    backgroundColor: palette.background,
  },
  inputError: {
    fontSize: 13,
    color: palette.accent,
    fontWeight: '600',
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: palette.primary,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
;
