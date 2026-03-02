import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Linking, Platform, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTrip } from '@/contexts/TripContext';
import MapView, { Marker } from 'react-native-maps';
import {
  Calendar,
  Home,
  Route,
  Mountain,
  PartyPopper,
  Globe,
  SunMedium,
  Plane,
  Goal,
  Coffee,
  Sandwich,
  UtensilsCrossed,
  Wine,
} from 'lucide-react-native';
import { Activity, ActivityType, Day } from '@/types/trip';
import {
  FREE_DAY_MARKERS,
  TIP_TYPE_META,
  TipMarker,
  extractCoordinatesFromLink,
  fetchPublicTipsLibrary,
  getAccommodationCoordinate,
  getAccommodationMedia,
  getActivityCoordinate,
  getActivityLink,
  getActivityTypeColor,
  resolveCoordinatesFromGoogleMapsLink,
} from '@/constants/media';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { FloatingActions } from '@/components/FloatingActions';
import { Spacing } from '@/constants/tokens';
import { SPOTIFY_PLAYLIST_URL } from '@/constants/spotify';

export default function MapScreen() {
  const { days, activeManifest } = useTrip();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'tips' | string>('all');
  const [tipsLibrary, setTipsLibrary] = useState<TipMarker[] | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const resolvingLinksRef = useRef<Set<string>>(new Set());
  const fitDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapLayoutReady, setMapLayoutReady] = useState(false);
  const [resolvedLinkCoordinates, setResolvedLinkCoordinates] = useState<Record<string, { latitude: number; longitude: number } | null>>({});
  const { colors } = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const actionBarOffset = insets.top + 44;

  useEffect(() => {
    if (selectedFilter !== 'all' && selectedFilter !== 'tips' && !days.some(day => day.datum.toISOString() === selectedFilter)) {
      setSelectedFilter('all');
    }
  }, [days, selectedFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const apiTips = await fetchPublicTipsLibrary();
      if (cancelled) return;
      if (Array.isArray(apiTips)) {
        setTipsLibrary(apiTips);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredDays = useMemo(() => {
    if (selectedFilter === 'all') {
      return days;
    }
    if (selectedFilter === 'tips') {
      return [];
    }
    return days.filter(day => day.datum.toISOString() === selectedFilter);
  }, [days, selectedFilter]);

  const selectedTipIds = useMemo(() => {
    const raw = activeManifest?.trip?.tipIds;
    if (!Array.isArray(raw)) return [];
    return Array.from(
      new Set(
        raw
          .map(id => String(id || '').trim())
          .filter(Boolean)
      )
    );
  }, [activeManifest]);
  const hasTripTipSelection = Array.isArray(activeManifest?.trip?.tipIds);

  const reusableTips = useMemo(() => {
    const allTips = Array.isArray(tipsLibrary) ? tipsLibrary : [];
    if (!hasTripTipSelection) return [];
    const selected = new Set(selectedTipIds);
    return allTips.filter(tip => tip.active !== false && selected.has(String(tip.id || '')));
  }, [tipsLibrary, selectedTipIds, hasTripTipSelection]);

  const isValidAccommodation = (day: Day) => {
    const name = day.verblijf?.trim().toLowerCase();
    if (!name || name === 'x' || name === 'unknown') return false;
    if (name.includes('verblijf x')) return false;
    if (day.stadRegio?.trim().toLowerCase().includes('terugreis')) return false;
    return true;
  };

  const normalizeLink = useCallback((link?: string | null) => {
    const normalized = String(link || '').trim();
    if (!normalized || normalized === 'x' || normalized.toLowerCase() === 'unknown') return '';
    return normalized;
  }, []);

  const getCoordinateFromLink = useCallback(
    (link?: string | null) => {
      const normalizedLink = normalizeLink(link);
      if (!normalizedLink) return undefined;
      return extractCoordinatesFromLink(normalizedLink) || resolvedLinkCoordinates[normalizedLink] || undefined;
    },
    [normalizeLink, resolvedLinkCoordinates]
  );

  const linksToResolve = useMemo(() => {
    const candidates = new Set<string>();
    const pushIfNeeded = (link?: string | null) => {
      const normalizedLink = normalizeLink(link);
      if (!normalizedLink) return;
      if (extractCoordinatesFromLink(normalizedLink)) return;
      if (resolvedLinkCoordinates[normalizedLink] !== undefined) return;
      candidates.add(normalizedLink);
    };

    filteredDays.forEach(day => {
      pushIfNeeded(day.verblijfMapsLink);

      day.activiteiten.forEach(activity => {
        pushIfNeeded(getActivityLink(activity));
      });
    });

    reusableTips.forEach(tip => {
      pushIfNeeded(tip.link);
    });

    return Array.from(candidates);
  }, [filteredDays, normalizeLink, resolvedLinkCoordinates, reusableTips]);

  useEffect(() => {
    if (linksToResolve.length === 0) return;

    let cancelled = false;
    linksToResolve.forEach(link => {
      if (resolvingLinksRef.current.has(link)) return;
      resolvingLinksRef.current.add(link);

      void (async () => {
        try {
          const coordinate = await resolveCoordinatesFromGoogleMapsLink(link);
          if (cancelled) return;

          setResolvedLinkCoordinates(prev => {
            if (prev[link] !== undefined) return prev;
            return { ...prev, [link]: coordinate ?? null };
          });
        } finally {
          resolvingLinksRef.current.delete(link);
        }
      })();
    });

    return () => {
      cancelled = true;
    };
  }, [linksToResolve]);

  const activitiesWithCoords = useMemo(() => {
    if (filteredDays.length === 0) return [];
    return filteredDays.flatMap(day =>
      day.activiteiten
        .map(activity => {
          if (activity.type === 'free_day' || activity.type === 'flight') return null;
          const link = getActivityLink(activity);
          const normalizedActivityLink = normalizeLink(link);
          const normalizedLodgingLink = normalizeLink(day.verblijfMapsLink);
          if (normalizedActivityLink && normalizedLodgingLink && normalizedActivityLink === normalizedLodgingLink) {
            return null;
          }
          const coordinate = getCoordinateFromLink(link) || getActivityCoordinate(activity, day.stadRegio);
          if (!coordinate) return null;
          return { activity, coordinate, day, link };
        })
        .filter(Boolean) as {
          activity: Activity;
          coordinate: { latitude: number; longitude: number };
          day: Day;
          link?: string | null;
        }[]
    );
  }, [filteredDays, getCoordinateFromLink, normalizeLink]);

  const accommodationMarkers = useMemo(() => {
    if (filteredDays.length === 0) return [];
    const grouped = new Map<
      string,
      {
        id: string;
        name: string;
        region: string;
        coordinate: { latitude: number; longitude: number };
        link?: string | null;
        nights: number;
      }
    >();

    filteredDays.forEach(day => {
      if (!isValidAccommodation(day)) return;
      if (day.verblijf?.trim().toLowerCase().includes('airport')) return;
      const media = getAccommodationMedia(day.verblijf);
      const link = day.verblijfMapsLink && day.verblijfMapsLink !== 'x'
        ? day.verblijfMapsLink
        : media?.link;
      const coordinate =
        getAccommodationCoordinate(day.verblijf, undefined, day.verblijfMapsLink) ||
        getCoordinateFromLink(link);
      if (!coordinate) return;

      const id = `${normalizeKey(day.verblijf)}-${coordinateKey(coordinate)}`;
      const existing = grouped.get(id);
      if (existing) {
        existing.nights += 1;
        return;
      }

      grouped.set(id, {
        id,
        name: day.verblijf,
        region: day.stadRegio,
        coordinate,
        link,
        nights: 1,
      });
    });

    return Array.from(grouped.values());
  }, [filteredDays, getCoordinateFromLink]);

  const showFreeDayMarkers = useMemo(
    () =>
      filteredDays.some(day =>
        day.activiteiten.some(activity => activity.type === 'free_day')
      ),
    [filteredDays]
  );

  const showTips = selectedFilter === 'all' || selectedFilter === 'tips';

  const existingMarkerTitles = useMemo(() => {
    const titles = new Set<string>();
    activitiesWithCoords.forEach(item => titles.add(normalizeKey(item.activity.naam)));
    accommodationMarkers.forEach(item => titles.add(normalizeKey(item.name)));
    return titles;
  }, [activitiesWithCoords, accommodationMarkers]);

  const visibleTipMarkers = useMemo(() => {
    if (!showTips) return [];
    if (existingMarkerTitles.size === 0) return reusableTips;
    return reusableTips.filter(marker => !existingMarkerTitles.has(normalizeKey(marker.title)));
  }, [showTips, existingMarkerTitles, reusableTips]);

  const visibleTipMarkersWithCoords = useMemo(
    () =>
      visibleTipMarkers
        .map(marker => {
          const coordinate = marker.coordinate || getCoordinateFromLink(marker.link);
          if (!coordinate) return null;
          return { ...marker, coordinate };
        })
        .filter(Boolean) as (TipMarker & { coordinate: { latitude: number; longitude: number } })[],
    [visibleTipMarkers, getCoordinateFromLink]
  );

  const tipCoords = visibleTipMarkersWithCoords.map(marker => marker.coordinate);

  const coordinates = useMemo(() => {
    const freeDayCoords = showFreeDayMarkers ? FREE_DAY_MARKERS.map(marker => marker.coordinate) : [];
    if (
      activitiesWithCoords.length === 0 &&
      accommodationMarkers.length === 0 &&
      freeDayCoords.length === 0 &&
      tipCoords.length === 0
    ) {
      return [];
    }
    return [
      ...activitiesWithCoords.map(item => item.coordinate),
      ...accommodationMarkers.map(item => item.coordinate),
      ...freeDayCoords,
      ...tipCoords,
    ];
  }, [activitiesWithCoords, accommodationMarkers, showFreeDayMarkers, tipCoords]);

  const initialRegion = useMemo(() => {
    return {
      latitude: -22.9068,
      longitude: -43.1729,
      latitudeDelta: 1.2,
      longitudeDelta: 1.2,
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!mapReady || !mapLayoutReady) return;

    const minCoordinates = selectedFilter === 'all' ? 2 : 1;
    if (coordinates.length < minCoordinates) return;

    if (fitDebounceRef.current) {
      clearTimeout(fitDebounceRef.current);
    }

    // Batch fast coordinate updates while link resolving is running.
    fitDebounceRef.current = setTimeout(() => {
      try {
        requestAnimationFrame(() => {
          mapRef.current?.fitToCoordinates(coordinates, {
            edgePadding: { top: 80, right: 40, bottom: 120, left: 40 },
            animated: true,
          });
        });
      } catch (err) {
        console.warn('fitToCoordinates failed', err);
      }
    }, 140);

    return () => {
      if (fitDebounceRef.current) {
        clearTimeout(fitDebounceRef.current);
        fitDebounceRef.current = null;
      }
    };
  }, [coordinates, selectedFilter, mapReady, mapLayoutReady]);

  const dayChips = useMemo(() => {
    return [
      {
        key: 'all' as const,
        label: 'Alles',
        subLabel: `${days.length} dagen`,
      },
      {
        key: 'tips' as const,
        label: 'Tips',
        subLabel: `${reusableTips.length} tips`,
      },
      ...days.map(day => ({
        key: day.datum.toISOString(),
        label: `${day.datum.getDate()} ${getMonthName(day.datum.getMonth())}`,
        subLabel: day.stadRegio,
      })),
    ];
  }, [days, reusableTips.length]);

  if (Platform.OS === 'web') {
    return (
      <>
        <Stack.Screen options={{ title: 'Kaart' }} />
        <View style={[styles.emptyContainer, { paddingTop: actionBarOffset }]}>
          <EmptyState
            title="Kaart niet beschikbaar op web"
            subtitle="Open de app op iOS/Android voor de kaart."
          />
        </View>
        <FloatingActions
          showSettings
          showLifeBuoy
          showBack={false}
          showSpotify
          spotifyUrl={SPOTIFY_PLAYLIST_URL}
        />
      </>
    );
  }

  if (days.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Kaart' }} />
        <View style={[styles.emptyContainer, { paddingTop: actionBarOffset }]}>
          <EmptyState
            title="Importeer eerst je planning"
            icon={<Calendar size={56} color={colors.muted} />}
          />
        </View>
        <FloatingActions
          showSettings
          showLifeBuoy
          showBack={false}
          showSpotify
          spotifyUrl={SPOTIFY_PLAYLIST_URL}
        />
      </>
    );
  }

  const openMapsLink = (link?: string | null, fallbackLabel?: string) => {
    if (link && link !== 'x' && link.toLowerCase() !== 'unknown') {
      Linking.openURL(link);
    } else if (fallbackLabel) {
      const query = encodeURIComponent(fallbackLabel);
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    }
  };

  const showTipDetails = (title: string, typeLabel: string, emoji: string, description: string, link: string) => {
    const message = `${emoji} ${typeLabel}\n\n${description}`;
    Alert.alert(title, message, [
      { text: 'Open in Maps', onPress: () => openMapsLink(link, title) },
      { text: 'Sluiten', style: 'cancel' },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Kaart' }} />
      <View style={[styles.container, { paddingTop: actionBarOffset }]}>
        <View style={styles.daySelector}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.daySelectorContent}
          >
            {dayChips.map(chip => {
              const isActive = chip.key === selectedFilter;
              return (
                <Chip
                  key={chip.key}
                  label={chip.label}
                  subLabel={chip.subLabel}
                  selected={isActive}
                  onPress={() => setSelectedFilter(chip.key)}
                  style={styles.dayChip}
                />
              );
            })}
          </ScrollView>
        </View>

        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          onMapReady={() => setMapReady(true)}
          onLayout={() => setMapLayoutReady(true)}
        >
          {accommodationMarkers.map(({ id, name, region, nights, coordinate, link }) => (
            <Marker
              key={id}
              coordinate={coordinate}
              title={name}
              description={`Verblijf • ${region}${nights > 1 ? ` • ${nights} nachten` : ''}`}
              onCalloutPress={() => {
                if (name) {
                  router.push(`/accommodation/${encodeURIComponent(name)}`);
                } else {
                  openMapsLink(link, name);
                }
              }}
            >
                <View style={[styles.markerIcon, styles.homeMarker]}>
                  <Home size={22} color="#FFFFFF" />
                </View>
              </Marker>
          ))}

          {activitiesWithCoords.map(({ activity, coordinate, day, link }) => {
            const isMatch =
              activity.naam?.toLowerCase().includes('botafogo') &&
              activity.naam?.toLowerCase().includes('bangu');
            const IconComponent = isMatch ? Goal : ACTIVITY_ICON_MAP[activity.type] || Globe;
            const color = getActivityTypeColor(activity.type);
            const normalizedName = activity.naam?.trim().toLowerCase();
            const activityEmoji =
              normalizedName?.includes('paragl')
                ? '🪂'
                : normalizedName?.includes('cristo redentor')
                ? '✝️'
                : normalizedName?.includes('favela')
                ? '🏘️'
                : null;
            const displayTime = activity.verzamelTijd || activity.startTijd;
            const timeStr = displayTime
              ? `${String(displayTime.getHours()).padStart(2, '0')}:${String(displayTime.getMinutes()).padStart(2, '0')}`
              : 'TBA';
            const dayLabel = selectedFilter === 'all' ? `${day.dagNaam} • ` : '';
            return (
              <Marker
                key={activity.id}
                coordinate={coordinate}
                title={activity.naam}
                description={`${dayLabel}${day.stadRegio} • ${timeStr}`}
                onCalloutPress={() => openMapsLink(link, activity.locatie || day.stadRegio)}
              >
                <View style={[styles.markerIcon, { backgroundColor: color }]}>
                  {activityEmoji ? (
                    <Text style={styles.activityEmoji}>{activityEmoji}</Text>
                  ) : (
                    <IconComponent size={18} color="#FFFFFF" />
                  )}
                </View>
              </Marker>
            );
          })}

          {showFreeDayMarkers &&
            FREE_DAY_MARKERS.map(marker => {
              const IconComponent = ACTIVITY_ICON_MAP[marker.type] || Globe;
              return (
                <Marker
                  key={marker.id}
                  coordinate={marker.coordinate}
                  title={marker.title}
                  description={marker.description}
                  onCalloutPress={() => openMapsLink(marker.link, marker.title)}
                >
                  <View style={[styles.markerIcon, { backgroundColor: getActivityTypeColor(marker.type) }]}>
                    <IconComponent size={18} color="#FFFFFF" />
                  </View>
                </Marker>
              );
            })}

          {showTips &&
            visibleTipMarkersWithCoords.map(marker => {
              const meta = TIP_TYPE_META[marker.type];
              const tipEmoji = marker.emoji || meta.emoji;
              return (
                <Marker
                  key={marker.id}
                  coordinate={marker.coordinate}
                  title={marker.title}
                  description={`${tipEmoji} ${meta.label} • ${marker.description}`}
                  onCalloutPress={() =>
                    showTipDetails(marker.title, meta.label, tipEmoji, marker.description, marker.link)
                  }
                >
                  <View style={[styles.markerIcon, { backgroundColor: meta.color }]}>
                    <Text style={styles.tipEmoji}>{tipEmoji}</Text>
                  </View>
                </Marker>
              );
            })}
        </MapView>

      </View>
      <FloatingActions
        showSettings
        showLifeBuoy
        showBack={false}
        showSpotify
        spotifyUrl={SPOTIFY_PLAYLIST_URL}
      />
    </>
  );
}

const ACTIVITY_ICON_MAP: Record<ActivityType, React.ComponentType<{ size: number; color: string }>> = {
  travel: Route,
  tour: Globe,
  hike: Mountain,
  event: PartyPopper,
  breakfast: Coffee,
  lunch: Sandwich,
  dinner: UtensilsCrossed,
  drinks: Wine,
  free_day: SunMedium,
  flight: Plane,
};

const normalizeKey = (value?: string | null) =>
  value
    ? value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase()
    : '';

const coordinateKey = (coordinate: { latitude: number; longitude: number }) =>
  `${coordinate.latitude.toFixed(5)},${coordinate.longitude.toFixed(5)}`;

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
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: palette.background,
      paddingHorizontal: Spacing.xl,
    },
    daySelector: {
      backgroundColor: palette.surface,
      paddingVertical: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    daySelectorContent: {
      paddingHorizontal: Spacing.sm,
    },
    dayChip: {
      marginHorizontal: 4,
    },
    map: {
      flex: 1,
    },
    markerIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    tipEmoji: {
      fontSize: 14,
    },
    activityEmoji: {
      fontSize: 18,
    },
    homeMarker: {
      backgroundColor: palette.primary,
    },
  });
