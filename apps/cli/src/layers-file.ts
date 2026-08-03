import { PROJECT_FILES } from '@shared/project-porcelain'
import { readProjectJson, writeProjectJson } from './project-io'

// Flow layers — <repo>/.porcelain/layers.json

export interface Layer {
  label: string
  pattern: string
}

export const DEFAULT_LAYERS: Layer[] = [
  {
    label: 'Docs',
    pattern: '(^|/)(README|CONTRIBUTING|LICENSE|CHANGELOG)(\\.md)?$|(^|/)docs/',
  },
  {
    label: 'Agents',
    pattern:
      '(^|/)(AGENTS|CLAUDE|CLAUDE\\.local)\\.md$|(^|/)\\.agents/|(^|/)\\.claude/|(^|/)skills/',
  },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidPattern(pattern: string): boolean {
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

function parseLayers(value: unknown): Layer[] {
  if (!Array.isArray(value)) return []
  const layers: Layer[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const { label, pattern } = item
    if (typeof label !== 'string' || label.trim() === '') continue
    if (typeof pattern !== 'string' || pattern === '' || !isValidPattern(pattern)) continue
    layers.push({ label, pattern })
  }
  return layers
}

export function toLayers(value: unknown): Layer[] {
  if (!Array.isArray(value)) throw new Error('layers must be an array')
  if (value.length === 0) {
    throw new Error('layers must have at least one entry (use `porcelain layers reset` to clear)')
  }
  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`layers[${index}] must be an object`)
    const { label, pattern } = item
    if (typeof label !== 'string' || label.trim() === '') {
      throw new Error(`layers[${index}].label must be a non-empty string`)
    }
    if (typeof pattern !== 'string' || pattern === '') {
      throw new Error(`layers[${index}].pattern must be a non-empty string`)
    }
    if (!isValidPattern(pattern)) {
      throw new Error(`layers[${index}].pattern is not a valid regular expression`)
    }
    return { label, pattern }
  })
}

export function readLayers(repoPath: string): Layer[] | null {
  const layers = parseLayers(readProjectJson(repoPath, PROJECT_FILES.layers))
  return layers.length > 0 ? layers : null
}

export function setLayers(repoPath: string, layers: Layer[]): void {
  writeProjectJson(repoPath, PROJECT_FILES.layers, layers)
}

export function clearLayers(repoPath: string): void {
  writeProjectJson(repoPath, PROJECT_FILES.layers, [])
}

const renderList = (layers: readonly Layer[]): string =>
  layers.map((l, i) => `  ${i + 1}. ${l.label} — /${l.pattern}/`).join('\n')

export function describeLayers(repoPath: string, layers: Layer[] | null): string {
  if (!layers) {
    return `No custom flow layers for ${repoPath}; Porcelain applies starter groups (Docs + Agents):\n${renderList(DEFAULT_LAYERS)}\n\nSet with \`porcelain layers set\` → .porcelain/layers.json. Starters as JSON:\n${JSON.stringify(DEFAULT_LAYERS, null, 2)}`
  }
  return `Custom flow layers for ${repoPath} (${layers.length}):\n${renderList(layers)}\n\n\`porcelain layers reset\` returns to Docs + Agents starters. As JSON:\n${JSON.stringify(layers, null, 2)}`
}
