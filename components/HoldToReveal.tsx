import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Radius, Spacing, Typography } from '@/constants/tokens';

type HoldToRevealProps = {
  children: React.ReactNode;
  label?: string;
  hint?: string;
  style?: ViewStyle | ViewStyle[];
};

export function HoldToReveal({
  children,
  label = 'Houd vast om te tonen',
  hint = 'Laat los om te verbergen',
  style,
}: HoldToRevealProps) {
  const { colors } = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [revealed, setRevealed] = useState(false);

  return (
    <Pressable
      onPressIn={() => setRevealed(true)}
      onPressOut={() => setRevealed(false)}
      style={[styles.container, style]}
    >
      <View style={styles.content}>{children}</View>
      {!revealed && (
        <View style={styles.overlay} pointerEvents="none">
          <BlurView intensity={55} tint="light" style={styles.blur} />
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.hint}>{hint}</Text>
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: {
      borderRadius: Radius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    content: {
      padding: Spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 120,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.md,
      gap: Spacing.xs,
    },
    blur: {
      ...StyleSheet.absoluteFillObject,
    },
    label: {
      fontSize: Typography.section,
      fontWeight: '800',
      color: palette.textPrimary,
      textAlign: 'center',
    },
    hint: {
      fontSize: Typography.label,
      color: palette.textSecondary,
      textAlign: 'center',
    },
  });
