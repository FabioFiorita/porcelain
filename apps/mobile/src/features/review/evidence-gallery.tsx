import type { EvidenceAsset } from '@porcelain/contracts/review'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { FlatList, Image, Modal, Pressable, Text, useWindowDimensions, View } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChromeGlyph } from '@/components/chrome-glyph'
import { EmptyNote } from '@/components/panel-chrome'
import { SurfaceList } from '@/components/surface-scroll'
import { describeBytes, pathTestId } from '@/features/files'

import { useReviewEvidenceAsset } from './use-review'

const TILE_TEST_ID = 'porcelain-review-evidence-asset'

/**
 * The Assets sub-tab: `evidence/assets/` as a native grid of screenshots.
 *
 * Native, not a WebView. A screenshot has a native form — a grid of images and a
 * full-screen pager — and the one sanctioned WebView host exists for documents that
 * do not. Wrapping an image in HTML to show it would cost a base64 copy inside a
 * report for nothing.
 *
 * Bytes ride the authenticated daemon channel one image at a time, because the daemon
 * serves no user files over HTTP. This whole component is only mounted while its
 * sub-tab is up, which is what keeps a tens-of-megabytes pack off a canvas nobody
 * asked for; each tile then pays only for itself.
 */
export function EvidenceGallery({ assets }: { assets: EvidenceAsset[] }): React.JSX.Element {
  const [zoomed, setZoomed] = useState<number | null>(null)

  if (assets.length === 0) {
    return (
      <EmptyNote
        body="Screenshots your agent writes to evidence/assets/ show here as a gallery."
        testID="porcelain-review-evidence-assets-empty"
        title="No images in this pack"
      />
    )
  }

  return (
    <View className="flex-1" testID="porcelain-review-evidence-assets">
      <SurfaceList
        data={assets}
        keyExtractor={(asset) => asset.file}
        numColumns={3}
        paddingTop={8}
        renderItem={({ index, item }) => (
          <GalleryTile
            asset={item}
            onPress={() => {
              setZoomed(index)
            }}
          />
        )}
      />
      {zoomed === null ? null : (
        <GalleryZoom
          assets={assets}
          index={zoomed}
          onClose={() => {
            setZoomed(null)
          }}
        />
      )}
    </View>
  )
}

/** One tile: the image when its own read lands, the reason when it never will. */
function GalleryTile({
  asset,
  onPress,
}: {
  asset: EvidenceAsset
  onPress: () => void
}): React.JSX.Element {
  const { asset: body, isLoading } = useReviewEvidenceAsset(asset.file, true)

  return (
    <Pressable
      accessibilityLabel={`${asset.label}, ${describeBytes(asset.bytes)}`}
      accessibilityRole="imagebutton"
      className="w-1/3 p-1"
      testID={pathTestId(TILE_TEST_ID, asset.file)}
      onPress={onPress}
    >
      <View className="aspect-square overflow-hidden rounded-lg border border-border bg-muted">
        {body === null || body === undefined ? (
          <View className="flex-1 items-center justify-center p-1">
            <Text className="text-center text-[9px] leading-3 text-muted-foreground">
              {isLoading ? '…' : overCap(asset)}
            </Text>
          </View>
        ) : (
          <Image className="size-full" resizeMode="cover" source={{ uri: body.dataUrl }} />
        )}
      </View>
      <Text className="pt-1 text-[9px] text-muted-foreground" numberOfLines={1}>
        {asset.label}
      </Text>
    </Pressable>
  )
}

/**
 * Tap-to-zoom: a full-screen pager over the same pack.
 *
 * A horizontal paging list rather than a single image, because "the next screenshot"
 * is the only thing anyone wants after looking at one, and a swipe is the phone's
 * word for it. Page width comes from the window, so it is a real style and not a
 * class — every static value here stays in NativeWind.
 *
 * The backdrop is `bg-black` in BOTH themes, a deliberate exception to the semantic
 * tokens: this is the photo-viewer idiom every phone shares, and on `bg-background`
 * in light mode the zoom read as an image floating on the page rather than an
 * overlay over it. `ModalBackdrop` already scrims in black for the same reason.
 *
 * It carries its own `SafeAreaProvider`, which is the whole reason the caption used to
 * float 47pt above the bottom of the screen. A `Modal` presents OVER the tab bar, but
 * the app-level provider measures the tab screen underneath — where UIKit folds the tab
 * bar into `insets.bottom` (81pt on an iPhone 17 Pro, not 34). Inherited into a modal
 * that covers the bar, that reserves room for chrome which is no longer on screen. A
 * nested provider measures the modal's own view, so the caption clears the home
 * indicator and nothing else.
 */
