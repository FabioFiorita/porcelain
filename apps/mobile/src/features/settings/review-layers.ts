import type { Layer } from '@/lib/daemon/procedures/settings'

/**
 * The review layer editor's regex building and draft edits, with no React in them.
 *
 * A layer is a regular expression the reader never has to write by hand, so the builder is
 * generating source that has to be correct — an unescaped dot silently widens a pattern, and a
 * bad move index silently drops a layer. Both were inline in the panel; both are asserted in
 * `review-layers.test.ts` now.
 */

export type MatchType = 'folder' | 'ext' | 'suffix'

export const PLACEHOLDERS: Record<MatchType, string> = {
  ext: 'ts, tsx',
  folder: 'components, views',
  suffix: 'test, spec',
}

export const MATCH_HELP: Record<MatchType, string> = {
  ext: 'Files with this extension, e.g. config.yaml.',
  folder: 'Files inside a folder of this name, e.g. src/components/Button.tsx.',
  suffix: 'Files whose name ends with this before the extension, e.g. user.test.ts.',
}

/** How many matching paths the preview lists before collapsing the rest into a count. */
export const EXAMPLE_LIMIT = 6

/** A layer with a stable identity for React while it is only a draft. */
export interface DraftLayer extends Layer {
  id: number
}

function escapeRe(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** The comma-separated names field, as a list. Blanks and stray spaces are not names. */
export function splitNames(raw: string): string[] {
  return raw
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
}

/**
 * The regex for a match type over a set of names. Names are escaped: a project really can have a
 * folder called `v1.2`, and an unescaped dot there would quietly match `v1x2` too.
 */
export function buildPattern(type: MatchType, names: readonly string[]): string {
  if (names.length === 0) return ''
  const alt = `(${names.map(escapeRe).join('|')})`
  if (type === 'folder') return `(^|/)${alt}/`
  if (type === 'ext') return `\\.${alt}$`
  return `\\.${alt}\\.[a-z]+$`
}

/** The first name, title-cased — a label the reader can rename, not a decision. */
export function deriveLabel(names: readonly string[]): string {
  const first = names[0] ?? ''
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : 'New layer'
}

/** Why a pattern cannot be saved, or null. The message is shown under the field verbatim. */
export function patternError(pattern: string): string | null {
  if (pattern.trim() === '') return 'pattern is required'
  try {
    new RegExp(pattern)
    return null
  } catch {
    return 'invalid regular expression'
  }
}

/** The preview: which of the currently changed files a pattern would claim. */
export function matchingPaths(pattern: string, paths: readonly string[]): string[] {
  if (pattern === '') return []
  let re: RegExp
  try {
    re = new RegExp(pattern)
  } catch {
    return []
  }
  return paths.filter((path) => re.test(path))
}

/** A draft is saveable only when every layer has a label and a usable pattern. */
export function layersAreValid(layers: readonly DraftLayer[]): boolean {
  return layers.every((layer) => layer.label.trim() !== '' && patternError(layer.pattern) === null)
}

/**
 * One step of a layer's reorder. Order is the whole meaning of the list — furthest-right match
 * wins — so a move that would run off either end returns the list unchanged rather than
 * wrapping or dropping the layer.
 */
export function moveLayer(
  layers: readonly DraftLayer[],
  index: number,
  direction: 1 | -1,
): DraftLayer[] {
  const target = index + direction
  if (target < 0 || target >= layers.length) return [...layers]
  const next = [...layers]
  const [moved] = next.splice(index, 1)
  if (moved === undefined) return [...layers]
  next.splice(target, 0, moved)
  return next
}
