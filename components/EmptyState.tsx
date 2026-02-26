import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Spacing, Typography } from '@/constants/tokens';

type EmptyStateProps = {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
};

export function EmptyState({ title, subtitle, icon, style }: EmptyStateProps) {
  const { colors } = useThemeMode();

  return (
    <View style={[styles.container, style]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  icon: {
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: Typography.section,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.body,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
