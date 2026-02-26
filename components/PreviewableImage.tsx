import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  TouchableWithoutFeedback,
} from 'react-native';
import { Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Asset } from 'expo-asset';
import type { ImageSourcePropType, StyleProp, ViewStyle, ImageStyle } from 'react-native';

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
  typeof value === 'string' ? { uri: value } : value;

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
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const viewportSize = useRef({ width: 0, height: 0 });

  const normalizedSource = useMemo(() => normalizeSource(source), [source]);

  useEffect(() => {
    setResolvedUri(null);
  }, [source]);

  const ensureUri = useCallback(async () => {
    if (resolvedUri) return resolvedUri;
    if (typeof source === 'string') {
      setResolvedUri(source);
      return source;
    }
    if (source && typeof source === 'object' && 'uri' in source) {
      const uri = (source as { uri?: string }).uri;
      if (uri) {
        setResolvedUri(uri);
        return uri;
      }
    }
    const asset = Asset.fromModule(source);
    if (!asset.localUri) {
      await asset.downloadAsync();
    }
    const uri = asset.localUri || asset.uri;
    setResolvedUri(uri);
    return uri;
  }, [resolvedUri, source]);

  const openPreview = useCallback(() => {
    setPreviewKey(prev => prev + 1);
    setPreviewVisible(true);
    ensureUri().catch(err => {
      console.warn('Failed to resolve image preview uri', err);
    });
  }, [ensureUri]);

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
    setResolvedUri(null);
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
        <ImageBackground source={normalizedSource} style={style} imageStyle={imageStyle}>
          {overlay ? <View style={[styles.overlay, { padding: overlayPadding }]}>{overlay}</View> : null}
        </ImageBackground>
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
                    source={resolvedUri ? { uri: resolvedUri } : normalizedSource}
                    style={styles.previewImage}
                    contentFit="contain"
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
