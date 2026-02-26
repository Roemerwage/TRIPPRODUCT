import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Radius, Spacing, Typography } from '@/constants/tokens';

type ChipProps = {
  label: string;
  subLabel?: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
};

export function Chip({ label, subLabel, selected, onPress, style }: ChipProps) {
  const { colors } = useThemeMode();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.base,
        {
          backgroundColor: selected ? colors.primary : colors.background,
          borderColor: selected ? colors.primary : colors.border,
        },
        style,
      ]}
      activeOpacity={0.8}
    >
      <Text style={[styles.label, { color: selected ? '#FFFFFF' : colors.textSecondary }]}>
        {label}
      </Text>
      {subLabel ? (
        <Text style={[styles.subLabel, { color: selected ? '#FFFFFF' : colors.muted }]}>
          {subLabel}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  label: {
    fontSize: Typography.body,
    fontWeight: '600',
  },
  subLabel: {
    fontSize: Typography.caption,
    marginTop: 2,
  },
});
