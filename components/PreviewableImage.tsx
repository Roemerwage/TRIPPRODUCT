import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
  type ImageStyle,
} from 'react-native';
import { Dimensions } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

type Props = {
  source: ImageSourcePropType | string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  overlay?: React.ReactNode;
  overlayPadding?: number;
  accessibilityLabel?: string;
  onPreviewVisibilityChange?: (visible: boolean) => void;
};

const normalizeSource = (value: ImageSourcePropType | string): ImageSourcePropType =>
  typeof value === 'string'
    ? { uri: normalizeImageUri(value) }
    : value && typeof value === 'object' && 'uri' in value
      ? { ...(value as Record<string, unknown>), uri: normalizeImageUri(String((value as { uri?: string }).uri || '')) }
      : value;

const normalizeImageUri = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('data:')) return trimmed;

  const commaIndex = trimmed.indexOf(',');
  if (commaIndex < 0) return trimmed;

  // Strip accidental whitespace/newlines in base64 payloads copied from forms.
  const prefix = trimmed.slice(0, commaIndex + 1);
  const payload = trimmed.slice(commaIndex + 1).replace(/\s+/g, '');
  return `${prefix}${payload}`;
};

const parseDataImageUri = (uri: string) => {
  const match = uri.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1].toLowerCase(),
    base64: match[2],
  };
};

const getImageExtension = (mimeType: string) => {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  return 'img';
};

const hashString = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
};

const toDataUriCacheFile = async (uri: string): Promise<string | null> => {
  const parsed = parseDataImageUri(uri);
  if (!parsed || !FileSystem.cacheDirectory) return null;

  const ext = getImageExtension(parsed.mimeType);
  const fileName = `embedded-${hashString(uri)}.${ext}`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists) {
    await FileSystem.writeAsStringAsync(fileUri, parsed.base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
  return fileUri;
};

const getUriFromSource = (source: ImageSourcePropType): string | null => {
  if (source && typeof source === 'object' && 'uri' in source) {
    return String((source as { uri?: string }).uri || '') || null;
  }
  return null;
};

export function PreviewableImage({
  source,
  style,
  imageStyle,
  overlay,
  overlayPadding = 0,
  accessibilityLabel,
  onPreviewVisibilityChange,
}: Props) {
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [resolvedSource, setResolvedSource] = useState<ImageSourcePropType>(() => normalizeSource(source));
  const scrollRef = useRef<ScrollView | null>(null);
  const viewportSize = useRef({ width: 0, height: 0 });

  const normalizedSource = useMemo(() => normalizeSource(source), [source]);

  useEffect(() => {
    let cancelled = false;

    const resolveSource = async () => {
      const candidate = normalizedSource;
      const uri = getUriFromSource(candidate);
      if (!uri || !uri.startsWith('data:image/')) {
        if (!cancelled) setResolvedSource(candidate);
        return;
      }

      try {
        const fileUri = await toDataUriCacheFile(uri);
        if (!cancelled) {
          setResolvedSource(fileUri ? { uri: fileUri } : candidate);
        }
      } catch (error) {
        console.warn('Failed to convert embedded image to cache file', error);
        if (!cancelled) {
          setResolvedSource(candidate);
        }
      }
    };

    resolveSource();
    return () => {
      cancelled = true;
    };
  }, [normalizedSource]);

  const openPreview = useCallback(() => {
    setPreviewKey(prev => prev + 1);
    setPreviewVisible(true);
  }, []);

  const resetZoomAndPosition = useCallback(() => {
    const ref: any = scrollRef.current;
    if (!ref) return;
    const { width, height } = viewportSize.current;
    if (ref.scrollResponderZoomTo && width && height) {
      ref.scrollResponderZoomTo({ x: 0, y: 0, width, height, animated: false });
    } else {
      ref.scrollTo({ x: 0, y: 0, animated: false });
      ref.setNativeProps?.({ zoomScale: 1 });
    }
  }, []);

  const closePreview = useCallback(() => {
    resetZoomAndPosition();
    setPreviewVisible(false);
  }, [resetZoomAndPosition]);

  useEffect(() => {
    if (!previewVisible) return;
    // Ensure each open starts centered with no leftover offset from zooming.
    const id = setTimeout(resetZoomAndPosition, 0);
    return () => clearTimeout(id);
  }, [previewVisible, resetZoomAndPosition]);

  useEffect(() => {
    onPreviewVisibilityChange?.(previewVisible);
    return () => onPreviewVisibilityChange?.(false);
  }, [previewVisible, onPreviewVisibilityChange]);

  return (
    <>
      <Pressable onPress={openPreview} accessibilityLabel={accessibilityLabel}>
        <View style={[style, styles.imageContainer]}>
          <Image source={resolvedSource} resizeMode="cover" style={[StyleSheet.absoluteFill, imageStyle]} />
          {overlay ? <View style={[styles.overlay, { padding: overlayPadding }]}>{overlay}</View> : null}
        </View>
      </Pressable>

      {previewVisible ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closePreview}
        >
          <TouchableWithoutFeedback onPress={closePreview} accessibilityLabel="Sluit afbeelding">
            <View style={styles.previewBackdrop}>
              <View style={styles.previewViewport}>
                <ScrollView
                  key={previewKey}
                  ref={scrollRef}
                  style={styles.previewScroll}
                  maximumZoomScale={3}
                  minimumZoomScale={1}
                  bounces={false}
                  bouncesZoom={false}
                  contentInsetAdjustmentBehavior="never"
                  contentContainerStyle={styles.previewContent}
                  onLayout={event => {
                    const { width, height } = event.nativeEvent.layout;
                    viewportSize.current = { width: width || Dimensions.get('window').width, height: height || Dimensions.get('window').height };
                    resetZoomAndPosition();
                  }}
                >
                  <Image
                    source={resolvedSource}
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    overflow: 'hidden',
  },
  overlay: {
    flex: 1,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    padding: 0,
  },
  previewViewport: {
    flex: 1,
  },
  previewScroll: {
    flex: 1,
  },
  previewContent: {
    minHeight: '100%',
    minWidth: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
});
