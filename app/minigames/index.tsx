import React, { useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useThemeMode } from '@/contexts/ThemeContext';
import { MINIGAMES } from '@/minigames/registry';
import { Card } from '@/components/Card';
import { FloatingActions } from '@/components/FloatingActions';
import { Spacing, Typography } from '@/constants/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MinigamesScreen() {
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

  return (
    <>
      <Stack.Screen options={{ title: 'Minigames', headerShown: false }} />
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
          <View style={styles.header}>
            <Text style={styles.title}>Minigames</Text>
            <Text style={styles.subtitle}>
              Perfect voor onderweg: minigames die ook offline werken.
            </Text>
          </View>

          {MINIGAMES.map(game => (
            <TouchableOpacity
              key={game.id}
              activeOpacity={0.85}
              onPress={() => router.push(game.route as any)}
            >
              <Card style={styles.gameCard}>
                <Text style={styles.gameTitle}>{game.titel}</Text>
                <Text style={styles.gameDescription}>{game.beschrijving}</Text>
              </Card>
            </TouchableOpacity>
          ))}
        </Animated.ScrollView>
        <FloatingActions
          showWheel
          showSettings={false}
          showLifeBuoy={false}
          showBack={false}
          animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
        />
      </View>
    </>
  );
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
    header: {
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
    gameCard: {
      gap: Spacing.xs,
    },
    gameTitle: {
      fontSize: Typography.section,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    gameDescription: {
      fontSize: Typography.body,
      color: palette.textSecondary,
    },
  });
