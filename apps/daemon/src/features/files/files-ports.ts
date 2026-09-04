import type { ResolvedProfile, WorktreeProfile } from '@porcelain/contracts'
import type { DirEntry, FileView, RepoScope, WorktreeProfileView } from '@porcelain/contracts/files'

/** Shared outside predicate — NEVER use startsWith('..') alone; NEVER string-prefix root checks. */
export type FilesPathOutsideError = { code: 'path-outside-project'; path: string }
export type FilesNotFoundError = { code: 'not-found'; path: string }
export type FilesAlreadyExistsError = { code: 'already-exists'; path: string }
export type FilesDestinationExistsError = { code: 'destination-exists' }

export type ProjectRootResolution =
  | { ok: true; projectPathWire: string; projectRootReal: string }
  | { ok: false; reason: 'unusable-project-root' }

/**
 * Existing entry under the declared root.
 * lexicalAbsolute = namespace entry the client named (symlink entry preserved).
 * resolvedAbsolute = realpath of that entry (final symlink followed) — containment proven on this.
 */
export type ContainedExistingPath = {
  relative: string
  lexicalAbsolute: string
  resolvedAbsolute: string
}

/**
 * Destination for create / write / rename-to after containment proof.
 * lexicalAbsolute = namespace path for host I/O (symlink entry preserved).
 * ioAbsolute = authorization evidence only (never the create/write open path when a
 *   distinct lexical entry is intended):
 *   - leafExists true: resolveExisting.resolvedAbsolute (real final target under root)
 *   - leafExists false: deepest contained ancestor realpath + remaining lexical suffix
 * Host I/O for create/write/rename dest ALWAYS uses lexicalAbsolute after ok.
 * Never reconstructed across an unresolved/dangling/outside intermediate symlink.
 */
export type ContainedMissingCapablePath = {
  relative: string
  lexicalAbsolute: string
  /** Resolved authorization target (existing leaf) or reconstructed missing path under a contained ancestor. */
  ioAbsolute: string
  /** True when the final lexical path exists as any directory entry (file/dir/symlink). */
  leafExists: boolean
}

export type ResolveFailure =
  | { code: 'path-outside-project'; path: string }
  | { code: 'not-found'; path: string }

export type ResolveExistingResult =
  | { ok: true; value: ContainedExistingPath }
  | { ok: false; error: ResolveFailure }

export type ResolveMissingCapableResult =
  | { ok: true; value: ContainedMissingCapablePath }
  | { ok: false; error: ResolveFailure }

export type FilesOperationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false
      error:
        | FilesPathOutsideError
        | FilesNotFoundError
        | FilesAlreadyExistsError
        | FilesDestinationExistsError
    }

export type WorkspaceFiles = {
  readDir(input: {
    projectPath: string
    path: string
    showHidden: boolean
    hiddenPaths: ReadonlySet<string>
    pinnedPaths: ReadonlySet<string>
  }): Promise<
    | { ok: true; value: DirEntry[] }
    | { ok: false; error: FilesPathOutsideError | FilesNotFoundError }
  >

  pinnedEntries(input: {
    projectPath: string
    hiddenPaths: ReadonlySet<string>
    pinnedPaths: readonly string[]
  }): Promise<DirEntry[]>

  readFile(input: {
    projectPath: string
    path: string
  }): Promise<{ ok: true; value: FileView } | { ok: false; error: FilesPathOutsideError }>

  previewHtml(input: {
    projectPath: string
    path: string
    /**
     * Inline sibling `<script src>` files too. Internal, never on the wire: only the
     * token-gated `GET /file-preview/<token>` route asks for it, because that response
     * is the ONE preview surface served with a CSP that lets author scripts run. The
     * tRPC `previewHtml` procedure (web reader fallback, mobile) leaves it off — those
     * render inside `sandbox=""`/no-script CSP frames where a script is dead weight.
     */
    inlineScripts?: boolean
  }): Promise<{ ok: true; value: string | null } | { ok: false; error: FilesPathOutsideError }>

  writeTextFile(input: {
    projectPath: string
    path: string
    content: string
  }): Promise<
    | { ok: true; value: undefined }
    | { ok: false; error: FilesPathOutsideError | FilesNotFoundError }
  >

  createFile(input: {
    projectPath: string
    path: string
  }): Promise<
    | { ok: true; value: undefined }
    | { ok: false; error: FilesPathOutsideError | FilesAlreadyExistsError | FilesNotFoundError }
  >

  createFolder(input: {
    projectPath: string
    path: string
  }): Promise<
    | { ok: true; value: undefined }
    | { ok: false; error: FilesPathOutsideError | FilesAlreadyExistsError | FilesNotFoundError }
  >

  renamePath(input: { projectPath: string; from: string; to: string }): Promise<
    | { ok: true; value: undefined }
    | {
        ok: false
        error: FilesPathOutsideError | FilesNotFoundError | FilesDestinationExistsError
      }
  >

  duplicatePath(input: { projectPath: string; path: string }): Promise<
    | { ok: true; value: string } // project-relative new path
    | { ok: false; error: FilesPathOutsideError | FilesNotFoundError }
  >

  trashPath(input: {
    projectPath: string
    path: string
  }): Promise<
    | { ok: true; value: undefined }
    | { ok: false; error: FilesPathOutsideError | FilesNotFoundError }
  >
}

/** Files' repo-local visibility and pin scope. The operation composes this with host-fs reads. */
export type FilesScope = Readonly<{
  read(repoPath: string): Promise<RepoScope>
  /** The same profile, broken into project baseline + worktree override. */
  readProfile(repoPath: string): Promise<WorktreeProfileView>
  setProjectProfile(repoPath: string, profile: ResolvedProfile): Promise<void>
  setWorktreeProfile(repoPath: string, profile: WorktreeProfile | null): Promise<void>
  hidePath(repoPath: string, path: string): Promise<void>
  unhidePath(repoPath: string, path: string): Promise<void>
  pinPath(repoPath: string, path: string): Promise<void>
  unpinPath(repoPath: string, path: string): Promise<void>
  /** Move exact and descendant personal curation entries after a successful filesystem rename. */
  renamePath(repoPath: string, from: string, to: string): Promise<void>
}>

export type FilesChangeFact =
  | {
      type: 'files.content-changed'
      projectPath: string
      paths: readonly string[]
    }
  | {
      type: 'files.tree-changed'
      projectPath: string
      paths: readonly string[]
    }

export type FilesChanges = {
  /** Best-effort; must not throw to callers. */
  publish(change: FilesChangeFact): void
}
