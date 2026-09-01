import { isFilesProjectRelativePath } from '@porcelain/contracts/files'
import type { WatchInterest, WatchInterestRegistration } from '../session/interests'
import { filesProjectKey } from './files-queries'

export type FilesInterestHost = {
  readonly registerWatchInterest: (interest: WatchInterest) => WatchInterestRegistration
}

export type FilesInterestHandle = {
  readonly release: () => void
}

export type FilesInterestHeld = {
  /** Absolute host paths this facade currently holds as file interests (first-seen unique). */
  readonly files: readonly string[]
  /** Absolute host paths this facade currently holds as directory interests (first-seen unique). */
  readonly dirs: readonly string[]
}

export type FilesInterest = {
  /**
   * Register one file interest. `relativePath` must satisfy `isFilesProjectRelativePath`.
   * Returns null without registering when invalid or after dispose.
   */
  readonly addFile: (relativePath: string) => FilesInterestHandle | null
  /**
   * Register one directory interest. `relativePath` is `'.'` (project root) or
   * `isFilesProjectRelativePath`. Returns null when invalid or after dispose.
   */
  readonly addDirectory: (relativePath: string) => FilesInterestHandle | null
  /**
   * Snapshot of absolute paths from currently unreleased handles.
   * First-seen unique per list (two equal adds remain two session registrations;
   * held() lists the absolute path once).
   */
  readonly held: () => FilesInterestHeld
  /**
   * Terminal: release every outstanding handle. Idempotent.
   * After dispose, addFile/addDirectory return null and make zero host calls.
   */
  readonly dispose: () => void
}

/** projectKey is '/' or has no trailing slash — never produce '//' */
function toAbsoluteInterestPath(projectKey: string, relative: string): string {
  if (relative === '.') return projectKey
  if (projectKey === '/') return `/${relative}`
  return `${projectKey}/${relative}`
}

type TrackedHandle = {
  readonly kind: 'file' | 'dir'
  readonly absolute: string
  readonly registration: WatchInterestRegistration
  released: boolean
}

/**
 * Bind Files relative interests to one session for one project root.
 * `projectPath` is normalized via `filesProjectKey` (absolute session project path).
 */
export function createFilesInterest(projectPath: string, host: FilesInterestHost): FilesInterest {
  const projectKey = filesProjectKey(projectPath)
  const handles = new Set<TrackedHandle>()
  let disposed = false

  function makeHandle(
    kind: 'file' | 'dir',
    absolute: string,
    registration: WatchInterestRegistration,
  ): FilesInterestHandle {
    const tracked: TrackedHandle = {
      kind,
      absolute,
      registration,
      released: false,
    }
    handles.add(tracked)
    return {
      release() {
        if (tracked.released) return
        tracked.released = true
        handles.delete(tracked)
        registration.release()
      },
    }
  }

  return {
    addFile(relativePath) {
      if (disposed) return null
      if (!isFilesProjectRelativePath(relativePath)) return null
      const abs = toAbsoluteInterestPath(projectKey, relativePath)
      const reg = host.registerWatchInterest({ files: [abs], dirs: [] })
      return makeHandle('file', abs, reg)
    },

    addDirectory(relativePath) {
      if (disposed) return null
      if (relativePath !== '.' && !isFilesProjectRelativePath(relativePath)) return null
      const abs = toAbsoluteInterestPath(projectKey, relativePath)
      const reg = host.registerWatchInterest({ files: [], dirs: [abs] })
      return makeHandle('dir', abs, reg)
    },

    held() {
      const files: string[] = []
      const dirs: string[] = []
      const seenFiles = new Set<string>()
      const seenDirs = new Set<string>()
      for (const handle of handles) {
        if (handle.released) continue
        if (handle.kind === 'file') {
          if (seenFiles.has(handle.absolute)) continue
          seenFiles.add(handle.absolute)
          files.push(handle.absolute)
        } else {
          if (seenDirs.has(handle.absolute)) continue
          seenDirs.add(handle.absolute)
          dirs.push(handle.absolute)
        }
      }
      return { files, dirs }
    },

    dispose() {
      if (disposed) return
      disposed = true
      for (const handle of [...handles]) {
        if (handle.released) continue
        handle.released = true
        handles.delete(handle)
        handle.registration.release()
      }
    },
  }
}
