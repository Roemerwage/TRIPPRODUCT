import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, TextInput, View, ScrollView, TouchableOpacity, Linking, Alert, Modal, Animated, KeyboardAvoidingView, Platform, PanResponder } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useTrip } from '@/contexts/TripContext';
import { MapPin, ExternalLink, Clock, Navigation, ChevronDown, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { getAccommodationMedia, getActivityImage, getActivityLink, getDayImage, getPlaceImage } from '@/constants/media';
import { Activity, Day, Place } from '@/types/trip';
import { formatMinutesLabel, getFlightArrivalTime, getFlightLayoverMinutes } from '@/utils/flight';
import { useThemeMode } from '@/contexts/ThemeContext';
import { PreviewableImage } from '@/components/PreviewableImage';
import { FloatingActions } from '@/components/FloatingActions';
import { Radius, Spacing, Typography } from '@/constants/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TEST_NOTIFICATION_PASSWORD, isTestNotificationPasswordConfigured } from '@/constants/security';
import { SPOTIFY_PLAYLIST_URL } from '@/constants/spotify';

const SECURITY_TIMESLOT_LINK = 'https://example.com/security-timeslots';
const SECURITY_TIMESLOT_TIPS = [
  {
    title: 'Sneller door security',
    body: 'Gebruik tijdslots alleen voor de securitylijn en kom op tijd voor inchecken en bagage.',
  },
  {
    title: 'Kom op tijd',
    body: 'Kom binnen 15 minuten voor of na je tijdslot om je plek te behouden.',
  },
  {
    title: 'Plan vooruit',
    body: 'Boek je tijdslot enkele dagen voor vertrek voor een rustige start.',
  },
];

type SpecialEventOptionKey = 'optionA' | 'optionB';

const SPECIAL_EVENT_TABS: { key: SpecialEventOptionKey; label: string; icon: string }[] = [
  { key: 'optionA', label: 'Optie A', icon: '🎉' },
  { key: 'optionB', label: 'Optie B', icon: '🎭' },
];

const SPECIAL_EVENT_OPTIONS: {
  key: SpecialEventOptionKey;
  title: string;
  body: string;
  details: string[];
  links: { label: string; url: string }[];
  note?: string;
}[] = [
  {
    key: 'optionA',
    title: 'Optie 1: Dagprogramma',
    body: 'Openluchtprogramma met muziek, workshops en informele activiteiten. Details volgen in de app.',
    details: [
      'Start: 08:00',
      'Locatie: Stadscentrum',
      'Toegang: Gratis',
    ],
    links: [
      { label: 'Info', url: 'https://example.com/event-info' },
      { label: 'Maps', url: 'https://example.com/map' },
    ],
  },
  {
    key: 'optionB',
    title: 'Optie 2: Ochtendprogramma',
    body: 'Groot evenement met veel bezoekers, muziek en entertainment.',
    details: [
      'Start: 07:00',
      'Adres: Hoofdstraat',
    ],
    links: [
      { label: 'Info', url: 'https://example.com/event-details' },
      { label: 'Maps', url: 'https://example.com/map' },
    ],
  },
];

export default function DayDetailScreen() {
  const { dayId, dir } = useLocalSearchParams<{ dayId: string; dir?: 'next' | 'prev' }>();
  const { days, getRoomAssignments, loadInitialTripData, sendTestNotificationForDay } = useTrip();
  const router = useRouter();
  const [roomsExpanded, setRoomsExpanded] = useState(false);
  const [freeDayTab, setFreeDayTab] = useState<FreeDayTabKey | null>(null);
  const [specialEventTab, setSpecialEventTab] = useState<SpecialEventOptionKey | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [testPickerVisible, setTestPickerVisible] = useState(false);
  const [selectedTestDayId, setSelectedTestDayId] = useState<string | null>(null);
  const [testPassword, setTestPassword] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(0));
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

  const day = days.find(d => d.datum.toISOString() === dayId);
  const dayIndex = days.findIndex(d => d.datum.toISOString() === dayId);
  const prevDay = dayIndex > 0 ? days[dayIndex - 1] : null;
  const nextDay = dayIndex >= 0 && dayIndex < days.length - 1 ? days[dayIndex + 1] : null;

  const heroImage = useMemo(() => day ? getDayImage(day) : undefined, [day]);
  const accommodationMedia = useMemo(
    () => day ? getAccommodationMedia(day.verblijf) : undefined,
    [day]
  );
  const roomAssignments = day ? getRoomAssignments(day.verblijf) : [];
  const isFreeDay = day ? day.activiteiten.some(activity => activity.type === 'free_day') : false;

  const placeGroups = useMemo(() => {
    if (!day?.places?.length) return [];
    const grouped = new Map<string, Place[]>();
    day.places.forEach(place => {
      const group = place.group || 'Overig';
      if (!grouped.has(group)) {
        grouped.set(group, []);
      }
      grouped.get(group)!.push(place);
    });
    return Array.from(grouped.entries())
      .map(([group, items]) => ({
        group,
        items: items.sort((a, b) => {
          const aTime = a.startTijd?.getTime() ?? Number.POSITIVE_INFINITY;
          const bTime = b.startTijd?.getTime() ?? Number.POSITIVE_INFINITY;
          if (aTime !== bTime) return aTime - bTime;
          return a.naam.localeCompare(b.naam);
        }),
      }))
      .sort((a, b) => getPlaceGroupOrder(a.group) - getPlaceGroupOrder(b.group));
  }, [day]);

  const planningItems = useMemo(() => {
    const activityItems = day
      ? day.activiteiten.map(activity => {
          const time = activity.verzamelTijd || activity.startTijd;
          return {
            kind: 'activity' as const,
            time: time ? time.getTime() : Number.POSITIVE_INFINITY,
            activity,
          };
        })
      : [];

    const placeItems = placeGroups.map(group => {
      const earliest = group.items.reduce((acc, item) => {
        const time = item.startTijd ? item.startTijd.getTime() : Number.POSITIVE_INFINITY;
        return Math.min(acc, time);
      }, Number.POSITIVE_INFINITY);
      return {
        kind: 'placeGroup' as const,
        time: earliest,
        order: getPlaceGroupOrder(group.group),
        group,
      };
    });

    return [...placeItems, ...activityItems].sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      if ('order' in a && 'order' in b) return a.order - b.order;
      if ('order' in a) return -1;
      if ('order' in b) return 1;
      return 0;
    });
  }, [day, placeGroups]);

  if (!day) {
    return (
      <>
        <Stack.Screen options={{ title: 'Planning', headerShown: false }} />
        <View style={[styles.centerContainer, { paddingTop: actionBarOffset }]}>
          <Text style={styles.errorText}>Dag niet gevonden</Text>
        </View>
        <FloatingActions
          showSpotify
          spotifyUrl={SPOTIFY_PLAYLIST_URL}
          animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
        />
      </>
    );
  }

  const dateStr = `${day.datum.getDate()} ${getMonthName(day.datum.getMonth())}`;
  const formatShortDate = (d: Date) => `${d.getDate()} ${getMonthName(d.getMonth())}`;
  const goToDay = useCallback(
    (targetId: string, direction: 'next' | 'prev' = 'next') => {
      router.replace({
        pathname: '/planning/[dayId]',
        params: { dayId: targetId, dir: direction },
      } as any);
    },
    [router]
  );

  const handleOpenMaps = (link: string) => {
    if (link && link !== 'x' && link.toLowerCase() !== 'unknown') {
      Linking.openURL(link);
    }
  };

  const handleReload = async () => {
    Alert.alert(
      'Standaardplanning herladen?',
      'Je huidige planning wordt overschreven met de standaardreis.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Herladen',
          style: 'destructive',
          onPress: async () => {
            await loadInitialTripData();
            router.replace(`/planning/${encodeURIComponent(dayId)}` as any);
          },
        },
      ]
    );
  };

  const handleSendTestNotification = async () => {
    if (!isTestNotificationPasswordConfigured) {
      Alert.alert('Wachtwoord ontbreekt', 'Stel een testmelding-wachtwoord in de app config in.');
      return;
    }

    if (testPassword !== TEST_NOTIFICATION_PASSWORD) {
      Alert.alert('Onjuist wachtwoord', 'Controleer het wachtwoord en probeer opnieuw.');
      return;
    }

    const targetDay = days.find(d => d.datum.toISOString() === selectedTestDayId);
    if (targetDay) {
      await sendTestNotificationForDay(targetDay);
      setTestPassword('');
      setTestPickerVisible(false);
      setSettingsVisible(false);
      Alert.alert('Verstuurd', 'Testmelding staat klaar (binnen enkele seconden).');
    }
  };

  const openTestPicker = () => {
    const fallbackId =
      selectedTestDayId ||
      dayId ||
      (days[0] ? days[0].datum.toISOString() : null);
    if (fallbackId) {
      setSelectedTestDayId(fallbackId);
    }
    setTestPassword('');
    setSettingsVisible(false);
    setTestPickerVisible(true);
  };

  useEffect(() => {
    Animated.timing(sidebarAnim.current, {
      toValue: sidebarOpen ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [sidebarOpen]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (isPreviewOpen) return false;
          const { dx, dy } = gestureState;
          return Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 16;
        },
        onPanResponderRelease: (_, { dx, vx }) => {
          if (isPreviewOpen) return;
          const enoughDistance = Math.abs(dx) > 40;
          const enoughVelocity = Math.abs(vx) > 0.15;
          if (!(enoughDistance || enoughVelocity)) return;
          if (dx > 0 && prevDay) {
            goToDay(prevDay.datum.toISOString(), 'prev');
          } else if (dx < 0 && nextDay) {
            goToDay(nextDay.datum.toISOString(), 'next');
          }
        },
      }),
    [goToDay, isPreviewOpen, nextDay, prevDay]
  );

  const handleDial = async (value: string) => {
    const normalized = value.replace(/[^0-9+]/g, '');
    const url = `tel:${normalized}`;
    if (await Linking.canOpenURL(url)) {
      Linking.openURL(url);
    }
  };

  const sidebarTranslate = sidebarAnim.current.interpolate({
    inputRange: [0, 1],
    outputRange: [320, 0],
  });
  const sidebarPaddingTop = insets.top + Spacing.md;

  return (
    <>
      <Stack.Screen
        options={{
          title: dateStr,
          headerShown: false,
          animation: dir === 'prev' ? 'slide_from_left' : 'slide_from_right',
          gestureEnabled: false,
        }}
      />

      <Modal
        visible={settingsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Acties</Text>
            <TouchableOpacity style={styles.modalButton} onPress={handleReload}>
              <Text style={styles.modalButtonText}>Herladen standaardplanning</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={openTestPicker}
            >
              <Text style={styles.modalButtonText}>Testmelding versturen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSettingsVisible(false)}>
              <Text style={styles.modalCloseText}>Sluiten</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={testPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTestPickerVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + 40}
          style={styles.flex}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.pickerCard}>
              <Text style={styles.modalTitle}>Kies dag voor testmelding</Text>
              <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {days.map(d => {
                const id = d.datum.toISOString();
                const label = `${d.datum.getDate()} ${getMonthName(d.datum.getMonth())} — ${d.stadRegio}`;
                const isSelected = selectedTestDayId === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.pickerRow, isSelected && styles.pickerRowSelected]}
                    onPress={() => setSelectedTestDayId(id)}
                  >
                    <View style={[styles.radio, isSelected && styles.radioSelected]} />
                    <Text style={styles.pickerLabel}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
              </ScrollView>
              <View style={styles.pickerInputGroup}>
                <Text style={styles.pickerInputLabel}>Wachtwoord</Text>
                <TextInput
                  value={testPassword}
                  onChangeText={setTestPassword}
                  placeholder="Voer wachtwoord in"
                  secureTextEntry
                  placeholderTextColor={colors.muted}
                  style={[styles.pickerInput, { borderColor: colors.border, color: colors.textPrimary }]}
                />
              </View>
              <View style={styles.pickerActions}>
                <TouchableOpacity style={styles.pickerSecondary} onPress={() => setTestPickerVisible(false)}>
                  <Text style={styles.modalCloseText}>Annuleren</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pickerPrimary, !selectedTestDayId && { opacity: 0.4 }]}
                  disabled={!selectedTestDayId || !testPassword}
                  onPress={handleSendTestNotification}
                >
                  <Text style={styles.pickerPrimaryText}>Verstuur test</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <View style={styles.screenShell} {...panResponder.panHandlers}>
        <Animated.ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingTop: actionBarOffset }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
        {heroImage && (
          <PreviewableImage
            source={heroImage}
            style={styles.heroImage}
            onPreviewVisibilityChange={setIsPreviewOpen}
            overlay={
              <View style={styles.heroOverlay}>
                <Text style={styles.heroDayName}>{day.dagNaam}</Text>
                <Text style={styles.heroLocation}>{day.stadRegio}</Text>
                <Text style={styles.heroDate}>{dateStr}</Text>
              </View>
            }
          />
        )}

        <View style={styles.header}>
          <View style={styles.dayNav}>
            <TouchableOpacity
              style={[styles.navChip, !prevDay && styles.navChipDisabled]}
              disabled={!prevDay}
              onPress={() => prevDay && goToDay(prevDay.datum.toISOString(), 'prev')}
            >
              <Text style={[styles.navChipText, !prevDay && styles.navChipTextDisabled]}>
                ← {prevDay ? formatShortDate(prevDay.datum) : 'Vorige'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navChip, !nextDay && styles.navChipDisabled]}
              disabled={!nextDay}
              onPress={() => nextDay && goToDay(nextDay.datum.toISOString(), 'next')}
            >
              <Text style={[styles.navChipText, !nextDay && styles.navChipTextDisabled]}>
                {nextDay ? formatShortDate(nextDay.datum) : 'Volgende'} →
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.headerInfo}>
            {!heroImage && (
              <>
                <Text style={styles.dayName}>{day.dagNaam}</Text>
                <Text style={styles.location}>{day.stadRegio}</Text>
              </>
            )}
          </View>
          
          {day.verblijf && day.verblijf !== 'x' && (
            <View style={styles.accommodation}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push(`/accommodation/${encodeURIComponent(day.verblijf)}` as any)}
              >
                {accommodationMedia?.image && (
                  <PreviewableImage
                    source={
                      typeof accommodationMedia.image === 'string'
                        ? { uri: accommodationMedia.image }
                        : accommodationMedia.image
                    }
                    style={styles.accommodationImage}
                    onPreviewVisibilityChange={setIsPreviewOpen}
                    accessibilityLabel={`Afbeelding van ${day.verblijf}`}
                  />
                )}
                <Text style={styles.accommodationLabel}>Verblijf</Text>
                <Text style={styles.accommodationName}>{day.verblijf}</Text>
              </TouchableOpacity>
              <View style={styles.accommodationActions}>
                {day.verblijfMapsLink && day.verblijfMapsLink !== 'x' && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleOpenMaps(day.verblijfMapsLink)}
                  >
                    <MapPin size={16} color={colors.primary} />
                    <Text style={styles.actionButtonText}>Kaart</Text>
                  </TouchableOpacity>
                )}
                {day.verblijfLink && day.verblijfLink !== 'x' && day.verblijfLink.toLowerCase() !== 'unknown' && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => Linking.openURL(day.verblijfLink)}
                  >
                    <ExternalLink size={16} color={colors.primary} />
                    <Text style={styles.actionButtonText}>Link</Text>
                  </TouchableOpacity>
                )}
              </View>
              {roomAssignments.length > 0 && (
                <>
                  <TouchableOpacity
                    style={styles.roomToggle}
                    onPress={() => setRoomsExpanded(prev => !prev)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.roomToggleText}>Kamerindeling</Text>
                    <ChevronDown
                      size={18}
                      color={colors.primary}
                      style={roomsExpanded ? styles.chevronOpen : undefined}
                    />
                  </TouchableOpacity>
                  {roomsExpanded && (
                    <View style={styles.roomList}>
                      {roomAssignments.map((room, idx) => (
                        <View key={`${room}-${idx}`} style={styles.roomRow}>
                          <Text style={styles.roomIndex}>{idx + 1}.</Text>
                          <Text style={styles.roomText}>{room}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </View>

        {isFreeDay ? (
          <View style={styles.freeDaySection}>
            <Text style={styles.freeDayTitle}>Vrije dag — Flexibele planning</Text>
            <Text style={styles.freeDayIntro}>
              Vandaag is een vrije dag. Er is geen vast programma en iedereen mag zelf bepalen wat hij doet.
              {'\n'}Je kunt samen optrekken, opsplitsen in groepjes of helemaal je eigen plan maken.
            </Text>
            <Text style={styles.freeDaySubtitle}>Kies hieronder een optie voor inspiratie.</Text>

            <View style={styles.segmentControl}>
              {FREE_DAY_TABS.map(tab => {
                const isActive = freeDayTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
                    onPress={() => setFreeDayTab(prev => (prev === tab.key ? null : tab.key))}
                  >
                    <Text style={[styles.segmentLabel, isActive && styles.segmentLabelActive]}>
                      {tab.icon} {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.segmentContent}>
              {freeDayTab ? renderFreeDayContent(freeDayTab, styles) : (
                <Text style={styles.freeDayPlaceholder}>
                  Kies een optie hierboven voor inspiratie.
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.activitiesSection}>
            <Text style={styles.sectionTitle}>Planning</Text>
            {planningItems.map(item => {
              if (item.kind === 'placeGroup') {
                return (
                  <View key={`place-${item.group.group}`} style={styles.placeGroupCard}>
                    {!isMorningGroup(item.group.group) && (
                      <View style={styles.placeGroupHeader}>
                        <Text style={styles.placeGroupTitle}>{item.group.group}</Text>
                      </View>
                    )}
                    {item.group.items.map((place, index) => {
                      const timeLabel = formatTime(place.startTijd);
                      const placeImage = getPlaceImage(place.naam, place.locatie);
                      return (
                        <View key={place.id} style={[styles.placeRow, index > 0 && styles.placeRowDivider]}>
                          {getPlaceEmoji(place.type, place.naam) ? (
                            <View style={styles.placeIcon}>
                              <Text style={styles.placeEmoji}>{getPlaceEmoji(place.type, place.naam)}</Text>
                            </View>
                          ) : null}
                          <View style={styles.placeContent}>
                            {placeImage && (
                              <PreviewableImage
                                source={placeImage}
                                style={[
                                  styles.placeImage,
                                  isHeroPlace(place.naam) && styles.placeImageLarge,
                                ]}
                                onPreviewVisibilityChange={setIsPreviewOpen}
                                accessibilityLabel={place.naam || 'Locatie'}
                              />
                            )}
                            <View style={styles.placeHeaderRow}>
                              <View style={styles.placeTitleWrap}>
                                <Text style={styles.placeName}>{place.naam}</Text>
                                <Text style={styles.placeType}>{getPlaceTypeLabel(place.type)}</Text>
                              </View>
                              {timeLabel && <Text style={styles.placeTime}>{timeLabel}</Text>}
                            </View>
                            {!!place.beschrijving && (
                              <Text style={styles.placeDescription}>{place.beschrijving}</Text>
                            )}
                            {!!place.locations?.length && (
                              <View style={styles.placeLocations}>
                                {place.locations.map(link => (
                                  <TouchableOpacity
                                    key={link.url}
                                    style={styles.placeLocationButton}
                                    onPress={() => Linking.openURL(link.url)}
                                  >
                                    <MapPin size={14} color={colors.primary} />
                                    <Text style={styles.placeLocationText}>{link.label}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                            {(!place.locations?.length && place.locatie && place.locatie !== 'x') && (
                              <TouchableOpacity
                                style={styles.placeDetail}
                                activeOpacity={place.mapsLink ? 0.7 : 1}
                                onPress={() => {
                                  if (place.mapsLink && place.mapsLink !== 'x') {
                                    Linking.openURL(place.mapsLink);
                                  }
                                }}
                              >
                                <MapPin size={14} color={place.mapsLink ? colors.primary : colors.textSecondary} />
                                <Text style={[styles.placeDetailText, place.mapsLink && styles.placeDetailLink]}>
                                  {place.locatie}
                                </Text>
                                {place.mapsLink && <ExternalLink size={14} color={colors.primary} />}
                              </TouchableOpacity>
                            )}
                            {!!place.links?.length && (
                              <View style={styles.placeLinks}>
                                {place.links.map(link => (
                                  <TouchableOpacity
                                    key={link.url}
                                    style={styles.placeLinkButton}
                                    onPress={() => Linking.openURL(link.url)}
                                  >
                                    <Text style={styles.placeLinkText}>{link.label}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              }

              const activity = item.activity;
              const displayTime = activity.verzamelTijd || activity.startTijd;
              const isFlight = activity.type === 'flight';
              const isSpecialEventActivity = activity.type === 'event';
              const firstEventId = day.activiteiten.find(a => a.type === 'event')?.id;
              const isSpecialEventMainDay = isSpecialEventActivity && firstEventId === activity.id;
              const departureTime = isFlight ? activity.startTijd || activity.verzamelTijd : displayTime;
              const timeStr = departureTime
                ? `${String(departureTime.getHours()).padStart(2, '0')}:${String(departureTime.getMinutes()).padStart(2, '0')}`
                : 'TBA';
              const activityImage = getActivityImage(activity);
              const description = formatActivityDescription(activity, day);
              const descriptionLines = description
                ? description
                    .split(/\r?\n+/)
                    .map(line => line.trim())
                    .filter(Boolean)
                : [];
              const statLines = descriptionLines.filter(
                line =>
                  line.startsWith('Afstand:') ||
                  line.startsWith('Duur:') ||
                  line.startsWith('Hoogtemeters:')
              );
              const narrativeLines = descriptionLines.filter(line => !statLines.includes(line));
              const departureLocation = getDepartureLocation(activity.vertrekVanaf, day.verblijf);
              const activityLink = getActivityLink(activity);
              const parsedFlightDetails = isFlight ? extractFlightDetailsFromDescription(activity.beschrijving) : null;
              const isAirportFlight = isFlight;
              const nextFlight = isFlight ? findNextFlight(day.activiteiten, day.activiteiten.indexOf(activity)) : null;
              const layoverMinutes = isFlight ? getFlightLayoverMinutes(activity, nextFlight) : null;
              const layoverText = layoverMinutes ? `Overstap ${formatMinutesLabel(layoverMinutes)}` : null;
              const flightDurationText =
                activity.reisTijd ? `Duur ${formatMinutesLabel(activity.reisTijd)}` : parsedFlightDetails?.duration || null;
              const parsedDepartureTime = parsedFlightDetails?.departure
                ? extractTimeFromFlightDetail(parsedFlightDetails.departure)
                : null;
              const parsedDepartureMeta = parsedFlightDetails?.departure
                ? stripTimeFromFlightDetail(parsedFlightDetails.departure)
                : null;
              const departureTimeStr = parsedDepartureTime || (activity.startTijd ? formatTime(activity.startTijd) : timeStr);
              const arrivalTime = isFlight ? getFlightArrivalTime(activity) : null;
              const parsedArrivalTime = parsedFlightDetails?.arrival
                ? extractTimeFromFlightDetail(parsedFlightDetails.arrival)
                : null;
              const parsedArrivalMeta = parsedFlightDetails?.arrival
                ? stripTimeFromFlightDetail(parsedFlightDetails.arrival)
                : null;
              const arrivalTimeStr = parsedArrivalTime || (arrivalTime ? formatTime(arrivalTime) : null);

              if (isSpecialEventMainDay) {
                return (
                  <View key={activity.id} style={[styles.activityCard, styles.specialEventSection]}>
                    {activityImage ? (
                      <PreviewableImage
                        source={activityImage}
                        style={styles.specialEventImage}
                        onPreviewVisibilityChange={setIsPreviewOpen}
                        accessibilityLabel="Event afbeelding"
                      />
                    ) : (
                      <View style={styles.specialEventImagePlaceholder}>
                        <Text style={styles.specialEventImageText}>Event</Text>
                      </View>
                    )}
                    <View style={styles.specialEventHeader}>
                      <Text style={styles.activityEmoji}>🎉</Text>
                      <View style={styles.specialEventHeaderText}>
                        <Text style={[styles.sectionTitle, styles.specialEventTitle]}>Speciale activiteit</Text>
                        <Text style={[styles.activityTime, styles.specialEventTime]}>07:00</Text>
                      </View>
                    </View>
                    <Text style={styles.specialEventIntro}>
                      Een grote gezamenlijke activiteit met meerdere opties. Kies een route voor de details:
                    </Text>
                    <View style={styles.segmentControl}>
                      {SPECIAL_EVENT_TABS.map(tab => {
                        const isActive = specialEventTab === tab.key;
                        return (
                          <TouchableOpacity
                            key={tab.key}
                            style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
                            onPress={() => setSpecialEventTab(prev => (prev === tab.key ? null : tab.key))}
                          >
                            <Text style={[styles.segmentLabel, isActive && styles.segmentLabelActive]}>
                              {tab.icon} {tab.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View style={styles.segmentContent}>
                      {specialEventTab ? (
                        renderSpecialEventContent(specialEventTab, styles)
                      ) : (
                        <Text style={styles.specialEventPlaceholder}>Tik een optie voor details.</Text>
                      )}
                    </View>
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={activity.id}
                  style={styles.activityCard}
                  activeOpacity={0.7}
                >
                  {activityImage && (
                    <PreviewableImage
                      source={activityImage}
                      style={styles.activityImage}
                      onPreviewVisibilityChange={setIsPreviewOpen}
                      accessibilityLabel={activity.naam || 'Activiteit'}
                    />
                  )}
                  <View style={styles.activityHeader}>
                    <Text style={styles.activityEmoji}>{getActivityEmoji(activity.type)}</Text>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityName}>{activity.naam}</Text>
                      <Text style={styles.activityTime}>{timeStr}</Text>
                    </View>
                  </View>

                  {narrativeLines.length > 0 && (
                    <View style={styles.activityDescriptionBlock}>
                      {narrativeLines.map((para, idx) => (
                        <Text
                          key={`${activity.id}-para-${idx}`}
                          style={styles.activityDescription}
                        >
                          {para}
                        </Text>
                      ))}
                    </View>
                  )}

                  {statLines.length > 0 && (
                    <View style={styles.statCard}>
                      {statLines.map(line => {
                        const [label, value] = line.split(':').map(part => part.trim());
                        return (
                          <View key={`${activity.id}-${label}`} style={styles.statRow}>
                            <Text style={styles.statLabel}>{label}</Text>
                            <Text style={styles.statValue}>{value}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {isFlight && (
                    <View style={styles.flightBadge}>
                      <Text style={styles.flightBadgeText}>
                        Alle tijden lokaal
                      </Text>
                    </View>
                  )}

                  {parsedFlightDetails && (
                    <View style={styles.flightDetailCard}>
                      <View style={styles.flightHeaderRow}>
                        <Text style={styles.flightNumber}>{activity.naam}</Text>
                        {flightDurationText && <Text style={styles.flightDurationChip}>{flightDurationText}</Text>}
                      </View>
                      <View style={styles.flightTimesRow}>
                        <View style={styles.flightTimeBox}>
                          <Text style={styles.flightTimeLabel}>Vertrek</Text>
                          <Text style={styles.flightTimeValue}>{departureTimeStr}</Text>
                          {parsedDepartureMeta && (
                            <Text style={styles.flightTimeMeta}>{parsedDepartureMeta}</Text>
                          )}
                        </View>
                        <View style={styles.flightTimeBox}>
                          <Text style={styles.flightTimeLabel}>Aankomst</Text>
                          <Text style={styles.flightTimeValue}>{arrivalTimeStr || 'TBA'}</Text>
                          {parsedArrivalMeta && (
                            <Text style={styles.flightTimeMeta}>{parsedArrivalMeta}</Text>
                          )}
                        </View>
                      </View>
                      {layoverText && (
                        <Text style={styles.flightDetailText}>{layoverText}</Text>
                      )}
                      {parsedFlightDetails.status && (
                        <Text style={styles.flightDetailStatus}>{parsedFlightDetails.status}</Text>
                      )}
                    </View>
                  )}

                  {isAirportFlight && (
                    <View style={styles.timeslotCard}>
                      <View style={styles.timeslotHeader}>
                        <Text style={styles.timeslotTitle}>Security tijdslot</Text>
                        <TouchableOpacity
                          style={styles.timeslotButton}
                          onPress={() => Linking.openURL(SECURITY_TIMESLOT_LINK)}
                        >
                          <Text style={styles.timeslotButtonText}>Slot boeken</Text>
                        </TouchableOpacity>
                      </View>
                      {SECURITY_TIMESLOT_TIPS.map(tip => (
                        <View key={tip.title} style={styles.timeslotTip}>
                          <Text style={styles.timeslotTipTitle}>{tip.title}</Text>
                          <Text style={styles.timeslotTipBody}>{tip.body}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {activity.locatie && activity.locatie !== 'x' && activity.locatie.toLowerCase() !== 'tba' && (
                    <TouchableOpacity
                      style={styles.activityDetail}
                      activeOpacity={activityLink ? 0.7 : 1}
                      onPress={() => {
                        if (activityLink) {
                          Linking.openURL(activityLink);
                        }
                      }}
                    >
                      <MapPin size={14} color={activityLink ? colors.primary : colors.textSecondary} />
                      <Text style={[styles.activityDetailText, activityLink && styles.activityDetailLink]}>
                        {activity.locatie}
                      </Text>
                      {activityLink && <ExternalLink size={14} color={colors.primary} />}
                    </TouchableOpacity>
                  )}

                  {activity.vervoer && activity.vervoer !== 'x' && (
                    <View style={styles.activityDetail}>
                      <Navigation size={14} color={colors.textSecondary} />
                      <Text style={styles.activityDetailText}>
                        {activity.vervoer}
                        {activity.reisTijd && ` • ${formatTravelTime(activity.reisTijd)}`}
                      </Text>
                    </View>
                  )}

                  {departureLocation && (
                    <View style={styles.activityDetail}>
                      <Clock size={14} color={colors.textSecondary} />
                      <Text style={styles.activityDetailText}>
                        Vertrek vanaf {departureLocation}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        </Animated.ScrollView>
        {!sidebarOpen && (
          <FloatingActions
            showSettings={false}
            showLifeBuoy={false}
            showSpotify
            spotifyUrl={SPOTIFY_PLAYLIST_URL}
            animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
          />
        )}

        <View pointerEvents="box-none" style={styles.floatingNav}>
          <TouchableOpacity
            style={[styles.floatingButton, !prevDay && styles.floatingButtonDisabled]}
            disabled={!prevDay}
            onPress={() => prevDay && goToDay(prevDay.datum.toISOString(), 'prev')}
            accessibilityLabel="Vorige dag"
          >
            <ChevronLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.floatingButton, !nextDay && styles.floatingButtonDisabled]}
            disabled={!nextDay}
            onPress={() => nextDay && goToDay(nextDay.datum.toISOString(), 'next')}
            accessibilityLabel="Volgende dag"
          >
            <ChevronRight size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {sidebarOpen && (
          <TouchableOpacity
            style={styles.sidebarScrim}
            activeOpacity={1}
            onPress={() => setSidebarOpen(false)}
          />
        )}
        <Animated.View
          style={[
            styles.sidebar,
            { transform: [{ translateX: sidebarTranslate }], paddingTop: sidebarPaddingTop },
          ]}
        >
          <View style={styles.sidebarHeader}>
            <View>
              <Text style={styles.sidebarEyebrow}>In case of emergency</Text>
              <Text style={styles.sidebarTitle}>ICE informatie</Text>
            </View>
            <TouchableOpacity style={styles.sidebarClose} onPress={() => setSidebarOpen(false)}>
              <X size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sidebarScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.sidebarCard}>
              <Text style={styles.sidebarSectionTitle}>Noodnummers</Text>
              {[
                { label: 'Alarmnummer', value: '190' },
                { label: 'Ambulance', value: '192' },
                { label: 'Brandweer', value: '193' },
              ].map(item => (
                <TouchableOpacity
                  key={item.value}
                  style={styles.sidebarRow}
                  activeOpacity={0.75}
                  onPress={() => handleDial(item.value)}
                >
                  <Text style={styles.sidebarRowLabel}>{item.label}</Text>
                  <Text style={styles.sidebarRowValue}>{item.value}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sidebarCard}>
              <Text style={styles.sidebarSectionTitle}>Noodinformatie</Text>
              <Text style={styles.sidebarBody}>
                Ambassade (placeholder){'\n'}
                Example Street 1{'\n'}
                0000 AB, Stad
              </Text>
              <TouchableOpacity
                style={[styles.sidebarRow, styles.sidebarRowTight]}
                activeOpacity={0.75}
                onPress={() => handleDial('+000000000')}
              >
                <Text style={styles.sidebarRowLabel}>Telefoon (24/7)</Text>
                <Text style={styles.sidebarRowValue}>+00 000000000</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sidebarCard}>
              <Text style={styles.sidebarSectionTitle}>Lokale arts</Text>
              <Text style={styles.sidebarBody}>
                Arts (placeholder){'\n'}
                Example Street 2, Stad
              </Text>
              <TouchableOpacity
                style={styles.sidebarRow}
                activeOpacity={0.75}
                onPress={() => handleDial('+000000001')}
              >
                <Text style={styles.sidebarRowLabel}>Telefoon</Text>
                <Text style={styles.sidebarRowValue}>+00 000000001</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sidebarRow}
                activeOpacity={0.75}
                onPress={() => handleDial('+000000002')}
              >
                <Text style={styles.sidebarRowLabel}>Alternatief</Text>
                <Text style={styles.sidebarRowValue}>+00 000000002</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sidebarCard}>
              <Text style={styles.sidebarSectionTitle}>Lokale tandarts</Text>
              <Text style={styles.sidebarBody}>
                Tandarts (placeholder){'\n'}
                Example Street 3, Stad
              </Text>
              <TouchableOpacity
                style={styles.sidebarRow}
                activeOpacity={0.75}
                onPress={() => handleDial('+000000003')}
              >
                <Text style={styles.sidebarRowLabel}>Telefoon</Text>
                <Text style={styles.sidebarRowValue}>+00 000000003</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sidebarRow}
                activeOpacity={0.75}
                onPress={() => handleDial('+000000004')}
              >
                <Text style={styles.sidebarRowLabel}>Alternatief</Text>
                <Text style={styles.sidebarRowValue}>+00 000000004</Text>
              </TouchableOpacity>
              <Text style={styles.sidebarEmail}>info@example.com</Text>
            </View>

            <View style={styles.sidebarCard}>
              <Text style={styles.sidebarSectionTitle}>Ziekenhuizen</Text>
              <Text style={styles.sidebarBody}>
                Ziekenhuis A{'\n'}
                Example Street 4, Stad
              </Text>
              <TouchableOpacity
                style={styles.sidebarRow}
                activeOpacity={0.75}
                onPress={() => handleDial('+000000005')}
              >
                <Text style={styles.sidebarRowLabel}>Telefoon</Text>
                <Text style={styles.sidebarRowValue}>+00 000000005</Text>
              </TouchableOpacity>
              <View style={styles.sidebarDivider} />
              <Text style={styles.sidebarBody}>
                Ziekenhuis B{'\n'}
                Example Street 5, Stad
              </Text>
              <TouchableOpacity
                style={styles.sidebarRow}
                activeOpacity={0.75}
                onPress={() => handleDial('+000000006')}
              >
                <Text style={styles.sidebarRowLabel}>Telefoon</Text>
                <Text style={styles.sidebarRowValue}>+00 000000006</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </>
  );
}

function getMonthName(month: number): string {
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return months[month];
}

function getActivityEmoji(type: string): string {
  const emojiMap: Record<string, string> = {
    travel: '🚐',
    tour: '🗺️',
    hike: '🥾',
    event: '🎉',
    free_day: '🧘',
    flight: '✈️',
  };
  return emojiMap[type] || '📍';
}

function getPlaceEmoji(type: string, name?: string): string {
  const emojiMap: Record<string, string> = {
    food: '🍴',
    drink: '🍹',
    nightlife: '🌙',
    logistics: '🧭',
    spot: '📍',
    other: '✨',
  };
  return emojiMap[type] || '✨';
}

function getPlaceTypeLabel(type: string): string {
  const labelMap: Record<string, string> = {
    food: 'Restaurant',
    drink: 'Drinks',
    nightlife: 'Avond',
    logistics: 'Plan',
    spot: 'Spot',
    other: 'Overig',
  };
  return labelMap[type] || 'Overig';
}

function getPlaceGroupOrder(group: string): number {
  const normalized = group.toLowerCase();
  if (normalized.includes('ochtend')) return 1;
  if (normalized.includes('lunch')) return 2;
  if (normalized.includes('middag')) return 3;
  if (normalized.includes('avond')) return 4;
  if (normalized.includes('nacht')) return 5;
  return 10;
}

function isMorningGroup(group: string): boolean {
  return group.toLowerCase().includes('ochtend');
}

function isHeroPlace(_: string | undefined): boolean {
  return false;
}

function formatTime(date: Date | null): string | null {
  if (!date) return null;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatActivityDescription(activity: Activity, day: Day): string {
  if (!activity.beschrijving) return '';

  const gatherTime = formatTime(activity.verzamelTijd);
  const startTime = formatTime(activity.startTijd);
  const departure = getDepartureLocation(activity.vertrekVanaf, day.verblijf) || day.verblijf || 'het verblijf';

  let description = activity.beschrijving;
  description = description.replace(/\[Verzameltijd\]/gi, gatherTime ? `${gatherTime} ` : '');
  description = description.replace(/\[Starttijd\]/gi, startTime || 'TBA');
  description = description.replace(/\[Vertrek vanaf\]/gi, departure);

  return description.trim();
}

function formatTravelTime(minutes: number): string {
  if (minutes <= 0) {
    return '0 minuten';
  }

  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minuut' : 'minuten'}`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  const hourLabel = `${hours} ${hours === 1 ? 'uur' : 'uur'}`;

  if (remaining === 0) {
    return hourLabel;
  }

  return `${hourLabel} en ${remaining} ${remaining === 1 ? 'minuut' : 'minuten'}`;
}

function getDepartureLocation(value: string | null | undefined, fallback?: string): string | null {
  if (!value || value === 'x') {
    return fallback || null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'verblijf' && fallback) {
    return fallback;
  }
  return value;
}

function renderSpecialEventContent(selected: SpecialEventOptionKey, styles: ReturnType<typeof createStyles>) {
  const option = SPECIAL_EVENT_OPTIONS.find(opt => opt.key === selected);
  if (!option) return null;

  return (
    <View style={styles.specialEventCard}>
      <Text style={styles.specialEventCardTitle}>{option.title}</Text>
      <Text style={styles.specialEventBody}>{option.body}</Text>
      <View style={styles.specialEventInfoList}>
        {option.details.map(detail => (
          <Text key={detail} style={styles.specialEventInfo}>{detail}</Text>
        ))}
      </View>
      <View style={styles.specialEventLinks}>
        {option.links.map((link, idx) => (
          <TouchableOpacity
            key={link.url}
            style={[
              styles.specialEventLinkButton,
              idx === 0 ? styles.specialEventLinkPrimary : styles.specialEventLinkSecondary,
            ]}
            onPress={() => Linking.openURL(link.url)}
          >
            <Text
              style={[
                styles.specialEventLinkText,
                idx === 0 ? styles.specialEventLinkTextPrimary : styles.specialEventLinkTextSecondary,
              ]}
            >
              {link.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {option.note ? <Text style={styles.specialEventNote}>{option.note}</Text> : null}
    </View>
  );
}

type FreeDayTabKey = 'fishing' | 'hike' | 'beach' | 'custom';

const FREE_DAY_TABS: { key: FreeDayTabKey; label: string; icon: string }[] = [
  { key: 'fishing', label: 'Vissen', icon: '🎣' },
  { key: 'hike', label: 'Hike', icon: '🥾' },
  { key: 'beach', label: 'Strand', icon: '🏖' },
  { key: 'custom', label: 'Eigen plan', icon: '🤷' },
];

const HIKE_OPTIONS = [
  {
    key: 'lopes',
    title: 'Trail A (voorbeeldroute)',
    summary: '⭐ 4,6 (120 recensies)',
    details: ['Afstand: 12 km', 'Hoogteverschil: 650 m', 'Duur: 4–5 uur', 'Niveau: Gemiddeld', 'Type: Heen en terug'],
    description:
      'Een voorbeeldroute met geanonimiseerde details. De beschrijving is generiek en bevat geen locatiegegevens.',
    extra: ['Zwaarste stuk: middensectie', 'Terug: dezelfde route'],
    link: 'https://example.com/trail-a',
  },
  {
    key: 'papagaio',
    title: 'Trail B (uitdagend)',
    summary: '⭐ 4,7 (85 recensies)',
    details: ['Afstand: 10 km', 'Hoogteverschil: 900 m', 'Niveau: Zwaar'],
    description:
      'Een uitdagende route met steilere stukken. Gebruik deze kaart als placeholder voor eigen data.',
    extra: [],
    link: 'https://example.com/trail-b',
  },
  {
    key: 'feiticeira',
    title: 'Trail C (natuur)',
    summary: '⭐ 4,5 (60 recensies)',
    details: ['Afstand: 8 km', 'Duur: 3–3,5 uur', 'Niveau: Zwaar'],
    description:
      'Generieke beschrijving van een natuurroute met een paar uitzichtpunten.',
    extra: ['Terugkeer via dezelfde route'],
    link: 'https://example.com/trail-c',
  },
];

function renderFreeDayContent(selected: FreeDayTabKey, styles: ReturnType<typeof createStyles>) {
  switch (selected) {
    case 'fishing':
      return (
        <View style={styles.freeDayCard}>
          <Text style={styles.freeDayCardTitle}>Vistour vanaf de pier</Text>
          <Text style={styles.freeDayBody}>
            Informele activiteit met flexibele planning. Geen reserveringen en geen vaste tijden — stem ter plekke af wat er mogelijk is.
          </Text>
          <View style={styles.freeDayInfoList}>
            <Text style={styles.freeDayInfo}>Startpunt: Verzamelpunt bij de haven</Text>
            <Text style={styles.freeDayInfo}>Regelen: Ter plekke</Text>
            <Text style={styles.freeDayInfo}>Groepsgrootte: Klein clubje</Text>
            <Text style={styles.freeDayInfo}>Duur: Flexibel</Text>
          </View>
        </View>
      );
    case 'hike':
      return (
        <View style={styles.freeDayCard}>
          <Text style={styles.freeDayCardTitle}>Hiken op de vrije dag</Text>
          <Text style={styles.freeDayBody}>
            Er zijn meerdere routes beschikbaar, variërend van licht tot zwaar.
            Kies wat past bij de groep en de dagplanning.
          </Text>
          <Text style={styles.freeDaySubheader}>Populaire hikes</Text>
          {HIKE_OPTIONS.map(hike => (
            <View key={hike.key} style={styles.hikeCard}>
              <Text style={styles.hikeTitle}>{hike.title}</Text>
              <Text style={styles.hikeSummary}>{hike.summary}</Text>
              {hike.details.map(detail => (
                <Text key={detail} style={styles.hikeDetail}>{detail}</Text>
              ))}
              <Text style={styles.hikeDescription}>{hike.description}</Text>
              {hike.extra.map(line => (
                <Text key={line} style={styles.hikeExtra}>{line}</Text>
              ))}
              <View style={styles.freeDayActions}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => Linking.openURL(hike.link)}
                >
                  <Text style={styles.primaryButtonText}>Open in AllTrails</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={styles.freeDayLink}
            onPress={() =>
              Linking.openURL(
                'https://example.com/all-trails'
              )
            }
          >
            <Text style={styles.freeDayLinkText}>Bekijk alle routes (placeholder)</Text>
          </TouchableOpacity>
        </View>
      );
    case 'beach':
      return (
        <View style={styles.freeDayCard}>
          <Text style={styles.freeDayCardTitle}>Stranddag</Text>
          <Text style={styles.freeDayBody}>
            Vandaag is perfect om gewoon te ontspannen. Zwemmen, zonnen, boek lezen of een drankje halen — zonder planning.
          </Text>
          <View style={styles.freeDayInfoList}>
            <Text style={styles.freeDayInfo}>• Strand bij de haven</Text>
            <Text style={styles.freeDayInfo}>• Met een bootje naar een rustiger strand</Text>
            <Text style={styles.freeDayInfo}>• Hangmat + schaduw + niks moeten</Text>
          </View>
        </View>
      );
    case 'custom':
      return (
        <View style={styles.freeDayCard}>
          <Text style={styles.freeDayCardTitle}>Eigen invulling</Text>
          <Text style={styles.freeDayBody}>
            Heb je zelf een idee of ontstaat er spontaan iets anders? Helemaal goed. Vandaag is volledig vrij.
          </Text>
          <Text style={styles.freeDayBody}>
            Spreek met anderen af, sluit je ergens bij aan of doe lekker je eigen ding. Geen schema, geen verantwoording.
          </Text>
        </View>
      );
    default:
      return null;
  }
}

function extractFlightDetailsFromDescription(description?: string) {
  if (!description) return null;
  const departureMatch = description.match(/Vertrek\s([^,]+),/i);
  const arrivalMatch = description.match(/aankomst\s([^.]+)\./i);
  const durationMatch = description.match(/Duur\s([^.]+)\./i);
  const statusMatch = description.match(/Status:\s*([^.]+)/i);
  return {
    departure: departureMatch ? `Vertrek ${departureMatch[1].trim()}` : null,
    arrival: arrivalMatch ? `Aankomst ${arrivalMatch[1].trim()}` : null,
    duration: durationMatch ? `Duur ${durationMatch[1].trim()}` : null,
    status: statusMatch ? `Status: ${statusMatch[1].trim()}` : null,
  };
}

function extractTimeFromFlightDetail(detail?: string): string | null {
  if (!detail) return null;
  const match = detail.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!match) return null;
  const hours = match[1].padStart(2, '0');
  return `${hours}:${match[2]}`;
}

function stripTimeFromFlightDetail(detail?: string): string | null {
  if (!detail) return null;
  const cleaned = detail
    .replace(/^Aankomst\s*/i, '')
    .replace(/\b\d{1,2}:\d{2}\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s([,.)])/g, '$1')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

function findNextFlight(activities: Activity[], currentIndex: number): Activity | null {
  for (let i = currentIndex + 1; i < activities.length; i++) {
    if (activities[i].type === 'flight') {
      return activities[i];
    }
  }
  return null;
}

const createStyles = (palette: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  screenShell: {
    flex: 1,
    backgroundColor: palette.background,
  },
  heroImage: {
    height: 220,
    margin: Spacing.md,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    padding: Spacing.md,
  },
  heroDayName: {
    color: palette.surface,
    fontSize: Typography.body,
    marginBottom: Spacing.xs,
  },
  heroLocation: {
    color: palette.surface,
    fontSize: 28,
    fontWeight: '700',
  },
  heroDate: {
    color: palette.surface,
    fontSize: Typography.body,
    marginTop: Spacing.xs,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.background,
  },
  errorText: {
    fontSize: 17,
    color: palette.textSecondary,
  },
  header: {
    backgroundColor: palette.surface,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  dayNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  navChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: palette.background,
  },
  navChipDisabled: {
    opacity: 0.4,
  },
  navChipText: {
    fontSize: Typography.label,
    fontWeight: '600',
    color: palette.primary,
  },
  navChipTextDisabled: {
    color: palette.textSecondary,
  },
  headerInfo: {
    marginBottom: Spacing.md,
  },
  dayName: {
    fontSize: Typography.body,
    color: palette.textSecondary,
    marginBottom: Spacing.xs,
  },
  location: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: palette.textPrimary,
  },
  accommodation: {
    backgroundColor: palette.background,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  accommodationImage: {
    width: '100%',
    height: 140,
    borderRadius: Radius.sm,
    marginBottom: Spacing.sm,
  },
  accommodationLabel: {
    fontSize: Typography.label,
    color: palette.textSecondary,
    marginBottom: Spacing.xs,
  },
  accommodationName: {
    fontSize: Typography.body,
    fontWeight: '600' as const,
    color: palette.textPrimary,
    marginBottom: Spacing.xs,
  },
  accommodationActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  roomToggle: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderColor: palette.border,
  },
  roomToggleText: {
    fontSize: Typography.body,
    color: palette.primary,
    fontWeight: '600' as const,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  roomList: {
    marginTop: Spacing.xs,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  roomIndex: {
    width: 20,
    color: palette.textSecondary,
    fontSize: Typography.label,
  },
  roomText: {
    fontSize: Typography.body,
    color: palette.textPrimary,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: palette.surface,
    borderRadius: Radius.sm,
  },
  actionButtonText: {
    fontSize: Typography.body,
    color: palette.primary,
    fontWeight: '500' as const,
  },
  floatingNav: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    transform: [{ translateY: -24 }],
  },
  floatingButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    opacity: 0.82,
  },
  floatingButtonDisabled: {
    opacity: 0.4,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 320,
    backgroundColor: palette.surface,
    padding: Spacing.md,
    paddingTop: Spacing.lg - 2,
    borderLeftWidth: 1,
    borderColor: palette.border,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  sidebarScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sidebarEyebrow: {
    fontSize: Typography.caption,
    color: palette.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sidebarTitle: {
    fontSize: Typography.title,
    fontWeight: '700' as const,
    color: palette.textPrimary,
  },
  sidebarClose: {
    padding: Spacing.xs,
  },
  sidebarScroll: {
    marginTop: Spacing.xs,
  },
  sidebarCard: {
    backgroundColor: palette.background,
    borderRadius: Radius.md,
    padding: Spacing.sm + 4,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: Spacing.sm,
  },
  sidebarSectionTitle: {
    fontSize: Typography.section,
    fontWeight: '700' as const,
    color: palette.textPrimary,
    marginBottom: Spacing.xs,
  },
  sidebarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  sidebarRowTight: {
    paddingVertical: Spacing.xs,
  },
  sidebarRowLabel: {
    fontSize: Typography.label,
    color: palette.textSecondary,
  },
  sidebarRowValue: {
    fontSize: Typography.body,
    fontWeight: '700' as const,
    color: palette.primary,
  },
  sidebarBody: {
    fontSize: Typography.body,
    color: palette.textPrimary,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  sidebarEmail: {
    fontSize: Typography.body,
    color: palette.primary,
    marginTop: Spacing.xs,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: Spacing.sm,
  },
  activitiesSection: {
    padding: Spacing.md,
  },
  specialEventSection: {
    gap: Spacing.sm,
  },
  specialEventIntro: {
    fontSize: Typography.body,
    color: palette.textSecondary,
    lineHeight: 22,
  },
  specialEventPlaceholder: {
    fontSize: Typography.body,
    color: palette.textSecondary,
  },
  specialEventImage: {
    width: '100%',
    height: 180,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  specialEventImagePlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialEventImageText: {
    fontSize: Typography.body,
    color: palette.textSecondary,
  },
  specialEventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  specialEventHeaderText: {
    flex: 1,
  },
  specialEventTitle: {
    marginBottom: Spacing.xs / 2,
  },
  specialEventTime: {
    marginBottom: Spacing.sm,
  },
  placesSection: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  freeDaySection: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.title,
    fontWeight: '700' as const,
    color: palette.textPrimary,
    marginBottom: Spacing.sm,
  },
  placeGroupCard: {
    backgroundColor: palette.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  placeGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  placeGroupTitle: {
    fontSize: Typography.section,
    fontWeight: '700' as const,
    color: palette.textPrimary,
  },
  placeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  placeRowDivider: {
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  placeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  placeEmoji: {
    fontSize: 20,
  },
  placeContent: {
    flex: 1,
  },
  placeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  placeTitleWrap: {
    flex: 1,
  },
  placeName: {
    fontSize: Typography.body,
    fontWeight: '700' as const,
    color: palette.textPrimary,
    marginBottom: 2,
  },
  placeImage: {
    width: '100%',
    height: 140,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  placeImageLarge: {
    height: 200,
  },
  placeType: {
    fontSize: Typography.label,
    color: palette.muted,
  },
  placeTime: {
    fontSize: Typography.body,
    color: palette.primary,
    fontWeight: '600' as const,
  },
  placeDescription: {
    fontSize: Typography.body,
    color: palette.textSecondary,
    lineHeight: 21,
    marginTop: Spacing.xs,
  },
  placeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  placeDetailText: {
    fontSize: Typography.body,
    color: palette.textSecondary,
  },
  placeDetailLink: {
    color: palette.primary,
  },
  placeLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  placeLinkButton: {
    backgroundColor: palette.background,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  placeLinkText: {
    fontSize: Typography.label,
    color: palette.primary,
    fontWeight: '600' as const,
  },
  placeLocations: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  placeLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${palette.primary}10`,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  placeLocationText: {
    fontSize: Typography.label,
    color: palette.primary,
    fontWeight: '600' as const,
  },
  activityCard: {
    backgroundColor: palette.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  activityImage: {
    width: '100%',
    height: 160,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  activityEmoji: {
    fontSize: 32,
    marginRight: Spacing.sm,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: Typography.section,
    fontWeight: '600' as const,
    color: palette.textPrimary,
    marginBottom: Spacing.xs,
  },
  activityTime: {
    fontSize: Typography.body,
    color: palette.primary,
    fontWeight: '600' as const,
  },
  activityDescription: {
    fontSize: Typography.body,
    color: palette.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  activityDescriptionBlock: {
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  statCard: {
    backgroundColor: palette.background,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: Typography.label,
    color: palette.muted,
    fontWeight: '600' as const,
  },
  statValue: {
    fontSize: Typography.body,
    color: palette.textPrimary,
    fontWeight: '600' as const,
  },
  matchCard: {
    backgroundColor: palette.background,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  matchTitle: {
    fontSize: Typography.section,
    fontWeight: '700' as const,
    color: palette.primary,
  },
  matchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchLabel: {
    fontSize: Typography.label,
    color: palette.muted,
    fontWeight: '600' as const,
  },
  matchValue: {
    fontSize: Typography.body,
    color: palette.textPrimary,
    fontWeight: '600' as const,
    textAlign: 'right',
    flex: 1,
    marginLeft: Spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  bulletDot: {
    fontSize: 18,
    lineHeight: 22,
    color: palette.textSecondary,
  },
  activityDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  activityDetailText: {
    fontSize: Typography.body,
    color: palette.textSecondary,
  },
  activityDetailLink: {
    color: palette.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    backgroundColor: palette.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    width: '100%',
    maxWidth: 360,
    gap: Spacing.sm,
  },
  modalTitle: {
    fontSize: Typography.body,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  modalButton: {
    backgroundColor: palette.background,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  modalButtonText: {
    fontSize: Typography.body,
    color: palette.primary,
    fontWeight: '600',
  },
  modalClose: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  modalCloseText: {
    fontSize: Typography.body,
    color: palette.textSecondary,
  },
  pickerCard: {
    backgroundColor: palette.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    width: '100%',
    maxWidth: 380,
    gap: Spacing.sm,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.sm,
  },
  pickerRowSelected: {
    backgroundColor: `${palette.primary}14`,
  },
  pickerLabel: {
    fontSize: Typography.body,
    color: palette.textPrimary,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: palette.border,
  },
  radioSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.primary,
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  pickerInputGroup: {
    gap: Spacing.xs,
  },
  pickerInputLabel: {
    fontSize: Typography.label,
    color: palette.textSecondary,
  },
  pickerInput: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: Typography.body,
  },
  flex: {
    flex: 1,
  },
  pickerSecondary: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  pickerPrimary: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm + 2,
    backgroundColor: palette.primary,
    borderRadius: Radius.sm,
  },
  pickerPrimaryText: {
    color: palette.surface,
    fontSize: Typography.body,
    fontWeight: '600',
  },
  flightBadge: {
    backgroundColor: `${palette.primary}14`,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  flightBadgeText: {
    fontSize: Typography.label,
    color: palette.primary,
    fontWeight: '600' as const,
  },
  timeslotCard: {
    backgroundColor: `${palette.primary}0D`,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  timeslotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeslotTitle: {
    fontSize: Typography.body,
    fontWeight: '600' as const,
    color: palette.textPrimary,
  },
  timeslotButton: {
    backgroundColor: palette.primary,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  timeslotButtonText: {
    color: palette.surface,
    fontSize: Typography.label,
    fontWeight: '600' as const,
  },
  timeslotTip: {
    gap: 2,
  },
  timeslotTipTitle: {
    fontSize: Typography.label,
    fontWeight: '600' as const,
    color: palette.textPrimary,
  },
  timeslotTipBody: {
    fontSize: Typography.label,
    color: palette.textSecondary,
    lineHeight: 18,
  },
  flightDetailCard: {
    backgroundColor: `${palette.primary}0D`,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: 2,
  },
  flightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  flightNumber: {
    fontSize: Typography.section,
    fontWeight: '700' as const,
    color: palette.textPrimary,
    flex: 1,
    paddingRight: Spacing.xs,
  },
  flightDurationChip: {
    backgroundColor: `${palette.primary}14`,
    color: palette.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    fontSize: Typography.label,
    fontWeight: '600' as const,
  },
  flightTimesRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  flightTimeBox: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  flightTimeLabel: {
    fontSize: Typography.caption,
    color: palette.muted,
    fontWeight: '600' as const,
  },
  flightTimeValue: {
    fontSize: Typography.title,
    fontWeight: '700' as const,
    color: palette.textPrimary,
  },
  flightTimeMeta: {
    fontSize: Typography.label,
    color: palette.textSecondary,
    marginTop: 2,
  },
  flightDetailText: {
    fontSize: Typography.label,
    color: palette.textPrimary,
  },
  flightDetailStatus: {
    fontSize: Typography.label,
    color: palette.primary,
    fontWeight: '600' as const,
    marginTop: Spacing.xs,
  },
  freeDayTitle: {
    fontSize: Typography.title,
    fontWeight: '700' as const,
    color: palette.textPrimary,
    lineHeight: 28,
  },
  freeDayIntro: {
    fontSize: Typography.body,
    color: palette.textSecondary,
    lineHeight: 24,
  },
  freeDaySubtitle: {
    fontSize: Typography.body,
    color: palette.textSecondary,
  },
  segmentControl: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  segmentButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: 20,
    backgroundColor: palette.background,
  },
  segmentButtonActive: {
    backgroundColor: palette.primary,
  },
  segmentLabel: {
    fontSize: Typography.label,
    color: palette.textPrimary,
    fontWeight: '600' as const,
  },
  segmentLabelActive: {
    color: palette.surface,
  },
  segmentContent: {
    backgroundColor: palette.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  freeDayPlaceholder: {
    fontSize: Typography.body,
    color: palette.textSecondary,
  },
  specialEventCard: {
    gap: Spacing.sm,
  },
  specialEventCardTitle: {
    fontSize: Typography.section,
    fontWeight: '700' as const,
    color: palette.textPrimary,
  },
  specialEventBody: {
    fontSize: Typography.body,
    color: palette.textSecondary,
    lineHeight: 22,
  },
  specialEventInfoList: {
    gap: 4,
  },
  specialEventInfo: {
    fontSize: Typography.label,
    color: palette.textPrimary,
  },
  specialEventLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  specialEventLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderWidth: 1.2,
    minHeight: 40,
    minWidth: 140,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  specialEventLinkPrimary: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  specialEventLinkSecondary: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
  },
  specialEventLinkText: {
    fontSize: Typography.body,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  specialEventLinkTextPrimary: {
    color: palette.surface,
  },
  specialEventLinkTextSecondary: {
    color: palette.primary,
  },
  specialEventNote: {
    fontSize: Typography.caption,
    color: palette.textSecondary,
    marginTop: Spacing.xs,
  },
  freeDayCard: {
    gap: Spacing.sm,
  },
  freeDayCardTitle: {
    fontSize: Typography.section,
    fontWeight: '700' as const,
    color: palette.textPrimary,
  },
  freeDayBody: {
    fontSize: Typography.body,
    color: palette.textSecondary,
    lineHeight: 22,
  },
  freeDayInfoList: {
    gap: 4,
  },
  freeDayInfo: {
    fontSize: Typography.label,
    color: palette.textPrimary,
  },
  freeDaySubheader: {
    fontSize: Typography.section,
    fontWeight: '600' as const,
    color: palette.textPrimary,
    marginTop: Spacing.xs,
  },
  hikeCard: {
    backgroundColor: palette.background,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  hikeTitle: {
    fontSize: Typography.body,
    fontWeight: '600' as const,
    color: palette.textPrimary,
  },
  hikeSummary: {
    fontSize: Typography.label,
    color: palette.textSecondary,
  },
  hikeDetail: {
    fontSize: Typography.caption,
    color: palette.textSecondary,
  },
  hikeDescription: {
    fontSize: Typography.label,
    color: palette.textSecondary,
    lineHeight: 21,
  },
  hikeExtra: {
    fontSize: Typography.caption,
    color: palette.textSecondary,
  },
  freeDayActions: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: palette.primary,
  },
  primaryButtonText: {
    color: palette.surface,
    fontWeight: '600' as const,
  },
  freeDayLink: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
  },
  freeDayLinkText: {
    color: palette.primary,
    fontWeight: '600' as const,
  },
});
