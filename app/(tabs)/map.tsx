import React, { useMemo, useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Linking, Platform, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTrip } from '@/contexts/TripContext';
import MapView, { Marker } from 'react-native-maps';
import { Calendar, Home, Route, Mountain, PartyPopper, Globe, SunMedium, Plane, Goal } from 'lucide-react-native';
import { Activity, ActivityType, Day, Place } from '@/types/trip';
import { FREE_DAY_MARKERS, TIP_MARKERS, TIP_TYPE_META, extractCoordinatesFromLink, getAccommodationCoordinate, getAccommodationMedia, getActivityCoordinate, getActivityLink, getActivityTypeColor } from '@/constants/media';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeMode } from '@/contexts/ThemeContext';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { FloatingActions } from '@/components/FloatingActions';
import { Spacing, Typography } from '@/constants/tokens';
import { SPOTIFY_PLAYLIST_URL } from '@/constants/spotify';

export default function MapScreen() {
  const { days } = useTrip();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'tips' | string>('all');
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const { colors } = useThemeMode();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const actionBarOffset = insets.top + 44;

  useEffect(() => {
    if (selectedFilter !== 'all' && selectedFilter !== 'tips' && !days.some(day => day.datum.toISOString() === selectedFilter)) {
      setSelectedFilter('all');
    }
  }, [days, selectedFilter]);

  const filteredDays = useMemo(() => {
    if (selectedFilter === 'all') {
      return days;
    }
    if (selectedFilter === 'tips') {
      return [];
    }
    return days.filter(day => day.datum.toISOString() === selectedFilter);
  }, [days, selectedFilter]);

  const isValidAccommodation = (day: Day) => {
    const name = day.verblijf?.trim().toLowerCase();
    if (!name || name === 'x' || name === 'unknown') return false;
    if (name.includes('verblijf x')) return false;
    if (day.stadRegio?.trim().toLowerCase().includes('terugreis')) return false;
    return true;
  };

  const activitiesWithCoords = useMemo(() => {
    if (filteredDays.length === 0) return [];
    return filteredDays.flatMap(day =>
      day.activiteiten
        .map(activity => {
          if (activity.type === 'free_day' || activity.type === 'flight') return null;
          const coordinate = getActivityCoordinate(activity, day.stadRegio);
          if (!coordinate) return null;
          return { activity, coordinate, day, link: getActivityLink(activity) };
        })
        .filter(Boolean) as {
          activity: Activity;
          coordinate: { latitude: number; longitude: number };
          day: Day;
          link?: string | null;
        }[]
    );
  }, [filteredDays]);

  const placeLocationMarkers = useMemo(() => {
    if (filteredDays.length === 0) return [];
    return filteredDays.flatMap(day => {
      const places = day.places || [];
      return places.flatMap(place => buildPlaceMarkers(place, day));
    });
  }, [filteredDays]);

  const accommodationMarkers = useMemo(() => {
    if (filteredDays.length === 0) return [];
    return filteredDays
      .map(day => {
        if (!isValidAccommodation(day)) return null;
        if (day.verblijf?.trim().toLowerCase().includes('airport')) return null;
        const coordinate = getAccommodationCoordinate(day.verblijf, day.stadRegio, day.verblijfMapsLink);
        if (!coordinate) return null;
        const media = getAccommodationMedia(day.verblijf);
        const link = day.verblijfMapsLink && day.verblijfMapsLink !== 'x'
          ? day.verblijfMapsLink
          : media?.link;
        return { day, coordinate, link };
      })
      .filter(Boolean) as {
        day: Day;
        coordinate: { latitude: number; longitude: number };
        link?: string | null;
      }[];
  }, [filteredDays]);

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
    placeLocationMarkers.forEach(marker => {
      titles.add(normalizeKey(marker.title));
      titles.add(normalizeKey(marker.placeName));
    });
    activitiesWithCoords.forEach(item => titles.add(normalizeKey(item.activity.naam)));
    accommodationMarkers.forEach(item => titles.add(normalizeKey(item.day.verblijf)));
    return titles;
  }, [placeLocationMarkers, activitiesWithCoords, accommodationMarkers]);

  const visibleTipMarkers = useMemo(() => {
    if (!showTips) return [];
    if (existingMarkerTitles.size === 0) return TIP_MARKERS;
    return TIP_MARKERS.filter(marker => !existingMarkerTitles.has(normalizeKey(marker.title)));
  }, [showTips, existingMarkerTitles]);

  const tipCoords = visibleTipMarkers.map(marker => marker.coordinate);

  const coordinates = useMemo(() => {
    const freeDayCoords = showFreeDayMarkers ? FREE_DAY_MARKERS.map(marker => marker.coordinate) : [];
    if (
      activitiesWithCoords.length === 0 &&
      placeLocationMarkers.length === 0 &&
      accommodationMarkers.length === 0 &&
      freeDayCoords.length === 0 &&
      tipCoords.length === 0
    ) {
      return [];
    }
    return [
      ...activitiesWithCoords.map(item => item.coordinate),
      ...placeLocationMarkers.map(item => item.coordinate),
      ...accommodationMarkers.map(item => item.coordinate),
      ...freeDayCoords,
      ...tipCoords,
    ];
  }, [activitiesWithCoords, placeLocationMarkers, accommodationMarkers, showFreeDayMarkers, tipCoords]);

  const initialRegion = useMemo(() => {
    if (coordinates.length === 0) {
      return {
        latitude: -22.9068,
        longitude: -43.1729,
        latitudeDelta: 1.2,
        longitudeDelta: 1.2,
      };
    }
    return getRegionForCoordinates(coordinates);
  }, [coordinates]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (coordinates.length > 0 && mapReady) {
      try {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 80, right: 40, bottom: 120, left: 40 },
          animated: true,
        });
      } catch (err) {
        console.warn('fitToCoordinates failed', err);
      }
    }
  }, [coordinates, selectedFilter, mapReady]);

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
        subLabel: `${TIP_MARKERS.length} tips`,
      },
      ...days.map(day => ({
        key: day.datum.toISOString(),
        label: `${day.datum.getDate()} ${getMonthName(day.datum.getMonth())}`,
        subLabel: day.stadRegio,
      })),
    ];
  }, [days]);

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
        >
          {accommodationMarkers.map(({ day, coordinate, link }) => (
            <Marker
              key={`acc-${day.datum.toISOString()}`}
              coordinate={coordinate}
              title={day.verblijf}
              description={`Verblijf • ${day.stadRegio}`}
              onCalloutPress={() => {
                if (day.verblijf) {
                  router.push(`/accommodation/${encodeURIComponent(day.verblijf)}`);
                } else {
                  openMapsLink(link, day.verblijf);
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

          {placeLocationMarkers.map(marker => {
            const dayLabel = selectedFilter === 'all' ? `${marker.day.dagNaam} • ` : '';
            const placeMeta = getPlaceMarkerMeta(marker.placeType, marker.title);
            const tipMatch = TIP_MARKERS.find(tip => {
              const normalizedTitle = normalizeKey(marker.title);
              const normalizedPlace = normalizeKey(marker.placeName);
              const normalizedTip = normalizeKey(tip.title);
              return normalizedTip === normalizedTitle || normalizedTip === normalizedPlace;
            });
            const description = tipMatch && selectedFilter === 'all'
              ? `${marker.day.dagNaam} • ${tipMatch.description}`
              : `${dayLabel}${marker.day.stadRegio} • ${marker.placeName}${
                  marker.descriptionNote ? ` • ${marker.descriptionNote}` : ''
                }`;
            return (
              <Marker
                key={marker.id}
                coordinate={marker.coordinate}
                title={marker.title}
                description={description}
                onCalloutPress={() => openMapsLink(marker.link, marker.title)}
              >
                <View style={[styles.markerIcon, styles.placeMarker, { backgroundColor: placeMeta.color }]}>
                  <Text style={styles.placeEmoji}>{placeMeta.emoji}</Text>
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
            visibleTipMarkers.map(marker => {
              const meta = TIP_TYPE_META[marker.type];
              return (
                <Marker
                  key={marker.id}
                  coordinate={marker.coordinate}
                  title={marker.title}
                  description={`${meta.emoji} ${meta.label} • ${marker.description}`}
                  onCalloutPress={() =>
                    showTipDetails(marker.title, meta.label, meta.emoji, marker.description, marker.link)
                  }
                >
                  <View style={[styles.markerIcon, { backgroundColor: meta.color }]}>
                    <Text style={styles.tipEmoji}>{meta.emoji}</Text>
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

const buildPlaceMarkers = (place: Place, day: Day) => {
  const locations = place.locations?.length
    ? place.locations
    : place.mapsLink
    ? [{ label: place.naam, url: place.mapsLink }]
    : [];

  return locations
    .map((location, index) => {
      const title = location.label || place.naam;
      let coordinate =
        extractCoordinatesFromLink(location.url) ||
        findTipCoordinate(title);
      if (!coordinate) return null;
      return {
        id: `${day.datum.toISOString()}-${place.id}-${index}`,
        title,
        placeName: place.naam,
        coordinate,
        link: location.url,
        day,
        placeType: place.type,
      };
    })
    .filter(Boolean) as {
      id: string;
      title: string;
      placeName: string;
      coordinate: { latitude: number; longitude: number };
      link?: string | null;
      day: Day;
      placeType: Place['type'];
      descriptionNote?: string;
    }[];
};

const findTipCoordinate = (label: string) => {
  const normalized = normalizeKey(label);
  const tip = TIP_MARKERS.find(marker => normalizeKey(marker.title) === normalized);
  return tip?.coordinate;
};

const PLACE_TYPE_META: Record<Place['type'], { emoji: string; color: string }> = {
  food: { emoji: '🍽️', color: '#E07A5F' },
  drink: { emoji: '🍹', color: '#4D908E' },
  nightlife: { emoji: '🌙', color: '#577590' },
  logistics: { emoji: '🧭', color: '#577590' },
  spot: { emoji: '📍', color: '#B56576' },
  other: { emoji: '✨', color: '#6D6875' },
};

const getPlaceMarkerMeta = (type: Place['type'], label: string) => {
  return PLACE_TYPE_META[type] || PLACE_TYPE_META.other;
};

function getMonthName(month: number): string {
  const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return months[month];
}

function getRegionForCoordinates(coords: { latitude: number; longitude: number }[]) {
  const minLat = Math.min(...coords.map(c => c.latitude));
  const maxLat = Math.max(...coords.map(c => c.latitude));
  const minLng = Math.min(...coords.map(c => c.longitude));
  const maxLng = Math.max(...coords.map(c => c.longitude));

  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;

  const latitudeDelta = Math.max((maxLat - minLat) * 1.4, 0.3);
  const longitudeDelta = Math.max((maxLng - minLng) * 1.4, 0.3);

  return {
    latitude,
    longitude,
    latitudeDelta,
    longitudeDelta,
  };
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
    placeMarker: {
      backgroundColor: '#3B5BFF',
    },
    placeEmoji: {
      fontSize: 16,
    },
  });
