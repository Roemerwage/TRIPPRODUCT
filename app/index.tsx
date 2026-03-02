import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useTrip } from '@/contexts/TripContext';
import { useThemeMode } from '@/contexts/ThemeContext';

export default function Index() {
  const { isLoading, hasActiveTrip, needsProfileSetup } = useTrip();
  const { colors } = useThemeMode();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={hasActiveTrip ? (needsProfileSetup ? '/profile-setup' : '/planning') : '/join'} />;
}
