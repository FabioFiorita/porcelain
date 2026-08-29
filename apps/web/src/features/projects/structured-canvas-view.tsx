import {
  type StructuredCanvasV1Document,
  structuredCanvasDocumentSchema,
  structuredCanvasValidationMessage,
} from '@porcelain/contracts/projects'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { HtmlView } from '@renderer/components/viewer/html-view'
import { MarkdownView } from '@renderer/components/viewer/markdown-view'
import { TestIds } from '@shared/test-ids'
import { Images } from 'lucide-react'
import { DecisionCanvasView } from './decision-canvas-view'

function assetUrl(baseUrl: string, path: string): string {
  return `${baseUrl}/assets/${encodeURIComponent(path)}`
}

function AssetsView({
  document,
  assetBaseUrl,
}: {
  document: StructuredCanvasV1Document
  assetBaseUrl: string | null
}): React.JSX.Element {
  if (assetBaseUrl === null) {
    return <p className="p-6 text-sm text-muted-foreground">Loading assets…</p>
  }
  return (
    <div className="grid min-h-0 grid-cols-1 gap-4 overflow-y-auto p-6 lg:grid-cols-2">
      {document.assets.map((asset) => (
        <figure key={`${asset.type}:${asset.path}`} className="overflow-hidden rounded-xl border">
          {asset.type === 'image' ? (
            <img
              src={assetUrl(assetBaseUrl, asset.path)}
              alt={asset.alt}
              className="max-h-[36rem] w-full bg-muted/20 object-contain"
            />
          ) : (
            // biome-ignore lint/a11y/useMediaCaption: Silent proof videos are valid; narrated videos can provide captionsPath.
            <video
              src={assetUrl(assetBaseUrl, asset.path)}
              aria-label={asset.label}
              controls
              preload="metadata"
              className="max-h-[36rem] w-full bg-black object-contain"
            >
              {asset.captionsPath === undefined ? null : (
                <track
                  kind="captions"
                  src={assetUrl(assetBaseUrl, asset.captionsPath)}
                  srcLang="en"
                  label="English"
                  default
                />
              )}
            </video>
          )}
          {asset.caption === undefined ? null : (
            <figcaption className="border-t px-3 py-2 text-sm text-muted-foreground">
              {asset.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  )
}

export function StructuredCanvasView({
  content,
  assetBaseUrl,
  repoPath,
}: {
  content: string
  assetBaseUrl: string | null
  repoPath?: string
}): React.JSX.Element {
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch (error) {
    return (
      <div data-testid={TestIds.structuredCanvasInvalid} className="p-6 text-sm text-destructive">
        Invalid structured Canvas: {error instanceof Error ? error.message : 'invalid JSON'}
      </div>
    )
  }
  const parsed = structuredCanvasDocumentSchema.safeParse(value)
  if (!parsed.success) {
    return (
      <div data-testid={TestIds.structuredCanvasInvalid} className="p-6 text-sm text-destructive">
        Invalid structured Canvas: {structuredCanvasValidationMessage(parsed.error)}
      </div>
    )
  }
  const document = parsed.data
  if (document.version === 2) {
    return (
      <div data-testid={TestIds.structuredCanvas} className="h-full min-h-0">
        <DecisionCanvasView document={document} repoPath={repoPath} />
      </div>
    )
  }
  const firstTab = document.tabs[0]
  if (firstTab === undefined) return <div />
  return (
    <Tabs
      data-testid={TestIds.structuredCanvas}
      defaultValue={firstTab.id}
      className="h-full min-h-0 gap-0"
    >
      <div className="shrink-0 border-b px-4 py-2">
        <TabsList variant="line">
          {document.tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
          {document.assets.length === 0 ? null : (
            <TabsTrigger value="assets">
              <Images /> Assets
            </TabsTrigger>
          )}
        </TabsList>
      </div>
      {document.tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="min-h-0 overflow-y-auto">
          {tab.blocks.map((block, index) =>
            block.type === 'markdown' ? (
              <MarkdownView key={`${block.type}:${block.content}`} content={block.content} />
            ) : (
              <div key={`${block.type}:${block.content}`} style={{ height: block.height ?? 360 }}>
                <HtmlView html={block.content} title={`${tab.label} HTML block ${index + 1}`} />
              </div>
            ),
          )}
        </TabsContent>
      ))}
      {document.assets.length === 0 ? null : (
        <TabsContent value="assets" className="min-h-0">
          <AssetsView document={document} assetBaseUrl={assetBaseUrl} />
        </TabsContent>
      )}
    </Tabs>
  )
}
