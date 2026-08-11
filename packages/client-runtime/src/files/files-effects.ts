import { isFilesProjectRelativePath } from '@porcelain/contracts/files'
import {
  FilesIdentityError,
  type FilesQuery,
  fileContentQuery,
  filePreviewQuery,
  filesProjectKey,
  filesTreePathsAffectedBy,
  filesTreeQuery,
} from './files-queries'

/**
 * Runtime-owned invalidation effect. Not a sixth query identity.
 * Adapters must exhaustively switch on every exact, family, and subtree variant.
 */
export type FilesQueryEffect =
  | { readonly type: 'exact'; readonly query: FilesQuery }
  | { readonly type: 'tree-family'; readonly projectPath: string }
  | { readonly type: 'tree-subtree'; readonly projectPath: string; readonly path: string }
  | { readonly type: 'content-subtree'; readonly projectPath: string; readonly path: string }

/** Files-owned foreign freshness tokens — not query identities and not procedure names. */
export type FilesForeignDependency =
  | { readonly domain: 'git'; readonly name: 'working-tree' }
  | { readonly domain: 'search'; readonly name: 'path-index' }
  | { readonly domain: 'search'; readonly name: 'content-index' }

/** Stable foreign token constants (object identity + structural equality). */
export const FILES_FOREIGN_WORKING_TREE: FilesForeignDependency = {
  domain: 'git',
  name: 'working-tree',
}
export const FILES_FOREIGN_PATH_INDEX: FilesForeignDependency = {
  domain: 'search',
  name: 'path-index',
}
export const FILES_FOREIGN_CONTENT_INDEX: FilesForeignDependency = {
  domain: 'search',
  name: 'content-index',
}

export function filesExactEffect(query: FilesQuery): FilesQueryEffect {
  return { type: 'exact', query }
}

export function filesTreeFamilyEffect(projectPath: string): FilesQueryEffect {
  return { type: 'tree-family', projectPath: filesProjectKey(projectPath) }
}

function subtreeEffect(
  type: 'tree-subtree' | 'content-subtree',
  projectPath: string,
  path: string,
): FilesQueryEffect {
  if (!isFilesProjectRelativePath(path)) {
    throw new FilesIdentityError(`files: invalid ${type} path`)
  }
  return { type, projectPath: filesProjectKey(projectPath), path }
}

export function filesTreeSubtreeEffect(projectPath: string, path: string): FilesQueryEffect {
  return subtreeEffect('tree-subtree', projectPath, path)
}

export function filesContentSubtreeEffect(projectPath: string, path: string): FilesQueryEffect {
  return subtreeEffect('content-subtree', projectPath, path)
}

function exactQueryKey(query: FilesQuery): string {
  switch (query.name) {
    case 'tree':
      return `tree\0${query.projectPath}\0${query.path}\0${query.showHidden ? '1' : '0'}`
    case 'pins':
      return `pins\0${query.projectPath}`
    case 'scope':
      return `scope\0${query.projectPath}`
    case 'content':
      return `content\0${query.projectPath}\0${query.path}`
    case 'preview':
      return `preview\0${query.projectPath}\0${query.path}`
  }
}

function effectKey(effect: FilesQueryEffect): string {
  switch (effect.type) {
    case 'tree-family':
      return `tree-family\0${effect.projectPath}`
    case 'tree-subtree':
      return `tree-subtree\0${effect.projectPath}\0${effect.path}`
    case 'content-subtree':
      return `content-subtree\0${effect.projectPath}\0${effect.path}`
    case 'exact':
      return `exact\0${exactQueryKey(effect.query)}`
  }
}

/**
 * Dedup effects: first-seen order.
 * - exact: structural equality on `query` fields
 * - tree-family: equality on normalized `projectPath`
 * tree-family does not collapse exact tree identities in the same list
 * (callers should not emit redundant root exact trees when family is present;
 * scope helpers emit family only for trees).
 */
export function dedupeFilesQueryEffects(
  effects: readonly FilesQueryEffect[],
): readonly FilesQueryEffect[] {
  const seen = new Set<string>()
  const out: FilesQueryEffect[] = []
  for (const effect of effects) {
    const key = effectKey(effect)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(effect)
  }
  return out
}

/**
 * Dedup foreign tokens: first-seen order; equality on `{ domain, name }`.
 */
export function dedupeFilesForeignDependencies(
  deps: readonly FilesForeignDependency[],
): readonly FilesForeignDependency[] {
  const seen = new Set<string>()
  const out: FilesForeignDependency[] = []
  for (const dep of deps) {
    const key = `${dep.domain}\0${dep.name}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(dep)
  }
  return out
}

/**
 * Exact tree effects: both showHidden variants for each path in `filesTreePathsAffectedBy`.
 * Order: listed paths, then false then true per path. Wrap each as `{ type:'exact', query }`.
 * Dedup via `dedupeFilesQueryEffects`.
 */
export function treeEffectsForStructuralPath(
  projectPath: string,
  path: string,
): readonly FilesQueryEffect[] {
  const key = filesProjectKey(projectPath)
  const effects: FilesQueryEffect[] = []
  for (const treePath of filesTreePathsAffectedBy(path)) {
    effects.push(filesExactEffect(filesTreeQuery(key, treePath, false)))
    effects.push(filesExactEffect(filesTreeQuery(key, treePath, true)))
  }
  return dedupeFilesQueryEffects(effects)
}

/**
 * Exact content + preview effects for one file path (order: content, then preview).
 */
export function contentPreviewEffects(
  projectPath: string,
  path: string,
): readonly FilesQueryEffect[] {
  const key = filesProjectKey(projectPath)
  return [
    filesExactEffect(fileContentQuery(key, path)),
    filesExactEffect(filePreviewQuery(key, path)),
  ]
}

/** A structural directory path and every cached descendant, plus its parent listing. */
export function treeSubtreeEffectsForStructuralPath(
  projectPath: string,
  path: string,
): readonly FilesQueryEffect[] {
  const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '.'
  return dedupeFilesQueryEffects([
    filesTreeSubtreeEffect(projectPath, path),
    filesExactEffect(filesTreeQuery(projectPath, parent, false)),
    filesExactEffect(filesTreeQuery(projectPath, parent, true)),
  ])
}
