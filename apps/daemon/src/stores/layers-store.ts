import { PROJECT_FILES } from '@shared/project-porcelain'
import { z } from 'zod'
import { createProjectChannel } from '../net/project-channel'
import type { Layer } from '../review/flow'

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

const channel = createProjectChannel({
  fileName: PROJECT_FILES.layers,
  schema: layersSchema,
  empty: (): Layer[] => [],
  transform: (layers) => layers.filter(compilable),
})

export function layersPath(repoPath: string): string {
  return channel.path(repoPath)
}

export async function readLayers(repoPath: string): Promise<Layer[] | null> {
  const layers = await channel.read(repoPath)
  return layers.length > 0 ? layers : null
}

export async function writeLayers(repoPath: string, layers: Layer[] | null): Promise<void> {
  await channel.write(repoPath, layers ?? [])
}
