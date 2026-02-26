import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useThemeMode } from '@/contexts/ThemeContext';

export default function NotFoundScreen() {
  const { colors } = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <>
      <Stack.Screen options={{ title: 'Niet gevonden' }} />
      <View style={styles.container}>
        <Text style={styles.text}>Deze pagina bestaat niet.</Text>

        <Link href="/planning" style={styles.link}>
          <Text style={styles.linkText}>Ga naar planning</Text>
        </Link>
      </View>
    </>
  );
}

const createStyles = (palette: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      backgroundColor: palette.background,
    },
    text: {
      fontSize: 24,
      color: palette.textPrimary,
      marginBottom: 12,
    },
    link: {
      marginTop: 15,
      paddingVertical: 15,
    },
    linkText: {
      fontSize: 16,
      color: palette.primary,
      fontWeight: '700',
    },
  });
