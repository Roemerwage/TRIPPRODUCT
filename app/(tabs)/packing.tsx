import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Stack } from 'expo-router';
import { useTrip } from '@/contexts/TripContext';
import { Package, Plus, X, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { FloatingActions } from '@/components/FloatingActions';
import { Radius, Spacing, Typography } from '@/constants/tokens';
import { SPOTIFY_PLAYLIST_URL } from '@/constants/spotify';

export default function PackingScreen() {
  const { packingList, togglePackingItem, addPackingItem, removePackingItem } = useTrip();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [categoryMode, setCategoryMode] = useState<'existing' | 'new'>('existing');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const insets = useSafeAreaInsets();
  const { colors } = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  const handleAddItem = async () => {
    if (!newItemName.trim()) {
      Alert.alert('Fout', 'Vul een naam in');
      return;
    }

    const category =
      categoryMode === 'new' ? customCategory.trim() : selectedCategory.trim();

    if (!category) {
      Alert.alert('Fout', 'Kies of maak een categorie');
      return;
    }

    await addPackingItem(newItemName, category);
    setNewItemName('');
    setCustomCategory('');
    setShowAddModal(false);
  };

  const groupedItems = packingList.reduce((acc, item) => {
    if (!acc[item.categorie]) {
      acc[item.categorie] = [];
    }
    acc[item.categorie].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  const categories = Object.keys(groupedItems).sort();

  // Exclude 'Persoonlijk' / personal items from the global progress counters
  const isPersonalItem = (item: any) => item.categorie === 'Persoonlijk' || item.personal === true;
  const countedItems = packingList.filter(item => !isPersonalItem(item));
  const checkedCount = countedItems.filter(item => item.checked).length;
  const totalCount = countedItems.length;
  const progressPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  useEffect(() => {
    if (!showAddModal) {
      return;
    }

    if (categories.length > 0) {
      setCategoryMode('existing');
      setSelectedCategory(prev => prev || categories[0]);
    } else {
      setCategoryMode('new');
    }
  }, [categories, showAddModal]);

  if (packingList.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Paklijst' }} />
        <View style={[styles.emptyContainer, { paddingTop: actionBarOffset }]}>
          <EmptyState
            title="Nog geen paklijst"
            subtitle="Importeer je planning voor suggesties"
            icon={<Package size={56} color={colors.muted} />}
          />
        </View>
        <FloatingActions
          showSettings
          showLifeBuoy
          showBack={false}
          showSpotify
          spotifyUrl={SPOTIFY_PLAYLIST_URL}
          animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Paklijst' }} />
      <View style={[styles.container, { paddingTop: actionBarOffset }]}>
        <Card style={styles.headerCard}>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${progressPercent}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {checkedCount} van {totalCount} ingepakt
            </Text>
          </View>
          
          <Button
            label="Toevoegen"
            onPress={() => setShowAddModal(true)}
            icon={<Plus size={20} color="#FFFFFF" />}
            style={styles.addButton}
          />
        </Card>

        <Animated.ScrollView
          contentContainerStyle={styles.content}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {categories.map(category => (
            <View key={category} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category}</Text>
              {category === 'Persoonlijk' && (
                <Text style={styles.personalDescription}>
                  Persoonlijk: iedereen neemt dit mee en draagt het bij zich. Daar kopen kan ook.
                </Text>
              )}
              {groupedItems[category].map(item => (
                <View key={item.id} style={styles.itemRow}>
                  <TouchableOpacity
                    style={styles.itemContent}
                    onPress={() => togglePackingItem(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                      {item.checked && <Check size={16} color="#FFFFFF" />}
                    </View>
                    <Text style={[styles.itemText, item.checked && styles.itemTextChecked]}>
                      {item.naam}
                    </Text>
                    {item.suggested && (
                      <View style={styles.suggestedBadge}>
                        <Text style={styles.suggestedText}>Auto</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  
                  {!item.suggested && (
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert(
                          'Item verwijderen?',
                          `Wil je "${item.naam}" verwijderen?`,
                          [
                            { text: 'Annuleren', style: 'cancel' },
                            {
                              text: 'Verwijderen',
                              style: 'destructive',
                              onPress: () => removePackingItem(item.id),
                            },
                          ]
                        );
                      }}
                    >
                      <X size={20} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          ))}
        </Animated.ScrollView>
      </View>

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Item toevoegen</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <X size={24} color="#4A5568" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Naam van het item"
                placeholderTextColor={colors.muted}
                value={newItemName}
                onChangeText={setNewItemName}
                autoFocus
              />

              <Text style={styles.inputLabel}>Categorie</Text>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeButton, categoryMode === 'existing' && styles.modeButtonActive]}
                  onPress={() => setCategoryMode('existing')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.modeButtonText, categoryMode === 'existing' && styles.modeButtonTextActive]}
                  >
                    Bestaand
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeButton, categoryMode === 'new' && styles.modeButtonActive]}
                  onPress={() => setCategoryMode('new')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modeButtonText, categoryMode === 'new' && styles.modeButtonTextActive]}>
                    Nieuw
                  </Text>
                </TouchableOpacity>
              </View>

              {categoryMode === 'existing' ? (
                <View style={styles.categoryChips}>
                  {categories.map(category => (
                    <Chip
                      key={category}
                      label={category}
                      selected={selectedCategory === category}
                      onPress={() => setSelectedCategory(category)}
                    />
                  ))}
                </View>
              ) : (
                <TextInput
                  style={styles.input}
                  placeholder="Nieuwe categorie"
                  placeholderTextColor={colors.muted}
                  value={customCategory}
                  onChangeText={setCustomCategory}
                />
              )}

              <Button label="Toevoegen" onPress={handleAddItem} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <FloatingActions
        showSettings
        showLifeBuoy
        showBack={false}
        showSpotify
        spotifyUrl={SPOTIFY_PLAYLIST_URL}
        animatedStyle={{ transform: [{ translateY: actionBarTranslate }], opacity: actionBarOpacity }}
      />
    </>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.background,
    paddingHorizontal: Spacing.xl,
  },
  headerCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  progressContainer: {
    marginBottom: Spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: palette.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.success,
    borderRadius: 4,
  },
  progressText: {
    fontSize: Typography.label,
    color: palette.textSecondary,
    textAlign: 'center',
  },
  addButton: {
    alignSelf: 'stretch',
  },
  content: {
    padding: Spacing.md,
  },
  categorySection: {
    marginBottom: Spacing.lg,
  },
  categoryTitle: {
    fontSize: Typography.section,
    fontWeight: '700' as const,
    color: palette.textPrimary,
    marginBottom: Spacing.sm,
  },
  personalDescription: {
    fontSize: Typography.caption,
    color: palette.textSecondary,
    marginBottom: Spacing.xs,
    fontStyle: 'italic',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  itemText: {
    fontSize: Typography.body,
    color: palette.textPrimary,
    flexShrink: 1,
  },
  itemTextChecked: {
    color: palette.textSecondary,
    textDecorationLine: 'line-through',
  },
  suggestedBadge: {
    marginLeft: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: palette.background,
    borderWidth: 1,
    borderColor: palette.border,
  },
  suggestedText: {
    fontSize: Typography.caption,
    color: palette.textSecondary,
    fontWeight: '600' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  modalContent: {
    backgroundColor: palette.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    maxHeight: '85%',
  },
  modalScroll: {
    paddingBottom: Spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: Typography.section,
    fontWeight: '700' as const,
    color: palette.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    color: palette.textPrimary,
    backgroundColor: palette.surface,
  },
  inputLabel: {
    fontSize: Typography.label,
    color: palette.textSecondary,
    marginBottom: Spacing.xs,
  },
  modeRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  modeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    backgroundColor: palette.background,
  },
  modeButtonActive: {
    backgroundColor: palette.primary,
  },
  modeButtonText: {
    fontSize: Typography.label,
    fontWeight: '600' as const,
    color: palette.textSecondary,
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
});
