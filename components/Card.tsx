import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Elevation, Radius, Spacing } from '@/constants/tokens';

type CardProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
};

export function Card({ children, style }: CardProps) {
  const { colors } = useThemeMode();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    ...Elevation.card,
  },
});
