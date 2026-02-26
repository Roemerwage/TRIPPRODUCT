import React, { useMemo, useRef, useState } from 'react';
import { Alert, Animated, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTrip } from '@/contexts/TripContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FloatingActions } from '@/components/FloatingActions';
import { Radius, Spacing, Typography } from '@/constants/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TEST_NOTIFICATION_PASSWORD, isTestNotificationPasswordConfigured } from '@/constants/security';

export default function SettingsScreen() {
  const { days, loadInitialTripData, sendTestNotificationForDay, importTripManifest } = useTrip();
  const [selectedTestDayId, setSelectedTestDayId] = useState<string | null>(null);
  const [testPassword, setTestPassword] = useState('');
  const [manifestInput, setManifestInput] = useState('');
  const [isImportingManifest, setIsImportingManifest] = useState(false);
  const { colors, mode, setThemeMode, resolvedMode } = useThemeMode();
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

  const dayOptions = useMemo(
    () =>
      days.map(day => ({
        id: day.datum.toISOString(),
        label: `${day.datum.getDate()} ${getMonthName(day.datum.getMonth())} — ${day.stadRegio}`,
      })),
    [days]
  );

  const handleReload = async () => {
    Alert.alert(
      'Standaardplanning herladen?',
      'Je huidige planning wordt overschreven met de standaardreis.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Herladen',
          style: 'destructive',
          onPress: async () => {
            await loadInitialTripData();
            Alert.alert('Gelukt', 'Standaardplanning is herladen.');
          },
        },
      ]
    );
  };

  const handleSendTestNotification = async () => {
    if (!isTestNotificationPasswordConfigured) {
      Alert.alert('Wachtwoord ontbreekt', 'Stel een testmelding-wachtwoord in de app config in.');
      return;
    }

    if (testPassword !== TEST_NOTIFICATION_PASSWORD) {
      Alert.alert('Onjuist wachtwoord', 'Controleer het wachtwoord en probeer opnieuw.');
      return;
    }

    const targetDay = days.find(d => d.datum.toISOString() === selectedTestDayId);
    if (!targetDay) return;
    await sendTestNotificationForDay(targetDay);
    setTestPassword('');
    Alert.alert('Verstuurd', 'Testmelding staat klaar (binnen enkele seconden).');
  };

  const handleImportManifest = async () => {
    const trimmedInput = manifestInput.trim();
    if (!trimmedInput) {
      Alert.alert('Geen data', 'Plak eerst een geldig trip manifest (JSON).');
      return;
    }

    try {
      setIsImportingManifest(true);
      await importTripManifest(trimmedInput);
      setManifestInput('');
      Alert.alert('Geimporteerd', 'Trip manifest is geladen.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Importeren mislukt.';
      Alert.alert('Import mislukt', message);
    } finally {
      setIsImportingManifest(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Instellingen', headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={actionBarOffset}
        style={styles.flex}
      >
        <Animated.ScrollView
          style={styles.container}
          contentContainerStyle={[styles.content, { paddingTop: actionBarOffset }]}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
        >
        <Card style={styles.card}>
          <Text style={styles.title}>Rad van fortuin & app</Text>
          <Text style={styles.subtitle}>Beheer snelle acties vanuit één plek.</Text>

          <Button
            label="Herladen standaardplanning"
            onPress={() => handleReload()}
            style={styles.fullWidthButton}
          />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.title}>Thema</Text>
          <Text style={styles.subtitle}>Kies systeem, licht of donker. Systeem volgt je iOS-instelling.</Text>
          <View style={styles.optionList}>
            {[
              { key: 'system', label: 'Systeem' },
              { key: 'light', label: 'Licht' },
              { key: 'dark', label: 'Donker' },
            ].map(opt => {
              const isSelected = mode === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                  onPress={() => setThemeMode(opt.key as any)}
                >
                  <View style={[styles.radio, isSelected && styles.radioSelected]} />
                  <Text style={styles.optionLabel}>
                    {opt.label}
                    {opt.key === 'system' ? ` (${resolvedMode === 'dark' ? 'donker' : 'licht'})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.title}>Trip manifest import</Text>
          <Text style={styles.subtitle}>
            Plak een trip manifest in JSON-formaat. Dit overschrijft de huidige planning en crewdata.
          </Text>
          <TextInput
            value={manifestInput}
            onChangeText={setManifestInput}
            placeholder="Plak hier je JSON manifest"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            textAlignVertical="top"
            style={[styles.input, styles.manifestInput, { borderColor: colors.border, color: colors.textPrimary }]}
          />
          <Button
            label={isImportingManifest ? 'Importeren...' : 'Importeer manifest'}
            onPress={handleImportManifest}
            disabled={isImportingManifest || !manifestInput.trim()}
            style={styles.fullWidthButton}
          />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.title}>Testmelding sturen</Text>
          <Text style={styles.subtitle}>
            Kies een dag en stuur direct een test pushmelding om te checken of alles werkt.
          </Text>
          <View style={styles.optionList}>
            {dayOptions.map(day => {
              const isSelected = selectedTestDayId === day.id;
              return (
                <TouchableOpacity
                  key={day.id}
                  style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                  onPress={() => setSelectedTestDayId(day.id)}
                >
                  <View style={[styles.radio, isSelected && styles.radioSelected]} />
                  <Text style={styles.optionLabel}>{day.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Wachtwoord</Text>
            <TextInput
              value={testPassword}
              onChangeText={setTestPassword}
              placeholder="Voer wachtwoord in"
              secureTextEntry
              placeholderTextColor={colors.muted}
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
            />
          </View>
          <Button
            label="Verstuur testmelding"
            onPress={handleSendTestNotification}
            disabled={!selectedTestDayId || !testPassword}
            style={styles.fullWidthButton}
          />
        </Card>
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

function getMonthName(month: number): string {
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return months[month];
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    flex: {
      flex: 1,
    },
    content: {
      padding: Spacing.md,
      paddingBottom: Spacing.lg,
      gap: Spacing.sm,
    },
    card: {
      gap: Spacing.sm,
    },
    title: {
      fontSize: Typography.section,
      fontWeight: '700' as const,
      color: palette.textPrimary,
    },
    subtitle: {
      fontSize: Typography.label,
      color: palette.muted,
      lineHeight: 20,
    },
    optionList: {
      gap: Spacing.xs,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      borderRadius: Radius.sm,
    },
    optionRowSelected: {
      backgroundColor: `${palette.primary}1A`,
    },
    optionLabel: {
      fontSize: Typography.body,
      color: palette.textPrimary,
    },
    radio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: palette.border,
    },
    radioSelected: {
      borderColor: palette.primary,
      backgroundColor: palette.primary,
    },
    inputGroup: {
      gap: Spacing.xs,
      marginTop: Spacing.sm,
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
    manifestInput: {
      minHeight: 140,
      fontFamily: Platform.select({
        ios: 'Menlo',
        android: 'monospace',
        default: 'monospace',
      }),
    },
    fullWidthButton: {
      alignSelf: 'stretch',
    },
  });
