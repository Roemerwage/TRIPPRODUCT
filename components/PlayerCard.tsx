import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Radius, Spacing, Typography } from '@/constants/tokens';
import type { Player } from '@/game/engine';

type PlayerCardProps = {
  player: Player;
  rank?: number;
  compact?: boolean;
  highlighted?: boolean;
  showAvatar?: boolean;
  dense?: boolean;
  style?: ViewStyle | ViewStyle[];
};

export function PlayerCard({
  player,
  rank,
  compact,
  highlighted,
  showAvatar = true,
  dense,
  style,
}: PlayerCardProps) {
  const { colors } = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [imageError, setImageError] = useState(false);
  const initials = player.displayName
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const avatarSize = compact ? 44 : 56;
  const showFallback = imageError || (!player.avatarUrl && !player.avatarSource);

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        dense && styles.cardDense,
        highlighted && styles.cardHighlighted,
        style,
      ]}
    >
      {typeof rank === 'number' && (
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>
      )}
      {showAvatar ? (
        showFallback ? (
          <View
            style={[styles.avatarFallback, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        ) : (
          <Image
            source={player.avatarSource ?? { uri: player.avatarUrl ?? '' }}
            style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }}
            onError={() => setImageError(true)}
          />
        )
      ) : null}
      <Text style={styles.name} numberOfLines={1}>
        {player.displayName}
      </Text>
    </View>
  );
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      padding: Spacing.sm,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    cardCompact: {
      flexBasis: '47%',
      minWidth: '47%',
    },
    cardDense: {
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
    },
    cardHighlighted: {
      borderColor: palette.primary,
      shadowColor: palette.primary,
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
    },
    rankBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: palette.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: Typography.label,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.border,
    },
    avatarText: {
      fontSize: Typography.label,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    name: {
      flex: 1,
      fontSize: Typography.body,
      fontWeight: '600',
      color: palette.textPrimary,
    },
  });
