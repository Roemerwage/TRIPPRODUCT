import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, ImageBackground, Animated, Linking } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTrip } from '@/contexts/TripContext';
import { Activity, Day } from '@/types/trip';
import { Calendar, MapPin, Home, ChevronRight, X } from 'lucide-react-native';
import { formatMinutesLabel, getFlightLayoverMinutes } from '@/utils/flight';
import { getDayImage } from '@/constants/media';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FloatingActions } from '@/components/FloatingActions';
import { Radius, Spacing, Typography } from '@/constants/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPOTIFY_PLAYLIST_URL } from '@/constants/spotify';

export default function PlanningScreen() {
  const { days, isLoading } = useTrip();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(0));
  const { colors } = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { ice } = useLocalSearchParams();
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

  useEffect(() => {
    Animated.timing(sidebarAnim.current, {
      toValue: sidebarOpen ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [sidebarOpen]);

  useEffect(() => {
    if (ice === '1') {
      setSidebarOpen(true);
    }
  }, [ice]);

  const handleDial = async (value: string) => {
    const normalized = value.replace(/[^0-9+]/g, '');
    const url = `tel:${normalized}`;
    if (await Linking.canOpenURL(url)) {
      Linking.openURL(url);
    }
  };

  const sidebarTranslate = sidebarAnim.current.interpolate({
    inputRange: [0, 1],
    outputRange: [-320, 0],
  });
  const sidebarPaddingTop = insets.top + Spacing.md;

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Planning' }} />
        <View style={[styles.centerContainer, { paddingTop: actionBarOffset }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Laden...</Text>
        </View>
        {!sidebarOpen && (
          <FloatingActions
            onLifeBuoyPress={() => setSidebarOpen(true)}
            showSettings
            showLifeBuoy
            showBack={false}
            showSpotify
            spotifyUrl={SPOTIFY_PLAYLIST_URL}
            animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
          />
        )}
      </>
    );
  }

  if (days.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Planning' }} />
        <View style={[styles.centerContainer, { paddingTop: actionBarOffset }]}>
          <EmptyState
            title="Nog geen planning"
            subtitle="Importeer je TSV-bestand om de planning te vullen"
            icon={<Calendar size={56} color={colors.muted} />}
          />
        </View>
        <FloatingActions
          onLifeBuoyPress={() => setSidebarOpen(true)}
          showSettings
          showLifeBuoy
          showBack={false}
          showSpotify
          spotifyUrl={SPOTIFY_PLAYLIST_URL}
          animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
        />
      </>
    );
  }

  const renderDayCard = ({ item: day }: { item: Day }) => {
    const dateStr = `${day.datum.getDate()} ${getMonthName(day.datum.getMonth())}`;
    const activityHighlights = day.activiteiten.reduce<Activity[]>((acc, activity) => {
      if (!acc.some(item => item.type === activity.type)) {
        acc.push(activity);
      }
      return acc;
    }, []);
    const flightActivities: Activity[] = day.activiteiten.filter(
      activity => activity.type === 'flight'
    );
    const dayImage = getDayImage(day);

    return (
      <Card style={styles.dayCard}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push(`/planning/${encodeURIComponent(day.datum.toISOString())}` as any)}
        >
          {dayImage && (
            <ImageBackground
              source={dayImage}
              style={styles.dayImage}
              imageStyle={styles.dayImageInner}
            >
              <View style={styles.dayImageOverlay}>
                <Text style={styles.dayImageLocation}>{day.stadRegio}</Text>
                <Text style={styles.dayImageDate}>{dateStr}</Text>
              </View>
            </ImageBackground>
          )}

          <View style={styles.dayHeader}>
            <View style={styles.dayDateContainer}>
              <Text style={styles.dayDate}>{dateStr}</Text>
              <Text style={styles.dayName}>{day.dagNaam}</Text>
            </View>
            <ChevronRight size={20} color={colors.muted} />
          </View>
          
          <View style={styles.dayLocation}>
            <MapPin size={16} color={colors.textSecondary} />
            <Text style={styles.dayLocationText}>{day.stadRegio}</Text>
          </View>

          {day.verblijf && day.verblijf !== 'x' && (
            <View style={styles.dayAccommodation}>
              <Home size={16} color={colors.textSecondary} />
              <Text style={styles.dayAccommodationText}>{day.verblijf}</Text>
            </View>
          )}

          {flightActivities.length > 0 ? (
            <View style={styles.flightSummary}>
              {flightActivities.map((flight, idx) => {
                const startTime = formatTime(flight.startTijd);
                const duration = formatMinutesLabel(flight.reisTijd) || null;
                const details = extractFlightDetails(flight.beschrijving);
                const nextFlight = flightActivities[idx + 1];
                const layoverMinutes = getFlightLayoverMinutes(flight, nextFlight);
                const layoverText = layoverMinutes ? `Overstap ${formatMinutesLabel(layoverMinutes)}` : null;
                return (
                  <View key={flight.id} style={styles.flightRow}>
                    <View style={styles.flightRowHeader}>
                      <Text style={styles.flightName}>✈️ {flight.naam}</Text>
                      {startTime && <Text style={styles.flightTime}>{startTime}</Text>}
                    </View>
                    {flight.locatie && (
                      <Text style={styles.flightLocation}>{flight.locatie}</Text>
                    )}
                    <View style={styles.flightDetailList}>
                      {details?.departure && (
                        <Text style={styles.flightDetailText}>{details.departure}</Text>
                      )}
                      {details?.arrival && (
                        <Text style={styles.flightDetailText}>{details.arrival}</Text>
                      )}
                      {duration && (
                        <Text style={styles.flightDetailText}>Duur {duration}</Text>
                      )}
                      {layoverText && (
                        <Text style={styles.flightDetailText}>{layoverText}</Text>
                      )}
                      {details?.status && (
                        <Text style={styles.flightStatus}>{details.status}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.dayActivities}>
              {activityHighlights.slice(0, 4).map((activity, idx) => (
                <View key={idx} style={styles.activityChip}>
                  <Text style={styles.activityEmoji}>{getActivityEmoji(activity.type)}</Text>
                </View>
              ))}
              {day.activiteiten.length > 4 && (
                <Text style={styles.moreActivities}>+{day.activiteiten.length - 4}</Text>
              )}
            </View>
          )}
        </TouchableOpacity>
      </Card>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Planning',
        }}
      />

      <View style={styles.screenShell}>
        <Animated.FlatList
          data={days}
          renderItem={renderDayCard}
          keyExtractor={(item) => item.datum.toISOString()}
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: actionBarOffset },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        />

        <FloatingActions
          onLifeBuoyPress={() => setSidebarOpen(true)}
          showSettings
          showLifeBuoy
          showBack={false}
          showSpotify
          spotifyUrl={SPOTIFY_PLAYLIST_URL}
          animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
        />

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

          <Animated.ScrollView style={styles.sidebarScroll} showsVerticalScrollIndicator={false}>
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
          </Animated.ScrollView>
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

function formatTime(date?: Date | null): string | null {
  if (!date) return null;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function extractFlightDetails(description?: string) {
  if (!description) return null;
  const departureMatch = description.match(/Vertrek\s([^,]+),/i);
  const arrivalMatch = description.match(/aankomst\s([^.]+)\./i);
  const statusMatch = description.match(/Status:\s*([^.]+)/i);
  return {
    departure: departureMatch ? `Vertrek ${departureMatch[1].trim()}` : null,
    arrival: arrivalMatch ? `Aankomst ${arrivalMatch[1].trim()}` : null,
    status: statusMatch ? `Status: ${statusMatch[1].trim()}` : null,
  };
}

const createStyles = (palette: any) => StyleSheet.create({
    screenShell: {
      flex: 1,
      backgroundColor: palette.background,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: palette.background,
      paddingHorizontal: Spacing.xl,
    },
    loadingText: {
      marginTop: Spacing.sm,
      fontSize: Typography.body,
      color: palette.textSecondary,
    },
    listContent: {
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.xl,
    },
    dayCard: {
      marginBottom: Spacing.sm,
      overflow: 'hidden',
    },
    dayImage: {
      height: 150,
      marginHorizontal: -Spacing.md,
      marginTop: -Spacing.md,
      marginBottom: Spacing.sm,
    },
    dayImageInner: {
      borderTopLeftRadius: Radius.md,
      borderTopRightRadius: Radius.md,
    },
    dayImageOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
      justifyContent: 'flex-end',
      padding: Spacing.md,
    },
    dayImageLocation: {
      color: '#FFFFFF',
      fontSize: Typography.body,
      fontWeight: '600' as const,
    },
    dayImageDate: {
      color: '#FFFFFF',
      fontSize: Typography.label,
      marginTop: 2,
    },
    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
    },
    dayDateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    dayDate: {
      fontSize: Typography.title,
      fontWeight: '700' as const,
      color: palette.textPrimary,
    },
    dayName: {
      fontSize: Typography.body,
      color: palette.textSecondary,
    },
    dayLocation: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    dayLocationText: {
      fontSize: Typography.body,
      color: palette.textSecondary,
    },
    dayAccommodation: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    dayAccommodationText: {
      fontSize: Typography.body,
      color: palette.textSecondary,
    },
    dayActivities: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    flightSummary: {
      marginTop: Spacing.sm,
      gap: Spacing.sm,
    },
    flightRow: {
      backgroundColor: palette.background,
      borderRadius: Radius.sm,
      padding: Spacing.sm,
      borderWidth: 1,
      borderColor: palette.border,
    },
    flightRowHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.xs,
    },
    flightName: {
      fontSize: Typography.body,
      fontWeight: '600' as const,
      color: palette.textPrimary,
    },
    flightTime: {
      fontSize: Typography.label,
      color: palette.textSecondary,
    },
    flightLocation: {
      fontSize: Typography.label,
      color: palette.textSecondary,
      marginTop: 2,
    },
    flightDetailList: {
      marginTop: Spacing.xs,
      gap: 2,
    },
    flightDetailText: {
      fontSize: Typography.label,
      color: palette.textSecondary,
    },
    flightStatus: {
      marginTop: Spacing.xs,
      fontSize: Typography.label,
      color: palette.primary,
      fontWeight: '700' as const,
    },
    activityChip: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: palette.background,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: palette.border,
    },
    activityEmoji: {
      fontSize: 18,
    },
    moreActivities: {
      fontSize: Typography.label,
      color: palette.textSecondary,
    },
    flightDetailTextRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    flightDetailLabel: {
      fontSize: 13,
      color: palette.textSecondary,
    },
    flightDetailValue: {
      fontSize: 13,
      color: palette.textPrimary,
      fontWeight: '600' as const,
    },
    sidebar: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      width: 320,
      backgroundColor: palette.surface,
      padding: Spacing.md,
      paddingTop: Spacing.lg - 2,
      borderRightWidth: 1,
      borderColor: palette.border,
      shadowColor: '#000',
      shadowOffset: { width: 2, height: 0 },
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
  });
;
