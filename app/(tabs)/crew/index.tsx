import React, { useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useTrip } from '@/contexts/TripContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Card } from '@/components/Card';
import { FloatingActions } from '@/components/FloatingActions';
import { Radius, Spacing, Typography } from '@/constants/tokens';
import { SPOTIFY_PLAYLIST_URL } from '@/constants/spotify';

export default function CrewScreen() {
  const { participants } = useTrip();
  const insets = useSafeAreaInsets();
  const router = useRouter();
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

  return (
    <>
      <Stack.Screen options={{ title: 'Crew' }} />
      <View style={styles.container}>
        <Animated.ScrollView
          contentContainerStyle={[styles.content, { paddingTop: actionBarOffset }]}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          <View style={styles.grid}>
            {participants.map(person => (
              <TouchableOpacity
                key={person.id}
                style={styles.cardWrapper}
                activeOpacity={0.8}
                onPress={() => router.push(`/crew/${person.id}` as any)}
              >
                <Card style={styles.card}>
                  {person.avatar ? (
                    <Image source={person.avatar} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitials}>{getInitials(person.naam)}</Text>
                    </View>
                  )}
                  <Text style={styles.name}>{person.naam}</Text>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
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

function getInitials(name: string) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    content: {
      padding: Spacing.md,
      paddingTop: 0,
      paddingBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      justifyContent: 'space-between',
    },
    cardWrapper: {
      width: '48%',
    },
    card: {
      width: '100%',
      padding: Spacing.sm,
      overflow: 'hidden',
    },
    avatar: {
      width: '100%',
      height: 120,
      borderRadius: Radius.sm,
      marginBottom: Spacing.sm,
    },
    avatarPlaceholder: {
      width: '100%',
      height: 120,
      borderRadius: Radius.sm,
      marginBottom: Spacing.sm,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      fontSize: Typography.section,
      fontWeight: '700' as const,
      color: palette.textSecondary,
    },
    name: {
      fontSize: Typography.section,
      fontWeight: '700',
      color: palette.textPrimary,
    },
  });
