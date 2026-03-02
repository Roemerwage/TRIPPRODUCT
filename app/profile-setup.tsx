import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Check, ImagePlus, Lock, UserRound } from 'lucide-react-native';
import { useTrip } from '@/contexts/TripContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Radius, Spacing, Typography } from '@/constants/tokens';

export default function ProfileSetupScreen() {
  const {
    isLoading,
    hasActiveTrip,
    participants,
    myParticipantId,
    myParticipantAvatarUrl,
    profileClientId,
    claimedParticipantById,
    saveMyParticipantProfile,
  } = useTrip();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
  const [avatarUri, setAvatarUri] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (myParticipantId) {
      setSelectedParticipantId(myParticipantId);
    }
  }, [myParticipantId]);

  useEffect(() => {
    if (myParticipantAvatarUrl) {
      setAvatarUri(myParticipantAvatarUrl);
    }
  }, [myParticipantAvatarUrl]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!hasActiveTrip) {
    return <Redirect href="/join" />;
  }

  const pickAvatarFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Toegang nodig', 'Geef foto-toegang om een profielfoto te kiezen.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.65,
      base64: true,
      exif: false,
      selectionLimit: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (asset.base64) {
      const mimeType = asset.mimeType || 'image/jpeg';
      setAvatarUri(`data:${mimeType};base64,${asset.base64}`);
      return;
    }
    if (asset.uri) {
      setAvatarUri(asset.uri);
    }
  };

  const takeAvatarWithCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera-toegang nodig', 'Geef camera-toegang om direct een foto te maken.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.65,
      base64: true,
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (asset.base64) {
      const mimeType = asset.mimeType || 'image/jpeg';
      setAvatarUri(`data:${mimeType};base64,${asset.base64}`);
      return;
    }
    if (asset.uri) {
      setAvatarUri(asset.uri);
    }
  };

  const selectedParticipant = participants.find(person => person.id === selectedParticipantId) || null;

  const handleSave = async () => {
    if (!selectedParticipantId) {
      Alert.alert('Kies jezelf', 'Selecteer eerst welke deelnemer jij bent.');
      return;
    }
    const claimedByClientId = String(claimedParticipantById[selectedParticipantId] || '').trim();
    if (claimedByClientId && claimedByClientId !== profileClientId) {
      Alert.alert('Al geclaimd', 'Deze deelnemer is al geclaimd door iemand anders.');
      return;
    }
    try {
      setIsSaving(true);
      await saveMyParticipantProfile(selectedParticipantId, avatarUri || undefined);
      router.replace('/planning');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Opslaan mislukt.';
      Alert.alert('Opslaan mislukt', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Profiel kiezen', headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.lg },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={styles.card}>
            <Text style={styles.title}>Wie ben jij in deze trip?</Text>
            <Text style={styles.subtitle}>
              Kies je naam en voeg optioneel een profielfoto toe. Andere reizigers zien deze foto ook in de app.
            </Text>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Deelnemer kiezen</Text>
            <View style={styles.list}>
              {participants.map(person => {
                const isSelected = selectedParticipantId === person.id;
                const claimedByClientId = String(claimedParticipantById[person.id] || '').trim();
                const isClaimedByOther =
                  !!claimedByClientId &&
                  (!profileClientId || claimedByClientId !== profileClientId);
                return (
                  <TouchableOpacity
                    key={person.id}
                    style={[styles.row, isSelected && styles.rowSelected, isClaimedByOther && styles.rowDisabled]}
                    activeOpacity={0.85}
                    disabled={isClaimedByOther}
                    onPress={() => setSelectedParticipantId(person.id)}
                  >
                    {person.avatar ? (
                      <Image source={person.avatar} style={styles.rowAvatar} />
                    ) : (
                      <View style={styles.rowAvatarFallback}>
                        <Text style={styles.rowAvatarInitials}>{getInitials(person.naam)}</Text>
                      </View>
                    )}
                    <Text style={styles.rowName}>{person.naam}</Text>
                    {isClaimedByOther ? (
                      <View style={styles.claimBadge}>
                        <Lock size={14} color={colors.textSecondary} />
                        <Text style={styles.claimBadgeText}>Bezet</Text>
                      </View>
                    ) : isSelected ? (
                      <Check size={18} color={colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Profielfoto (optioneel)</Text>
            <View style={styles.previewWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.previewImage} />
              ) : selectedParticipant?.avatar ? (
                <Image source={selectedParticipant.avatar} style={styles.previewImage} />
              ) : (
                <View style={styles.previewPlaceholder}>
                  <UserRound size={28} color={colors.textSecondary} />
                </View>
              )}
            </View>
            <View style={styles.photoButtons}>
              <Button
                label="Maak foto"
                variant="secondary"
                onPress={takeAvatarWithCamera}
                icon={<Camera size={16} color={colors.primary} />}
              />
              <Button
                label="Kies foto"
                variant="secondary"
                onPress={pickAvatarFromLibrary}
                icon={<ImagePlus size={16} color={colors.primary} />}
              />
              {avatarUri ? (
                <Button label="Verwijder foto" variant="secondary" onPress={() => setAvatarUri('')} />
              ) : null}
            </View>
          </Card>

          <Button
            label={isSaving ? 'Opslaan...' : 'Profiel opslaan'}
            onPress={handleSave}
            disabled={isSaving || !selectedParticipantId}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function getInitials(name: string) {
  return String(name || '')
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.background,
    },
    content: {
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
    },
    card: {
      gap: Spacing.sm,
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
    sectionTitle: {
      fontSize: Typography.section,
      fontWeight: '700',
      color: palette.textPrimary,
    },
    list: {
      gap: Spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: Radius.sm,
      backgroundColor: palette.background,
    },
    rowSelected: {
      borderColor: palette.primary,
      backgroundColor: `${palette.primary}12`,
    },
    rowDisabled: {
      opacity: 0.5,
    },
    rowAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    rowAvatarFallback: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    rowAvatarInitials: {
      fontSize: Typography.label,
      fontWeight: '700',
      color: palette.textSecondary,
    },
    rowName: {
      flex: 1,
      fontSize: Typography.body,
      color: palette.textPrimary,
      fontWeight: '600',
    },
    claimBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    claimBadgeText: {
      fontSize: Typography.caption,
      color: palette.textSecondary,
      fontWeight: '700',
    },
    previewWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewImage: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: palette.surface,
    },
    previewPlaceholder: {
      width: 120,
      height: 120,
      borderRadius: 60,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    photoButtons: {
      flexDirection: 'row',
      gap: Spacing.sm,
      justifyContent: 'center',
      flexWrap: 'wrap',
    },
  });
