import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeMode } from '@/contexts/ThemeContext';
import { useTrip } from '@/contexts/TripContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Radius, Spacing, Typography } from '@/constants/tokens';

export default function JoinTripScreen() {
  const { colors } = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoading, hasActiveTrip, needsProfileSetup, activateTripByCode } = useTrip();
  const [tripCode, setTripCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (hasActiveTrip) {
    return <Redirect href={needsProfileSetup ? "/profile-setup" : "/planning"} />;
  }

  const handleSubmit = async (overrideCode?: string) => {
    const inputCode = (overrideCode ?? tripCode).trim();
    if (!inputCode) {
      Alert.alert('Tripcode nodig', 'Vul eerst een geldige tripcode in.');
      return;
    }

    try {
      setIsSubmitting(true);
      const activation = await activateTripByCode(inputCode);
      setTripCode('');
      router.replace(activation?.needsProfileSetup ? '/profile-setup' : '/planning');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Trip laden mislukt.';
      Alert.alert('Tripcode ongeldig', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Trip laden', headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}
        style={styles.container}
      >
        <View style={[styles.content, { paddingTop: insets.top + Spacing.lg }]}>
          <Card style={styles.card}>
            <Text style={styles.title}>Trip laden</Text>
            <Text style={styles.subtitle}>
              Vul je tripcode in om de planning, crew en verblijven van jouw reis te laden.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tripcode</Text>
              <TextInput
                value={tripCode}
                onChangeText={setTripCode}
                placeholder="Bijv. RIO2026"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                onSubmitEditing={() => handleSubmit()}
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
              />
            </View>

            <Button
              label={isSubmitting ? 'Laden...' : 'Laad trip'}
              onPress={() => handleSubmit()}
              disabled={isSubmitting || !tripCode.trim()}
              style={styles.primaryButton}
            />
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Demo</Text>
            <Text style={styles.subtitle}>
              Gebruik tijdelijk de demo-code totdat de website/API-koppeling live staat.
            </Text>
            <Button
              label="Gebruik DEMO"
              variant="secondary"
              onPress={() => handleSubmit('DEMO')}
              disabled={isSubmitting}
            />
          </Card>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    centerContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
    },
    card: {
      gap: Spacing.sm,
    },
    title: {
      fontSize: Typography.title,
      fontWeight: '700' as const,
      color: palette.textPrimary,
    },
    sectionTitle: {
      fontSize: Typography.section,
      fontWeight: '700' as const,
      color: palette.textPrimary,
    },
    subtitle: {
      fontSize: Typography.body,
      color: palette.textSecondary,
      lineHeight: 22,
    },
    inputGroup: {
      gap: Spacing.xs,
    },
    inputLabel: {
      fontSize: Typography.label,
      color: palette.textSecondary,
    },
    input: {
      borderWidth: 1,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.sm,
      fontSize: Typography.body,
    },
    primaryButton: {
      marginTop: Spacing.xs,
    },
  });
