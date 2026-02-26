import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FloatingActions } from '@/components/FloatingActions';
import { Spacing, Typography } from '@/constants/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DEFAULT_MIN = 1;
const DEFAULT_MAX = 10;
const HISTORY_LIMIT = 6;

export default function RandomNumberScreen() {
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
  const [minInput, setMinInput] = useState(String(DEFAULT_MIN));
  const [maxInput, setMaxInput] = useState(String(DEFAULT_MAX));
  const [value, setValue] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const parseNumber = (raw: string) => {
    const normalized = raw.replace(',', '.').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const generate = () => {
    const min = parseNumber(minInput);
    const max = parseNumber(maxInput);
    if (min === null || max === null) {
      setError('Vul een geldig getal in.');
      return;
    }
    const safeMin = Math.min(min, max);
    const safeMax = Math.max(min, max);
    if (safeMin === safeMax) {
      setError('Min en max moeten van elkaar verschillen.');
      return;
    }
    setError(null);
    const next = Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
    setValue(next);
    setHistory(prev => [next, ...prev].slice(0, HISTORY_LIMIT));
    pulseAnim.setValue(0.9);
    Animated.spring(pulseAnim, {
      toValue: 1,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Random number', headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <Animated.ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingTop: actionBarOffset }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Random number generator</Text>
            <Text style={styles.subtitle}>
              Ideaal voor Wavelength, beslissen of toewijzen. Trek een getal binnen je bereik.
            </Text>
          </View>

          <Card style={styles.resultCard}>
            <Text style={styles.resultLabel}>Uitkomst</Text>
            <Animated.Text style={[styles.resultValue, { transform: [{ scale: pulseAnim }] }]}>
              {value ?? '—'}
            </Animated.Text>
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Bereik</Text>
            <View style={styles.rangeRow}>
              <View style={styles.rangeField}>
                <Text style={styles.rangeLabel}>Min</Text>
                <TextInput
                  style={[styles.input, styles.rangeInput]}
                  keyboardType="numeric"
                  value={minInput}
                  onChangeText={setMinInput}
                />
              </View>
              <View style={styles.rangeField}>
                <Text style={styles.rangeLabel}>Max</Text>
                <TextInput
                  style={[styles.input, styles.rangeInput]}
                  keyboardType="numeric"
                  value={maxInput}
                  onChangeText={setMaxInput}
                />
              </View>
            </View>
            {error ? <Text style={styles.inputError}>{error}</Text> : null}
          </Card>

          <Button label="Genereer getal" onPress={generate} />

          {history.length > 0 && (
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Laatste worpen</Text>
              <View style={styles.historyRow}>
                {history.map((item, index) => (
                  <View key={`${item}-${index}`} style={styles.historyPill}>
                    <Text style={styles.historyText}>{item}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}
        </Animated.ScrollView>
      </KeyboardAvoidingView>
      <FloatingActions
        showSettings={false}
        showLifeBuoy={false}
        animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
      />
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
    resultCard: {
      alignItems: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.md,
    },
    resultLabel: {
      fontSize: Typography.label,
      color: palette.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    resultValue: {
      fontSize: 64,
      fontWeight: '800',
      color: palette.primary,
    },
    sectionCard: {
      gap: Spacing.sm,
    },
    sectionTitle: {
      fontSize: Typography.section,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    rangeRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    rangeField: {
      flex: 1,
      gap: Spacing.xs,
    },
    rangeLabel: {
      fontSize: Typography.label,
      color: palette.textSecondary,
      fontWeight: '600',
    },
    rangeInput: {
      textAlign: 'center',
    },
    input: {
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 10,
      padding: Spacing.sm,
      color: palette.textPrimary,
      backgroundColor: palette.surface,
    },
    inputError: {
      fontSize: Typography.caption,
      color: palette.danger,
    },
    historyRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
    },
    historyPill: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    historyText: {
      fontSize: Typography.label,
      color: palette.textPrimary,
      fontWeight: '600',
    },
  });
