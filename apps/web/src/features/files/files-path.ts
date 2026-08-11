import { isFilesProjectRelativePath } from '@porcelain/contracts/files'

/** Strip trailing slashes except root `/`. */
export function normalizeProjectRoot(projectPath: string): string {
  const trimmed = projectPath.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

/**
 * Convert a daemon-host absolute path to a project-relative wire path.
 * Returns null when outside, equal to root, empty relative, or not a valid
 * filesProjectRelativePath (including embedded .. segments).
 */
export function projectRelativeFromAbsolute(
  projectPath: string,
  absolutePath: string,
): string | null {
  const root = normalizeProjectRoot(projectPath)
  if (absolutePath === root) return null
  const prefix = root === '/' ? '/' : `${root}/`
  if (!absolutePath.startsWith(prefix)) return null
  const rel = absolutePath.slice(prefix.length)
  if (rel === '') return null
  if (!isFilesProjectRelativePath(rel)) return null
  return rel
}

/**
 * Convert project-relative wire path back to UI absolute.
 * Normalized root `/` → `/${relative}` — NEVER `//${relative}`.
 */
export function projectAbsoluteFromRelative(projectPath: string, relative: string): string {
  const root = normalizeProjectRoot(projectPath)
  if (root === '/') return `/${relative}`
  return `${root}/${relative}`
}

/**
 * Absolute directory path → tree identity path (`'.'` for project root, else relative).
 * Null when outside the project.
 */
export function treePathFromAbsolute(projectPath: string, absolutePath: string): string | null {
  const root = normalizeProjectRoot(projectPath)
  if (absolutePath === root) return '.'
  return projectRelativeFromAbsolute(projectPath, absolutePath)
}
