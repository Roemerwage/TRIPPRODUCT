import React, { useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View, Linking } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTrip } from '@/contexts/TripContext';
import { getAccommodationMedia } from '@/constants/media';
import { ACCOMMODATION_DETAILS } from '@/constants/accommodationDetails';
import { MapPin, ExternalLink, Calendar, Info } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FloatingActions } from '@/components/FloatingActions';
import { Radius, Spacing, Typography } from '@/constants/tokens';
import { PreviewableImage } from '@/components/PreviewableImage';

export default function AccommodationDetailScreen() {
  const { accommodationId } = useLocalSearchParams<{ accommodationId: string }>();
  const decodedName = accommodationId ? decodeURIComponent(accommodationId) : '';
  const { accommodations, getRoomAssignments } = useTrip();
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

  const accommodation = accommodations.find(acc => acc.naam === decodedName);

  if (!accommodation) {
    return (
      <>
        <Stack.Screen options={{ title: 'Verblijf', headerShown: false }} />
        <View style={[styles.centerContainer, { paddingTop: actionBarOffset }]}>
          <Text style={styles.centerText}>Verblijf niet gevonden</Text>
        </View>
        <FloatingActions
          showSettings={false}
          showLifeBuoy={false}
          animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
        />
      </>
    );
  }

  const sortedDays = accommodation.dagen.sort((a, b) => a.getTime() - b.getTime());
  const firstDay = sortedDays[0];
  const lastDay = sortedDays[sortedDays.length - 1];
  const dateRange = firstDay.getDate() === lastDay.getDate()
    ? `${firstDay.getDate()} ${getMonthName(firstDay.getMonth())}`
    : `${firstDay.getDate()} – ${lastDay.getDate()} ${getMonthName(lastDay.getMonth())}`;

  const normalized = accommodation.naam.trim().toLowerCase();
  const details = ACCOMMODATION_DETAILS[normalized];
  const media = getAccommodationMedia(accommodation.naam);
  const roomAssignments = getRoomAssignments(accommodation.naam);
  const mapsLink =
    accommodation.mapsLink && accommodation.mapsLink !== 'x' && accommodation.mapsLink.toLowerCase() !== 'unknown'
      ? accommodation.mapsLink
      : media?.link;
  const bookingLabel = accommodation.link?.toLowerCase().includes('airbnb') ? 'Airbnb' : 'Website';

  return (
    <>
      <Stack.Screen options={{ title: accommodation.naam, headerShown: false }} />
      <Animated.ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32, paddingTop: actionBarOffset }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {media?.image && (
          <PreviewableImage
            source={media.image}
            style={styles.hero}
            overlay={
              <View style={styles.heroOverlay}>
                <Text style={styles.heroTitle}>{accommodation.naam}</Text>
                <Text style={styles.heroSubtitle}>{dateRange}</Text>
              </View>
            }
            accessibilityLabel={`Afbeelding van ${accommodation.naam}`}
          />
        )}

        {!media?.image && (
          <View style={styles.heroTextHeader}>
            <Text style={styles.heroTitlePlain}>{accommodation.naam}</Text>
            <Text style={styles.heroSubtitlePlain}>{dateRange}</Text>
          </View>
        )}

        <Card style={styles.section}>
          <View style={styles.infoRow}>
            <Calendar size={18} color={colors.textSecondary} />
            <Text style={styles.infoText}>{dateRange} · {sortedDays.length} nachten</Text>
          </View>
          {accommodation.adres && (
            <View style={styles.infoRow}>
              <MapPin size={18} color={colors.textSecondary} />
              <Text style={styles.infoText}>{accommodation.adres}</Text>
            </View>
          )}
          <View style={styles.infoActions}>
            {mapsLink && (
              <Button
                label="Open Maps"
                onPress={() => Linking.openURL(mapsLink)}
                icon={<MapPin size={16} color="#FFFFFF" />}
                style={styles.actionButton}
              />
            )}
            {accommodation.link && accommodation.link !== 'x' && accommodation.link.toLowerCase() !== 'unknown' && (
              <Button
                label={bookingLabel}
                variant="secondary"
                onPress={() => Linking.openURL(accommodation.link!)}
                icon={<ExternalLink size={16} color={colors.primary} />}
                style={styles.actionButton}
              />
            )}
          </View>
        </Card>

        {details && (
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <Info size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Over dit verblijf</Text>
            </View>
            <Text style={styles.description}>{details.description}</Text>
            <View style={styles.highlightList}>
              {details.highlights.map((item, idx) => (
                <View key={idx} style={styles.highlightItem}>
                  <Text style={styles.highlightBullet}>•</Text>
                  <Text style={styles.highlightText}>{item}</Text>
                </View>
              ))}
            </View>
            {details.notes && (
              <Text style={styles.note}>{details.notes}</Text>
            )}
          </Card>
        )}

        {roomAssignments.length > 0 && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Kamerindeling</Text>
            {roomAssignments.map((room, idx) => (
              <View key={`${room}-${idx}`} style={styles.roomRow}>
                <Text style={styles.roomIndex}>{idx + 1}.</Text>
                <Text style={styles.roomText}>{room}</Text>
              </View>
            ))}
          </Card>
        )}
      </Animated.ScrollView>
      <FloatingActions
        showSettings={false}
        showLifeBuoy={false}
        animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
      />
    </>
  );
}

