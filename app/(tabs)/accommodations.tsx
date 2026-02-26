import React, { useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View, TouchableOpacity, Linking } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTrip } from '@/contexts/TripContext';
import { Home, ExternalLink, MapPin, Calendar } from 'lucide-react-native';
import { getAccommodationMedia } from '@/constants/media';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { FloatingActions } from '@/components/FloatingActions';
import { Radius, Spacing, Typography } from '@/constants/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PreviewableImage } from '@/components/PreviewableImage';
import { SPOTIFY_PLAYLIST_URL } from '@/constants/spotify';

export default function AccommodationsScreen() {
  const { accommodations, getRoomAssignments } = useTrip();
  const router = useRouter();
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

  if (accommodations.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Verblijven' }} />
        <View style={[styles.emptyContainer, { paddingTop: actionBarOffset }]}>
          <EmptyState
            title="Geen verblijven"
            subtitle="Importeer je planning om verblijven te zien"
            icon={<Home size={56} color={colors.muted} />}
          />
        </View>
        <FloatingActions
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

  return (
    <>
      <Stack.Screen options={{ title: 'Verblijven' }} />
      <View style={styles.container}>
        <Animated.ScrollView
          contentContainerStyle={[styles.content, { paddingTop: actionBarOffset }]}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {accommodations.map((acc, index) => {
            const sortedDays = acc.dagen.sort((a, b) => a.getTime() - b.getTime());
            const firstDay = sortedDays[0];
            const lastDay = sortedDays[sortedDays.length - 1];
            const media = getAccommodationMedia(acc.naam);
            const roomAssignments = getRoomAssignments(acc.naam);
            
            const dateRange = firstDay.getDate() === lastDay.getDate()
              ? `${firstDay.getDate()} ${getMonthName(firstDay.getMonth())}`
              : `${firstDay.getDate()} - ${lastDay.getDate()} ${getMonthName(lastDay.getMonth())}`;
            const mapsLink =
              acc.mapsLink && acc.mapsLink !== 'x' && acc.mapsLink.toLowerCase() !== 'unknown'
                ? acc.mapsLink
                : media?.link;
            const bookingLabel = acc.link?.toLowerCase().includes('airbnb') ? 'Airbnb' : 'Booking';

            return (
              <TouchableOpacity
                key={index}
                activeOpacity={0.9}
                onPress={() => router.push(`/accommodation/${encodeURIComponent(acc.naam)}` as any)}
              >
                <Card style={styles.card}>
                  {media?.image && (
                    <PreviewableImage
                      source={media.image}
                      style={styles.cardImage}
                      accessibilityLabel={`Afbeelding van ${acc.naam}`}
                    />
                  )}
                  <View style={styles.cardHeader}>
                    <Home size={22} color={colors.primary} />
                    <Text style={styles.cardTitle}>{acc.naam}</Text>
                  </View>

                  {acc.adres && acc.adres !== 'x' && acc.adres.toLowerCase() !== 'unknown' && (
                    <View style={styles.infoRow}>
                      <MapPin size={16} color={colors.textSecondary} />
                      <Text style={styles.infoText}>{acc.adres}</Text>
                    </View>
                  )}

                  <View style={styles.infoRow}>
                    <Calendar size={16} color={colors.textSecondary} />
                    <Text style={styles.infoText}>{dateRange} ({acc.dagen.length} {acc.dagen.length === 1 ? 'nacht' : 'nachten'})</Text>
                  </View>

                  {roomAssignments.length > 0 && (
                    <View style={styles.roomPreview}>
                      <Text style={styles.roomPreviewLabel}>Kamerindeling</Text>
                      <Text style={styles.roomPreviewText}>
                        {roomAssignments[0]}
                        {roomAssignments[1] ? ` • ${roomAssignments[1]}` : ''}
                      </Text>
                      <Text style={styles.roomPreviewHint}>Tik voor alle kamers</Text>
                    </View>
                  )}

                  <View style={styles.actions}>
                    {mapsLink && (
                      <Button
                        label="Open Maps"
                        onPress={() => Linking.openURL(mapsLink)}
                        icon={<MapPin size={18} color="#FFFFFF" />}
                        style={styles.actionButton}
                      />
                    )}
                    
                    {acc.link && acc.link !== 'x' && acc.link.toLowerCase() !== 'unknown' && (
                      <Button
                        label={bookingLabel}
                        onPress={() => Linking.openURL(acc.link)}
                        variant="secondary"
                        icon={<ExternalLink size={18} color={colors.primary} />}
                        style={styles.actionButton}
                      />
                    )}
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </Animated.ScrollView>
        <FloatingActions
          showSettings
          showLifeBuoy
          showBack={false}
          showSpotify
          spotifyUrl={SPOTIFY_PLAYLIST_URL}
          animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
        />
      </View>
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
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: palette.background,
      paddingHorizontal: Spacing.xl,
    },
    content: {
      padding: Spacing.md,
    },
    card: {
      marginBottom: Spacing.md,
      overflow: 'hidden',
    },
    cardImage: {
      width: '100%',
      height: 180,
      borderRadius: Radius.sm,
      marginBottom: Spacing.md,
    },
    roomPreview: {
      backgroundColor: palette.background,
      borderRadius: Radius.sm,
      padding: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    roomPreviewLabel: {
      fontSize: Typography.label,
      color: palette.textSecondary,
      marginBottom: Spacing.xs,
    },
    roomPreviewText: {
      fontSize: Typography.body,
      color: palette.textPrimary,
      fontWeight: '600' as const,
    },
    roomPreviewHint: {
      fontSize: Typography.caption,
      color: palette.textSecondary,
      marginTop: Spacing.xs,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    cardTitle: {
      fontSize: Typography.section,
      fontWeight: '700' as const,
      color: palette.textPrimary,
      flex: 1,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginBottom: Spacing.xs,
    },
    infoText: {
      fontSize: Typography.body,
      color: palette.textSecondary,
      flex: 1,
    },
    actions: {
      flexDirection: 'row',
      gap: Spacing.xs,
      marginTop: Spacing.md,
    },
    actionButton: {
      flex: 1,
    },
  });
