import type {
  ReviewCanvasAsset,
  ReviewCanvasDocument,
  ReviewCanvasReference,
  ReviewCanvasSection,
} from '@porcelain/contracts/projects'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { HtmlView } from '@renderer/components/viewer/html-view'
import { MarkdownView } from '@renderer/components/viewer/markdown-view'
import { fileName } from '@renderer/lib/paths'
import { activeTabTarget, targetedTab } from '@renderer/stores/hub-tabs'
import { useTabsStore } from '@renderer/stores/tabs'
import {
  CheckCircle2,
  CircleMinus,
  ExternalLink,
  FileCode2,
  FileText,
  Video,
  XCircle,
} from 'lucide-react'

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
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">Code references</legend>
      {references.map((reference) => {
        const range =
          reference.startLine === undefined
            ? ''
            : reference.endLine === undefined || reference.endLine === reference.startLine
              ? `:${reference.startLine}`
              : `:${reference.startLine}-${reference.endLine}`
        return (
          <Button
            key={`${reference.path}:${reference.startLine ?? ''}:${reference.endLine ?? ''}`}
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-8 max-w-full justify-start gap-2 py-1.5 font-mono text-xs"
            onClick={() => onOpen(reference)}
          >
            <FileCode2 className="size-3.5 shrink-0" />
            <span className="truncate">
              {reference.label ?? reference.path}
              {range}
            </span>
          </Button>
        )
      })}
    </fieldset>
  )
}

function SectionView({
  section,
  onOpen,
}: {
  section: ReviewCanvasSection
  onOpen: (reference: ReviewCanvasReference) => void
}): React.JSX.Element {
  return (
    <article className="mx-auto w-full max-w-5xl space-y-6 p-5 sm:p-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{section.title}</h1>
        <References references={section.references} onOpen={onOpen} />
      </header>
      {section.prose === '' ? null : (
        <MarkdownView content={section.prose} compact className="overflow-visible" />
      )}
      {section.svg === undefined ? null : (
        <div
          className="overflow-hidden rounded-xl border bg-card"
          style={{ height: section.htmlHeight ?? 448 }}
        >
          <HtmlView html={section.svg} title={`${section.title} diagram`} />
        </div>
      )}
      {section.html === undefined ? null : (
        <div
          className="overflow-hidden rounded-xl border bg-card"
          style={{ height: section.htmlHeight ?? 448 }}
        >
          <HtmlView html={section.html} title={`${section.title} visual`} />
        </div>
      )}
    </article>
  )
}

function AssetCard({ asset, baseUrl }: { asset: ReviewCanvasAsset; baseUrl: string | null }) {
  if (asset.kind === 'link') {
    return (
      <a
        className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm hover:bg-muted/40"
        href={asset.href}
        target="_blank"
        rel="noreferrer"
      >
        <ExternalLink className="size-4 shrink-0" />
        <span className="font-medium">{asset.label}</span>
      </a>
    )
  }
  const href = assetUrl(baseUrl, asset.path)
  if (href === null) {
    return (
      <div className="rounded-xl border bg-card p-4 text-sm">
        <p className="font-medium">{asset.label}</p>
        <p className="mt-1 text-muted-foreground">Attachment is unavailable.</p>
      </div>
    )
  }
  if (asset.kind === 'image') {
    return (
      <figure className="overflow-hidden rounded-xl border bg-card">
        <img src={href} alt={asset.label} className="max-h-[36rem] w-full object-contain" />
        <figcaption className="border-t px-4 py-3 text-sm font-medium">{asset.label}</figcaption>
      </figure>
    )
  }
  if (asset.kind === 'video') {
    return (
      <a
        className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm hover:bg-muted/40"
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        <Video className="size-4 shrink-0" />
        <span className="font-medium">{asset.label}</span>
      </a>
    )
  }
  return (
    <a
      className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm hover:bg-muted/40"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      <FileText className="size-4 shrink-0" />
      <span className="font-medium">{asset.label}</span>
    </a>
  )
}

const checkIcon = {
  pass: CheckCircle2,
  fail: XCircle,
  skip: CircleMinus,
} as const

function EvidenceView({
  document,
  assetBaseUrl,
}: {
  document: ReviewCanvasDocument
  assetBaseUrl: string | null
}): React.JSX.Element | null {
  const evidence = document.evidence
  if (evidence === undefined) return null
  return (
    <article className="mx-auto w-full max-w-5xl space-y-7 p-5 sm:p-8">
      <header className="space-y-2">
        <Badge variant="secondary">Evidence</Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{evidence.title}</h1>
      </header>
      {evidence.checks.length === 0 ? null : (
        <section className="grid gap-3 md:grid-cols-2">
          {evidence.checks.map((check) => {
            const Icon = checkIcon[check.status]
            return (
              <div key={check.label} className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0" />
                  <p className="font-medium">{check.label}</p>
                  <Badge variant="outline" className="ml-auto capitalize">
                    {check.status}
                  </Badge>
                </div>
                {check.detail === undefined ? null : (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{check.detail}</p>
                )}
              </div>
            )
          })}
        </section>
      )}
      {evidence.assets.length === 0 ? null : (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Attachments</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {evidence.assets.map((asset) => (
              <AssetCard
                key={asset.kind === 'link' ? asset.href : asset.path}
                asset={asset}
                baseUrl={assetBaseUrl}
              />
            ))}
          </div>
        </section>
      )}
    </article>
  )
}

export function ReviewCanvasView({
  document,
  repoPath,
  assetBaseUrl,
}: {
  document: ReviewCanvasDocument
  repoPath?: string
  assetBaseUrl: string | null
}): React.JSX.Element {
  const openTab = useTabsStore((state) => state.openTab)
  const openReference = (reference: ReviewCanvasReference): void => {
    if (repoPath === undefined) return
    openTab(
      targetedTab(
        'file',
        `${repoPath}/${reference.path}`,
        {
          title: fileName(reference.path),
          ...(reference.startLine === undefined ? {} : { line: reference.startLine }),
        },
        activeTabTarget(),
      ),
    )
  }
  const first = 'section-0'
  return (
    <Tabs defaultValue={first} className="flex h-full min-h-0 flex-col gap-0">
      <div className="shrink-0 overflow-x-auto border-b px-3 py-2 sm:px-5">
        <TabsList
          variant="line"
          aria-label="Review Canvas sections"
          className="w-max min-w-full justify-start"
        >
          {document.sections.map((section, index) => (
            <TabsTrigger key={section.title} value={`section-${index}`}>
              {section.title}
            </TabsTrigger>
          ))}
          {document.evidence === undefined ? null : (
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
          )}
        </TabsList>
      </div>
      {document.sections.map((section, index) => (
        <TabsContent
          key={section.title}
          value={`section-${index}`}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          {index !== 0 || document.summary === undefined ? null : (
            <p className="mx-auto max-w-5xl px-5 pt-5 text-base leading-7 text-muted-foreground sm:px-8">
              {document.summary}
            </p>
          )}
          <SectionView section={section} onOpen={openReference} />
        </TabsContent>
      ))}
      <TabsContent value="evidence" className="min-h-0 flex-1 overflow-y-auto">
        <EvidenceView document={document} assetBaseUrl={assetBaseUrl} />
      </TabsContent>
    </Tabs>
  )
}
