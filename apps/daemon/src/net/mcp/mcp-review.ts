import {
  type DecisionCanvasTemplateData,
  decisionCanvasDocument,
  type PlanCanvasTemplateData,
  planCanvasDocument,
  type ReviewCanvasTemplateData,
  reviewCanvasDocument,
} from '@porcelain/contracts/projects'
import type { CanvasBundleSource } from '../../features/projects'

export const REVIEW_CANVAS_METADATA = 'review.json'

function structuredSource(
  document: ReturnType<typeof reviewCanvasDocument> | ReturnType<typeof decisionCanvasDocument>,
  assetsDir: string | undefined,
  extraFiles: readonly { path: string; content: string }[] = [],
): CanvasBundleSource {
  return {
    kind: 'structured',
    entryFile: 'canvas.json',
    document: `${JSON.stringify(document, null, 2)}\n`,
    ...(assetsDir === undefined ? {} : { assetsDir }),
    ...(extraFiles.length === 0 ? {} : { extraFiles }),
  }
}

/** Review fixes the explanatory shape to Why/How and keeps file order in adjacent metadata. */
export function reviewBundleSource(
  data: ReviewCanvasTemplateData,
  assetsDir?: string,
): CanvasBundleSource {
  const metadata = {
    name: data.title,
    layers: data.layers,
    files: data.files,
    sections: [],
  }
  return structuredSource(reviewCanvasDocument(data), assetsDir, [
    { path: REVIEW_CANVAS_METADATA, content: `${JSON.stringify(metadata, null, 2)}\n` },
  ])
}

/** Plan chooses its bounded tabs, but still resolves to the shared structured document. */
export function planBundleSource(
  data: PlanCanvasTemplateData,
  assetsDir?: string,
): CanvasBundleSource {
  return structuredSource(planCanvasDocument(data), assetsDir)
}

/** Decision compiles semantic agent input into the version-2 Porcelain-owned renderer. */
export function decisionBundleSource(data: DecisionCanvasTemplateData): CanvasBundleSource {
  return structuredSource(decisionCanvasDocument(data), undefined)
}
