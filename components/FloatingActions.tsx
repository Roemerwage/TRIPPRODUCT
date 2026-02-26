import React from 'react';
import { Animated, Linking, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { ChevronLeft, LifeBuoy, Settings } from 'lucide-react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/tokens';

type FloatingActionsProps = {
  onLifeBuoyPress?: () => void;
  showWheel?: boolean;
  onWheelPress?: () => void;
  onSettingsPress?: () => void;
  showSettings?: boolean;
  showLifeBuoy?: boolean;
  showBack?: boolean;
  showSpotify?: boolean;
  spotifyUrl?: string;
  animatedStyle?: StyleProp<ViewStyle>;
};

export function FloatingActions({
  onLifeBuoyPress,
  showWheel = true,
  onWheelPress,
  onSettingsPress,
  showSettings = true,
  showLifeBuoy = true,
  showBack = true,
  showSpotify = false,
  spotifyUrl,
  animatedStyle,
}: FloatingActionsProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useThemeMode();
  const canGoBack = typeof (router as any).canGoBack === 'function' ? (router as any).canGoBack() : false;
  const shouldShowBack = showBack && canGoBack;

  const handleLifeBuoy = () => {
    if (onLifeBuoyPress) {
      onLifeBuoyPress();
      return;
    }
    router.push({ pathname: '/planning', params: { ice: '1' } } as any);
  };

  const handleSettings = () => {
    if (onSettingsPress) {
      onSettingsPress();
      return;
    }
    router.push('/settings' as any);
  };

  const handleSpotify = () => {
    if (!spotifyUrl) return;
    Linking.openURL(spotifyUrl);
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + Spacing.xs, paddingTop: Spacing.xs },
        animatedStyle,
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.row}>
        <View style={styles.group}>
          {shouldShowBack && (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              accessibilityLabel="Terug"
            >
              <ChevronLeft size={20} color={colors.primary} />
              <Text style={[styles.backText, { color: colors.textPrimary }]}>Terug</Text>
            </TouchableOpacity>
          )}
          {showSettings && (
            <TouchableOpacity
              onPress={handleSettings}
              style={styles.iconButton}
              accessibilityLabel="Instellingen"
            >
              <Settings color={colors.primary} size={22} />
            </TouchableOpacity>
          )}
          {showLifeBuoy && (
            <TouchableOpacity
              onPress={handleLifeBuoy}
              style={styles.iconButton}
              accessibilityLabel="In case of emergency"
            >
              <LifeBuoy size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.group}>
          {showSpotify && spotifyUrl && (
            <TouchableOpacity
              onPress={handleSpotify}
              style={styles.iconButton}
              accessibilityLabel="Open Spotify playlist"
            >
              <FontAwesome name="spotify" size={22} color="#1DB954" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.push('/minigames' as any)}
            style={styles.iconButton}
            accessibilityLabel="Open minigames"
          >
            <Text style={styles.emoji}>🎮</Text>
          </TouchableOpacity>
          {showWheel && (
            <TouchableOpacity
              onPress={onWheelPress ?? (() => router.push('/wheel' as any))}
              style={styles.iconButton}
              accessibilityLabel="Spin wheel"
            >
              <Text style={styles.emoji}>🎡</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    gap: 10,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 2,
  },
  backText: {
    fontSize: 14,
    color: '#000000',
  },
  emoji: {
    fontSize: 20,
  },
});
