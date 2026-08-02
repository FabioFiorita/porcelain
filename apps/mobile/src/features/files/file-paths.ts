import type { Href } from 'expo-router'

const SEPARATOR = '/'

function trimTrailingSeparators(path: string): string {
  if (path === SEPARATOR) return path
  return path.replace(/\/+$/, '')
}

function cleanRelativePath(path: string): string {
  return path
    .split(SEPARATOR)
    .filter((segment) => segment !== '')
    .join(SEPARATOR)
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export function routeSegments(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value : value === undefined ? [] : value.split(SEPARATOR)
  return raw.map(decodeSegment).filter((segment) => segment !== '')
}

/** Returns the repo-relative path, or null when an absolute daemon path is outside the repo. */
export function repoRelativePath(repoPath: string, absolutePath: string): string | null {
  const repo = trimTrailingSeparators(repoPath)
  const absolute = trimTrailingSeparators(absolutePath)
  if (absolute === repo) return ''
  const prefix = `${repo}${SEPARATOR}`
  return absolute.startsWith(prefix) ? absolute.slice(prefix.length) : null
}

/** Joins a route's relative segments to the daemon-side repo path without allowing traversal. */
export function absoluteRepoPath(
  repoPath: string,
  relativePath: string | readonly string[],
): string {
  const raw = typeof relativePath === 'string' ? relativePath : relativePath.join(SEPARATOR)
  const relative = cleanRelativePath(raw)
  if (relative === '') return trimTrailingSeparators(repoPath)
  if (relative.split(SEPARATOR).some((segment) => segment === '..')) {
    return trimTrailingSeparators(repoPath)
  }
  return `${trimTrailingSeparators(repoPath)}${SEPARATOR}${relative}`
}

export function basename(path: string): string {
  const clean = trimTrailingSeparators(path)
  if (clean === '') return ''
  const index = clean.lastIndexOf(SEPARATOR)
  return index === -1 ? clean : clean.slice(index + 1)
}

export function parentRelativePath(path: string): string {
  const clean = cleanRelativePath(path)
  const index = clean.lastIndexOf(SEPARATOR)
  return index === -1 ? '' : clean.slice(0, index)
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB'] as const
  let value = bytes
  let unitIndex = -1
  do {
    value /= 1024
    unitIndex += 1
  } while (value >= 1024 && unitIndex < units.length - 1)
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

function encodedSegments(relativePath: string): string {
  return cleanRelativePath(relativePath)
    .split(SEPARATOR)
    .filter((segment) => segment !== '')
    .map(encodeURIComponent)
    .join(SEPARATOR)
}

export function entryHref(kind: 'file' | 'dir', relativePath: string): Href {
  const route = kind === 'dir' ? 'dir' : 'file'
  return `/(tabs)/(files)/${route}/${encodedSegments(relativePath)}`
}

export function hrefForAbsolutePath(
  repoPath: string,
  absolutePath: string,
  kind: 'file' | 'dir',
): Href {
  const relative = repoRelativePath(repoPath, absolutePath)
  return relative === null || relative === '' ? '/(tabs)/(files)' : entryHref(kind, relative)
}
