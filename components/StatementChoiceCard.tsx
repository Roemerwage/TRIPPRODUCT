import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Radius, Spacing, Typography } from '@/constants/tokens';
import type { Statement } from '@/game/engine';

type StatementChoiceCardProps = {
  statement: Statement;
  selected?: boolean;
  onPress: () => void;
  compact?: boolean;
  style?: ViewStyle | ViewStyle[];
};

export function StatementChoiceCard({
  statement,
  selected,
  onPress,
  compact,
  style,
}: StatementChoiceCardProps) {
  const { colors } = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.card, compact && styles.cardCompact, selected && styles.cardSelected, style]}
    >
      <View style={[styles.bullet, selected && styles.bulletSelected]}>
        <View style={[styles.bulletDot, selected && styles.bulletDotSelected]} />
      </View>
      <Text style={[styles.text, compact && styles.textCompact]}>{statement.text}</Text>
    </TouchableOpacity>
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
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
    },
    cardSelected: {
      borderColor: palette.primary,
      backgroundColor: `${palette.primary}14`,
    },
    bullet: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: palette.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bulletSelected: {
      borderColor: palette.primary,
    },
    bulletDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: 'transparent',
    },
    bulletDotSelected: {
      backgroundColor: palette.primary,
    },
    text: {
      flex: 1,
      fontSize: Typography.body,
      color: palette.textPrimary,
    },
    textCompact: {
      fontSize: Typography.label,
    },
  });
