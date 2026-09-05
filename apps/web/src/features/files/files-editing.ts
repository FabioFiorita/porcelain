import { type HubTarget, sameHubTarget } from '@porcelain/client-runtime/projects'
import { normalizeProjectRoot } from './files-path'

const pendingEditors = new Map<object, { target: HubTarget | null; path: string }>()

export function trackUnsavedFile(
  editor: object,
  target: HubTarget | null,
  path: string,
): () => void {
  pendingEditors.set(editor, { target, path: normalizeProjectRoot(path) })
  return () => {
    pendingEditors.delete(editor)
  }
}

export function hasUnsavedFiles(target: HubTarget, paths: string[]): boolean {
  return [...pendingEditors.values()].some(
    (entry) =>
      sameHubTarget(entry.target, target) &&
      paths.some((path) => entry.path === path || entry.path.startsWith(`${path}/`)),
  )
}
