import {
  structuredCanvasDocumentSchema,
  structuredCanvasValidationMessage,
} from '@porcelain/contracts/projects'
import { TestIds } from '@shared/test-ids'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { MarkdownView } from '@renderer/components/viewer/markdown-view'
import { DecisionCanvasView } from './decision-canvas-view'

export function StructuredCanvasView({
  content,
  repoPath,
}: {
  content: string
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
  if (parsed.data.template === 'review') {
    return (
      <Tabs
        data-testid={TestIds.structuredCanvas}
        defaultValue="why"
        className="flex h-full min-h-0 flex-col gap-0"
      >
        <div className="shrink-0 border-b px-4 py-2">
          <TabsList variant="line">
            <TabsTrigger value="why">Why</TabsTrigger>
            <TabsTrigger value="how">How</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="why" className="min-h-0 flex-1 overflow-y-auto">
          <MarkdownView content={parsed.data.why} />
        </TabsContent>
        <TabsContent value="how" className="min-h-0 flex-1 overflow-y-auto">
          <MarkdownView content={parsed.data.how} />
        </TabsContent>
      </Tabs>
    )
  }
  return (
    <div data-testid={TestIds.structuredCanvas} className="h-full min-h-0">
      <DecisionCanvasView document={parsed.data} repoPath={repoPath} />
    </div>
  )
}
