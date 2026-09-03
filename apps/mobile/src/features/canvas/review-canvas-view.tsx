import type {
  ReviewCanvasAsset,
  ReviewCanvasDocument,
  ReviewCanvasReference,
} from '@porcelain/contracts/projects'
import { useState } from 'react'
import { Alert, Image, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { PANEL_CARD, SURFACE_GUTTER } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { markdownToHtml, PreviewView, readerDocument } from '@/features/files'
import { useSurfaceOpen } from '@/features/shell/use-surface-open'
import { cn } from '@/lib/utils'

type ReviewView = number | 'evidence'

function assetUrl(baseUrl: string | null, path: string): string | null {
  if (baseUrl === null) return null
  return `${baseUrl}/${path.split('/').map(encodeURIComponent).join('/')}`
}

function References({
  references,
  onOpen,
}: {
  references: readonly ReviewCanvasReference[]
  onOpen: (reference: ReviewCanvasReference) => void
}): React.JSX.Element | null {
  if (references.length === 0) return null
  return (
    <View accessibilityLabel="Code references" className="flex-row flex-wrap gap-2 px-4 py-3">
      {references.map((reference) => (
        <Pressable
          key={`${reference.path}:${reference.startLine ?? ''}:${reference.endLine ?? ''}`}
          accessibilityLabel={`Open ${reference.label ?? reference.path}`}
          accessibilityRole="button"
          className="max-w-full rounded-xl border border-border bg-muted/40 px-3 py-2"
          onPress={() => onOpen(reference)}
        >
          <Text className="font-mono text-xs text-foreground" numberOfLines={1}>
            {reference.label ?? reference.path}
            {reference.startLine === undefined ? '' : `:${reference.startLine}`}
            {reference.endLine === undefined || reference.endLine === reference.startLine
              ? ''
              : `-${reference.endLine}`}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

function Asset({ asset, baseUrl }: { asset: ReviewCanvasAsset; baseUrl: string | null }) {
  const href = asset.kind === 'link' ? asset.href : assetUrl(baseUrl, asset.path)
  if (asset.kind === 'image' && href !== null) {
    return (
      <View className={cn(PANEL_CARD, 'overflow-hidden')}>
        <Image
          accessibilityLabel={asset.label}
          className="h-64 w-full bg-muted/20"
          resizeMode="contain"
          source={{ uri: href }}
        />
        <Text className="border-t border-border px-4 py-3 text-sm font-medium text-foreground">
          {asset.label}
        </Text>
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="link"
      className={cn(PANEL_CARD, 'p-4 active:bg-muted/50')}
      disabled={href === null}
      onPress={() => {
        if (href !== null) {
          void Linking.openURL(href).catch((error: unknown) => {
            Alert.alert(
              'Could not open attachment',
              error instanceof Error ? error.message : String(error),
            )
          })
        }
      }}
    >
      <Text className="text-sm font-medium text-foreground">{asset.label}</Text>
      <Text className="mt-1 text-xs capitalize text-muted-foreground">
        {href === null ? 'Attachment unavailable' : asset.kind}
      </Text>
    </Pressable>
  )
}

function Evidence({
  document,
  assetBaseUrl,
}: {
  document: ReviewCanvasDocument
  assetBaseUrl: string | null
}): React.JSX.Element | null {
  const evidence = document.evidence
  if (evidence === undefined) return null
  return (
    <SurfaceScroll gap={5} testID="porcelain-review-evidence">
      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Evidence
        </Text>
        <Text className="text-2xl font-semibold text-foreground">{evidence.title}</Text>
      </View>
      {evidence.checks.map((check) => (
        <View key={check.label} className={cn(PANEL_CARD, 'gap-2 p-4')}>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="min-w-0 flex-1 text-sm font-medium text-foreground">
              {check.label}
            </Text>
            <Text className="text-xs font-semibold uppercase text-muted-foreground">
              {check.status}
            </Text>
          </View>
          {check.detail === undefined ? null : (
            <Text className="text-sm leading-6 text-muted-foreground">{check.detail}</Text>
          )}
        </View>
      ))}
      {evidence.assets.length === 0 ? null : (
        <View className="gap-3">
          <Text className="text-base font-semibold text-foreground">Attachments</Text>
          {evidence.assets.map((asset) => (
            <Asset
              key={asset.kind === 'link' ? asset.href : asset.path}
              asset={asset}
              baseUrl={assetBaseUrl}
            />
          ))}
        </View>
      )}
    </SurfaceScroll>
  )
}

export function ReviewCanvasView({
  document,
  scheme,
  assetBaseUrl,
}: {
  document: ReviewCanvasDocument
  scheme: 'light' | 'dark'
  assetBaseUrl: string | null
}): React.JSX.Element {
  const [active, setActive] = useState<ReviewView>(0)
  const open = useSurfaceOpen()
  const section = typeof active === 'number' ? document.sections[active] : undefined
  const openReference = (reference: ReviewCanvasReference): void => {
    open.file(reference.path, reference.startLine)
  }
  const sectionDocument =
    section === undefined
      ? null
      : readerDocument(
          `${
            active === 0 && document.summary !== undefined ? markdownToHtml(document.summary) : ''
          }${markdownToHtml(section.prose)}${section.svg ?? ''}${section.html ?? ''}`,
          scheme,
        )

  return (
    <View className="flex-1" testID="porcelain-review-canvas">
      <ScrollView
        horizontal
        accessibilityRole="tablist"
        className="max-h-14 shrink-0 border-b border-border"
        contentContainerClassName={cn('items-center gap-2 py-2', SURFACE_GUTTER)}
        showsHorizontalScrollIndicator={false}
      >
        {document.sections.map((item, index) => {
          const selected = active === index
          return (
            <Pressable
              key={item.title}
              accessibilityLabel={item.title}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              className={cn(
                'min-h-9 justify-center rounded-2xl px-4',
                selected ? 'bg-muted' : 'active:bg-muted/50',
              )}
              testID={`porcelain-review-view-section-${index}`}
              onPress={() => setActive(index)}
            >
              <Text
                className={cn(
                  'text-sm font-medium',
                  selected ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {item.title}
              </Text>
            </Pressable>
          )
        })}
        {document.evidence === undefined ? null : (
          <Pressable
            accessibilityLabel="Evidence"
            accessibilityRole="tab"
            accessibilityState={{ selected: active === 'evidence' }}
            className={cn(
              'min-h-9 justify-center rounded-2xl px-4',
              active === 'evidence' ? 'bg-muted' : 'active:bg-muted/50',
            )}
            testID="porcelain-review-view-evidence"
            onPress={() => setActive('evidence')}
          >
            <Text className="text-sm font-medium text-foreground">Evidence</Text>
          </Pressable>
        )}
      </ScrollView>
      {active === 'evidence' ? (
        <Evidence document={document} assetBaseUrl={assetBaseUrl} />
      ) : section === undefined || sectionDocument === null ? null : (
        <View className="flex-1">
          <References references={section.references} onOpen={openReference} />
          <PreviewView document={sectionDocument} testID={`porcelain-review-section-${active}`} />
        </View>
      )}
    </View>
  )
}
