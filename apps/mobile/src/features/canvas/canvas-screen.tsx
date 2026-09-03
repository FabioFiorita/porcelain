import { useIsFocused, useRouter } from 'expo-router'
import { Text, View } from 'react-native'

import { EmptyNote, ErrorNote, ScreenHeader } from '@/components/panel-chrome'
import { SURFACE_GUTTER } from '@/components/surface-layout'
import { markdownToHtml, PreviewView, readerDocument } from '@/features/files'
import { useResolvedColorScheme } from '@/features/settings/theme-provider'

import { useCanvas, useCanvasDocumentUrl } from './canvas-data'
import { CanvasWebView } from './canvas-web-view'
import { DecisionCanvasView } from './decision-canvas-view'
import { ReviewCanvasView } from './review-canvas-view'
import { parseStructuredCanvas } from './structured-canvas'

/**
 * One Canvas, read.
 *
 * The three kinds take deliberately different routes, the same split the web Viewer makes. A
 * Markdown Canvas is text: it goes through the inert reader every other repo document uses,
 * scripting off and no network at all. A structured Canvas is semantic data rendered by the
 * native client. An HTML Canvas is an advanced document served by the daemon over its token route
 * with the response CSP the daemon chose — see `canvas-web-view.tsx`.
 */
export function CanvasScreen({ canvasId }: { canvasId: string }): React.JSX.Element {
  const focused = useIsFocused()
  const router = useRouter()
  const scheme = useResolvedColorScheme()
  const { canvas, isLoading, loadError } = useCanvas(canvasId, focused)
  const isHtml = canvas?.record.kind === 'html'
  const structured =
    canvas?.record.kind === 'structured' ? parseStructuredCanvas(canvas.content) : null
  const hasBundledReviewAssets =
    structured?.document?.template === 'review' &&
    structured.document.evidence?.assets.some((asset) => asset.kind !== 'link') === true
  const { url, mintError } = useCanvasDocumentUrl(
    canvasId,
    focused && (isHtml || hasBundledReviewAssets),
  )
  const error = loadError ?? (isHtml ? mintError : null)

  return (
    <View className="flex-1 bg-background" testID="porcelain-canvas-document">
      <ScreenHeader
        back={{
          accessibilityLabel: 'Back to Canvas',
          testID: 'porcelain-canvas-document-back',
          onPress: () => {
            router.back()
          },
        }}
        testID="porcelain-canvas-document-header"
        title={canvas?.record.title ?? 'Canvas'}
      />
      <CanvasBody
        canvas={canvas}
        documentUrl={url}
        error={error}
        isLoading={isLoading}
        scheme={scheme}
      />
    </View>
  )
}

function CanvasBody({
  canvas,
  documentUrl,
  error,
  isLoading,
  scheme,
}: {
  canvas: ReturnType<typeof useCanvas>['canvas']
  documentUrl: string | null
  error: string | null
  isLoading: boolean
  scheme: 'light' | 'dark'
}): React.JSX.Element {
  if (error !== null) {
    return (
      <View className={SURFACE_GUTTER}>
        <ErrorNote message={error} testID="porcelain-canvas-document-error" />
      </View>
    )
  }
  if (canvas === undefined) {
    return isLoading ? (
      <Text
        className="p-4 text-sm text-muted-foreground"
        testID="porcelain-canvas-document-loading"
      >
        Opening Canvas…
      </Text>
    ) : (
      <EmptyNote
        body="Select a worktree, then open a Canvas from its list."
        testID="porcelain-canvas-document-unavailable"
        title="No Canvas"
      />
    )
  }
  if (canvas.record.kind === 'markdown') {
    return (
      <PreviewView
        document={readerDocument(markdownToHtml(canvas.content), scheme)}
        testID="porcelain-canvas-document-reader"
      />
    )
  }
  if (canvas.record.kind === 'structured') {
    const parsed = parseStructuredCanvas(canvas.content)
    return parsed.error !== null ? (
      <View className={SURFACE_GUTTER}>
        <ErrorNote
          message={`This Canvas does not match the current structured contract. ${parsed.error}`}
          testID="porcelain-canvas-document-error"
        />
      </View>
    ) : parsed.document.template === 'decision' ? (
      <DecisionCanvasView document={parsed.document} />
    ) : (
      <ReviewCanvasView
        document={parsed.document}
        scheme={scheme}
        assetBaseUrl={documentUrl === null ? null : `${documentUrl}/assets`}
      />
    )
  }
  // A failed mint leaves the loading state standing rather than a WebView pointed nowhere.
  if (documentUrl === null) {
    return (
      <Text
        className="p-4 text-sm text-muted-foreground"
        testID="porcelain-canvas-document-minting"
      >
        Opening Canvas…
      </Text>
    )
  }
  return <CanvasWebView documentUrl={documentUrl} testID="porcelain-canvas-document-frame" />
}
