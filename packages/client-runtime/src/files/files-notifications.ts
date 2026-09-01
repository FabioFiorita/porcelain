import { type FilesChange, isFilesProjectRelativePath } from '@porcelain/contracts/files'
import type { FilesForeignDependency, FilesQueryEffect } from './files-effects'
import {
  contentPreviewEffects,
  dedupeFilesForeignDependencies,
  dedupeFilesQueryEffects,
  FILES_FOREIGN_CONTENT_INDEX,
  FILES_FOREIGN_PATH_INDEX,
  FILES_FOREIGN_WORKING_TREE,
  filesContentSubtreeEffect,
  filesExactEffect,
  filesTreeFamilyEffect,
  treeSubtreeEffectsForStructuralPath,
} from './files-effects'
import {
  filesPinsQuery,
  filesProfileQuery,
  filesProjectKey,
  filesScopeQuery,
  filesTreeQuery,
} from './files-queries'

/**
 * Exhaustive Files notification → query effect mapping.
 *
 * Coarse notification kinds are broader for foreign recovery than precise mutation
 * foreign sets because the wire fact does not name which structural/content ops occurred.
 */

const PATH_INDEX_ONLY: readonly FilesForeignDependency[] = [FILES_FOREIGN_PATH_INDEX]

const ALL_THREE_FOREIGN: readonly FilesForeignDependency[] = dedupeFilesForeignDependencies([
  FILES_FOREIGN_WORKING_TREE,
  FILES_FOREIGN_PATH_INDEX,
  FILES_FOREIGN_CONTENT_INDEX,
])

export function filesNotificationEffects(notification: FilesChange): readonly FilesQueryEffect[] {
  const projectPath = filesProjectKey(notification.projectPath)

  switch (notification.kind) {
    case 'files.scope-changed':
      return [
        filesExactEffect(filesScopeQuery(projectPath)),
        filesExactEffect(filesProfileQuery(projectPath)),
        filesExactEffect(filesPinsQuery(projectPath)),
        filesTreeFamilyEffect(projectPath),
      ]
    case 'files.tree-changed': {
      const effects: FilesQueryEffect[] = [filesExactEffect(filesPinsQuery(projectPath))]
      for (const path of notification.paths) {
        if (path === '.') {
          effects.push(filesExactEffect(filesTreeQuery(projectPath, '.', false)))
          effects.push(filesExactEffect(filesTreeQuery(projectPath, '.', true)))
          continue
        }
        effects.push(...treeSubtreeEffectsForStructuralPath(projectPath, path))
        effects.push(filesContentSubtreeEffect(projectPath, path))
      }
      return dedupeFilesQueryEffects(effects)
    }
    case 'files.content-changed': {
      const effects: FilesQueryEffect[] = []
      for (const path of notification.paths) {
        if (path === '.' || !isFilesProjectRelativePath(path)) continue
        effects.push(...contentPreviewEffects(projectPath, path))
      }
      return dedupeFilesQueryEffects(effects)
    }
    default: {
      const _exhaustive: never = notification
      return _exhaustive
    }
  }
}

/**
 * Cross-domain freshness tokens for a validated Files notification.
 * Separate from Files query effects — adapters apply both.
 */
export function filesNotificationForeignDependencies(
  notification: FilesChange,
): readonly FilesForeignDependency[] {
  switch (notification.kind) {
    case 'files.scope-changed':
      return PATH_INDEX_ONLY
    case 'files.tree-changed':
    case 'files.content-changed':
      return ALL_THREE_FOREIGN
    default: {
      const _exhaustive: never = notification
      return _exhaustive
    }
  }
}