function getMonthName(month: number): string {
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return months[month];
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    centerContainer: {
      flex: 1,
      backgroundColor: palette.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    centerText: {
      fontSize: Typography.body,
      color: palette.textSecondary,
    },
    hero: {
      height: 220,
      marginHorizontal: Spacing.md,
      borderRadius: Radius.md,
      overflow: 'hidden',
    },
    heroTextHeader: {
      minHeight: 80,
      marginHorizontal: Spacing.md,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      backgroundColor: palette.cardBackground,
      justifyContent: 'center',
    },
    heroOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
      padding: Spacing.md,
    },
    heroTitle: {
      color: palette.surface,
      fontSize: Typography.title,
      fontWeight: '700',
    },
    heroSubtitle: {
      color: palette.surface,
      fontSize: Typography.body,
      marginTop: Spacing.xs,
    },
    heroTitlePlain: {
      color: palette.textPrimary,
      fontSize: Typography.title,
      fontWeight: '700',
    },
    heroSubtitlePlain: {
      color: palette.textSecondary,
      fontSize: Typography.body,
      marginTop: Spacing.xs,
    },
    section: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.md,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.xs + 2,
    },
    infoText: {
      fontSize: Typography.body,
      color: palette.textPrimary,
      flex: 1,
    },
    infoActions: {
      flexDirection: 'row',
      gap: Spacing.xs,
      marginTop: Spacing.xs,
    },
    actionButton: {
      flex: 1,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    sectionTitle: {
      fontSize: Typography.section,
      fontWeight: '700',
      color: palette.textPrimary,
      marginBottom: Spacing.xs,
    },
    description: {
      fontSize: Typography.body,
      color: palette.textSecondary,
      lineHeight: 22,
    },
    highlightList: {
      marginTop: Spacing.sm,
      gap: Spacing.xs,
    },
    highlightItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.xs,
    },
    highlightBullet: {
      fontSize: Typography.section,
      color: palette.primary,
    },
    highlightText: {
      fontSize: Typography.body,
      color: palette.textPrimary,
      flex: 1,
    },
    note: {
      marginTop: Spacing.sm,
      fontSize: Typography.caption,
      color: palette.textSecondary,
    },
    roomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    roomIndex: {
      width: 24,
      fontSize: Typography.body,
      color: palette.textSecondary,
    },
    roomText: {
      fontSize: Typography.body,
      color: palette.textPrimary,
      flex: 1,
    },
  });
