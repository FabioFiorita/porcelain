import {
  type DecisionCanvasTemplateData,
  decisionCanvasDocument,
  type ReviewCanvasTemplateData,
  reviewCanvasDocument,
  type StructuredCanvasDocument,
} from '@porcelain/contracts/projects'
import type { CanvasBundleSource } from '../../features/projects'

function structuredSource(document: StructuredCanvasDocument): CanvasBundleSource {
  return {
    kind: 'structured',
    entryFile: 'canvas.json',
    document: `${JSON.stringify(document, null, 2)}\n`,
  }
}

/** Decision compiles semantic agent input into the Porcelain-owned renderer. */
export function decisionBundleSource(data: DecisionCanvasTemplateData): CanvasBundleSource {
  return structuredSource(decisionCanvasDocument(data))
}

export const REVIEW_CANVAS_METADATA = 'review.json'

/** Review keeps semantic Why/How in v2 and stores History layers beside the document. */
export function reviewBundleSource(
  data: ReviewCanvasTemplateData,
  commitHash?: string,
): CanvasBundleSource {
  const document = reviewCanvasDocument(data)
  return {
    kind: 'structured',
    entryFile: 'canvas.json',
    document: `${JSON.stringify(document, null, 2)}\n`,
    extraFiles: [
      {
        path: REVIEW_CANVAS_METADATA,
        content: `${JSON.stringify(
          {
            name: data.title,
            ...(commitHash === undefined ? {} : { commitHash }),
            layers: data.layers,
            files: data.files,
            sections: [],
          },
          null,
          2,
        )}\n`,
      },
    ],
  }
}
