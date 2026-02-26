import React, { useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, Linking } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTrip } from '@/contexts/TripContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { PreviewableImage } from '@/components/PreviewableImage';
import { Card } from '@/components/Card';
import { FloatingActions } from '@/components/FloatingActions';
import { Spacing, Typography } from '@/constants/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CrewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { participants } = useTrip();
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

  const person = useMemo(
    () => participants.find(p => p.id === id),
    [participants, id]
  );

  const handleCall = async (phone: string) => {
    const normalized = phone.replace(/[^0-9+]/g, '');
    const url = `tel:${normalized}`;
    if (await Linking.canOpenURL(url)) {
      Linking.openURL(url);
    }
  };

  if (!person) {
    return (
      <>
        <Stack.Screen options={{ title: 'Crewlid', headerShown: false }} />
        <View style={[styles.centerContainer, { paddingTop: actionBarOffset }]}>
          <Text style={styles.muted}>Crewlid niet gevonden.</Text>
        </View>
        <FloatingActions
          showSettings={false}
          showLifeBuoy={false}
          animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: person.naam, headerShown: false }} />
      <Animated.ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: actionBarOffset }]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        <Card style={styles.card}>
          {person.avatar ? (
            <PreviewableImage
              source={person.avatar}
              style={styles.avatar}
              accessibilityLabel={`Foto van ${person.naam}`}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{getInitials(person.naam)}</Text>
            </View>
          )}
          <Text style={styles.name}>{person.naam}</Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Bio</Text>
          <Text style={styles.body}>{person.bio || 'Bio volgt later.'}</Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Noodcontacten</Text>
          {person.emergencyContacts && person.emergencyContacts.length > 0 ? (
            person.emergencyContacts.map(contact => (
              <TouchableOpacity
                key={contact.telefoon}
                style={styles.contactRow}
                activeOpacity={0.7}
                onPress={() => handleCall(contact.telefoon)}
              >
                <Text style={styles.contactName}>{contact.naam}</Text>
                <Text style={styles.contactPhone}>{contact.telefoon}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.muted}>Nog geen noodcontacten toegevoegd.</Text>
          )}
        </Card>
      </Animated.ScrollView>
      <FloatingActions
        showSettings={false}
        showLifeBuoy={false}
        animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
      />
    </>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const createStyles = (palette: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  card: {
    gap: Spacing.xs,
  },
  avatar: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
  avatarPlaceholder: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: Typography.title,
    fontWeight: '700' as const,
    color: palette.textSecondary,
  },
  name: {
    fontSize: Typography.title,
    fontWeight: '700' as const,
    color: palette.textPrimary,
  },
  sectionTitle: {
    fontSize: Typography.section,
    fontWeight: '700' as const,
    color: palette.textPrimary,
  },
  body: {
    fontSize: Typography.body,
    color: palette.textPrimary,
    lineHeight: 22,
  },
  contactRow: {
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  contactName: {
    fontSize: Typography.body,
    fontWeight: '700' as const,
    color: palette.textPrimary,
  },
  contactPhone: {
    fontSize: Typography.label,
    color: palette.primary,
    marginTop: 2,
  },
  muted: {
    fontSize: Typography.label,
    color: palette.muted,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
});
;
