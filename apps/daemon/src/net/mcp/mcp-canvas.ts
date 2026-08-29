import {
  type DecisionCanvasTemplateData,
  decisionCanvasDocument,
} from '@porcelain/contracts/projects'
import type { CanvasBundleSource } from '../../features/projects'

function structuredSource(document: ReturnType<typeof decisionCanvasDocument>): CanvasBundleSource {
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
