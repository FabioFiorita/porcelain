import type { Layer } from '@porcelain/contracts/project-data'
import { PROJECT_FILES } from '@shared/project-porcelain'
import { z } from 'zod'
import { createProjectChannel } from '../../net/project-channel'
import type { LayersDocument } from './project-data-capabilities'

/**
 * Flow layers for a project — `<repo>/.porcelain/layers.json`.
 * Absence = DEFAULT_LAYERS (Docs + Agents starters). TWO-WAY: app + CLI.
 */

const layerSchema = z.object({ label: z.string(), pattern: z.string() })
const layersSchema = z.array(layerSchema)

function compilable(layer: Layer): boolean {
  if (layer.label.trim() === '' || layer.pattern === '') return false
  try {
    new RegExp(layer.pattern)
    return true
  } catch {
    return false
  }
}

export function createJsonLayersDocument(): LayersDocument {
  const channel = createProjectChannel({
    fileName: PROJECT_FILES.layers,
    schema: layersSchema,
    empty: (): Layer[] => [],
    transform: (layers) => layers.filter(compilable),
  })

  return {
    async read(repoPath) {
      const layers = await channel.read(repoPath)
      return layers.length > 0 ? layers : null
    },
    async write(repoPath, layers) {
      await channel.write(repoPath, layers ?? [])
    },
  }
}

let processDocument: LayersDocument | undefined

function processWideDocument(): LayersDocument {
  processDocument ??= createJsonLayersDocument()
  return processDocument
}

export function readLayers(repoPath: string): Promise<Layer[] | null> {
  return processWideDocument().read(repoPath)
}

export function writeLayers(repoPath: string, layers: Layer[] | null): Promise<void> {
  return processWideDocument().write(repoPath, layers)
}
