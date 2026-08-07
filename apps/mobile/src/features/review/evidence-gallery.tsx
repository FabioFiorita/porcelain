import { useState } from 'react'
import { FlatList, Image, Modal, Pressable, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { EmptyNote } from '@/components/panel-chrome'
import { pathTestId } from '@/features/files/file-paths'
import { describeBytes } from '@/features/files/source-rows'
import type { EvidenceAsset } from '@/lib/daemon/procedures/review'

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
      <FlatList
        contentContainerClassName="px-4 py-2"
        data={assets}
        keyExtractor={(asset) => asset.file}
        numColumns={3}
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
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      visible
      testID="porcelain-review-evidence-asset-zoom"
    >
      <View className="flex-1 bg-background">
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
            className="size-10 items-center justify-center rounded-full bg-muted"
            hitSlop={8}
            testID="porcelain-review-evidence-asset-zoom-close"
            onPress={onClose}
          >
            <ChromeGlyph name="close" size={17} />
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

/** One page of the zoom pager — the whole image, never cropped. */
function ZoomPage({ asset, width }: { asset: EvidenceAsset; width: number }): React.JSX.Element {
  const { asset: body, isLoading } = useReviewEvidenceAsset(asset.file, true)

  return (
    <View className="flex-1 items-center justify-center px-4" style={{ width }}>
      {body === null || body === undefined ? (
        <Text
          className="text-center text-xs text-muted-foreground"
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
  )
}

/** Over the daemon's per-image cap — the size comes from the listing, not the body. */
function overCap(asset: EvidenceAsset): string {
  return `Too large to preview (${describeBytes(asset.bytes)})`
}