function GalleryZoom({
  assets,
  index,
  onClose,
}: {
  assets: EvidenceAsset[]
  index: number
  onClose: () => void
}): React.JSX.Element {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      visible
      testID="porcelain-review-evidence-asset-zoom"
    >
      <SafeAreaProvider>
        <GalleryZoomBody assets={assets} index={index} onClose={onClose} />
      </SafeAreaProvider>
    </Modal>
  )
}

/**
 * Inside the modal's own provider — so `useSafeAreaInsets` here answers for the modal, not for
 * the tab screen it covers. Split out because a provider only serves its descendants.
 */
function GalleryZoomBody({
  assets,
  index,
  onClose,
}: {
  assets: EvidenceAsset[]
  index: number
  onClose: () => void
}): React.JSX.Element {
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  return (
    <View className="flex-1 bg-black">
      {/* The app-level status bar follows the theme; over an always-black backdrop
            a light-theme (dark) status bar is invisible. */}
      <StatusBar style="light" />
      <FlatList
        data={assets}
        getItemLayout={(_, page) => ({ index: page, length: width, offset: width * page })}
        horizontal
        initialScrollIndex={index}
        keyExtractor={(asset) => asset.file}
        pagingEnabled
        renderItem={({ item }) => <ZoomPage asset={item} width={width} />}
        showsHorizontalScrollIndicator={false}
      />
      <View className="absolute right-3" style={{ top: insets.top + 12 }}>
        <Pressable
          accessibilityLabel="Close the image"
          accessibilityRole="button"
          className="size-10 items-center justify-center rounded-full bg-white/20"
          hitSlop={8}
          testID="porcelain-review-evidence-asset-zoom-close"
          onPress={onClose}
        >
          {/* White in both themes: the chrome sits on a backdrop that is always black. */}
          <ChromeGlyph name="close" size={17} tone="primaryForeground" />
        </Pressable>
      </View>
    </View>
  )
}

/**
 * One page of the zoom pager — the whole image, never cropped, over its caption.
 *
 * The caption rides the page rather than the modal chrome so it can never name the
 * wrong screenshot: a swipe moves both together, with no scroll position to track.
 * Its name was only an accessibility label before, which is a strange thing for a
 * gallery of `run-2.png` and `after.png` to keep from the person looking at them.
 */
function ZoomPage({ asset, width }: { asset: EvidenceAsset; width: number }): React.JSX.Element {
  const { asset: body, isLoading } = useReviewEvidenceAsset(asset.file, true)
  const insets = useSafeAreaInsets()

  return (
    <View className="flex-1" style={{ width }}>
      <View className="flex-1 items-center justify-center px-4">
        {body === null || body === undefined ? (
          <Text
            className="text-center text-xs text-white/60"
            testID={
              isLoading
                ? 'porcelain-review-evidence-asset-zoom-loading'
                : 'porcelain-review-evidence-asset-zoom-unavailable'
            }
          >
            {isLoading ? 'Loading the image…' : overCap(asset)}
          </Text>
        ) : (
          <Image
            accessibilityLabel={asset.label}
            className="size-full"
            resizeMode="contain"
            source={{ uri: body.dataUrl }}
          />
        )}
      </View>
      <Text
        className="px-6 pt-3 text-center text-xs text-white/70"
        numberOfLines={2}
        style={{ paddingBottom: insets.bottom + 12 }}
        testID="porcelain-review-evidence-asset-zoom-caption"
      >
        {`${asset.label} · ${describeBytes(asset.bytes)}`}
      </Text>
    </View>
  )
}

/** Over the daemon's per-image cap — the size comes from the listing, not the body. */
function overCap(asset: EvidenceAsset): string {
  return `Too large to preview (${describeBytes(asset.bytes)})`
}
