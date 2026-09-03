import {
  type DecisionCanvasTemplateData,
  decisionCanvasDocument,
  type ReviewCanvasDocument,
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

export function reviewDocumentBundleSource(
  document: ReviewCanvasDocument,
  metadata: Pick<ReviewCanvasTemplateData, 'layers' | 'files'>,
  commitHash?: string,
  assetsDir?: string,
): CanvasBundleSource {
  return {
    kind: 'structured',
    entryFile: 'canvas.json',
    document: `${JSON.stringify(document, null, 2)}\n`,
    ...(assetsDir === undefined ? {} : { assetsDir }),
    extraFiles: [
      {
        path: REVIEW_CANVAS_METADATA,
        content: `${JSON.stringify(
          {
            name: document.title,
            ...(commitHash === undefined ? {} : { commitHash }),
            layers: metadata.layers,
            files: metadata.files,
          },
          null,
          2,
        )}\n`,
      },
    ],
  }
}

/** Review stores one semantic document; Changes/History metadata stays beside it. */
export function reviewBundleSource(
  data: ReviewCanvasTemplateData,
  commitHash?: string,
  assetsDir?: string,
): CanvasBundleSource {
  const document = reviewCanvasDocument(data)
  return reviewDocumentBundleSource(document, data, commitHash, assetsDir)
}
