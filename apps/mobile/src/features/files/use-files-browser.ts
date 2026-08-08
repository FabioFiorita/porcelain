import { useState } from 'react'

import type { SheetAction } from '@/components/panel-chrome'
import type { CommentAnchor } from '@/features/comments/comment-composer'

import { directorySummary } from './directory-summary'
import type { EntryActions } from './file-entry-row'
import { containerFor } from './file-paths'
import {
  type FileEntry,
  type FileWrites,
  useDirEntries,
  useFileWrites,
  usePathScope,
} from './use-files'

/**
 * The write the tree is in the middle of asking about.
 *
 * One at a time, held by the browser rather than by the row: a prompt per row would put a
 * hundred modals in a directory listing, and only one of them can ever be on screen.
 */
export type PendingWrite =
  | { kind: 'create-file'; dir: string }
  | { kind: 'create-folder'; dir: string }
  | { kind: 'rename'; path: string; name: string }
  | { kind: 'trash'; path: string; name: string }

export type FilesBrowserState = {
  /** What the row long-press menu can do — handed straight to every row. */
  actions: EntryActions
  /** A daemon write that was refused, in the reader's words. */
  actionError: string | null
  /** The comment composer's open anchor, or null while it is closed. */
  anchor: CommentAnchor | null
  clearAnchor: () => void
  closePending: () => void
  entries: FileEntry[]
  error: Error | null
  /** The header's own New menu, for the case a long press cannot reach. */
  newActions: SheetAction[]
  newMenuOpen: boolean
  setNewMenuOpen: (open: boolean) => void
  pending: PendingWrite | null
  /** Nothing has arrived yet — distinct from a directory that really is empty. */
  reading: boolean
  /** The line under the breadcrumb. */
  summary: string
  /** Run a write and report a refusal on the error note. */
  guard: (label: string, run: () => Promise<void>) => void
  writes: FileWrites
}

/**
 * One directory's state: what is in it, what the reader is in the middle of doing to it, and
 * what came back when the daemon refused.
 *
 * The four things the browser used to hold separately — the comment anchor, the last error, the
 * pending write and the New menu — are one small machine: every action clears the error before
 * it opens a prompt, and every prompt closes into the same place. Keeping them together is what
 * stops a stale "Rename failed" from sitting above a dialog about a different file.
 */
export function useFilesBrowser({
  active,
  dirPath,
  onOpenDir,
  onOpenFile,
  showHidden,
}: {
  active: boolean
  /** Repo-relative directory; `''` is the repo root. */
  dirPath: string
  onOpenDir: (path: string) => void
  onOpenFile: (path: string) => void
  showHidden: boolean
}): FilesBrowserState {
  const { entries, error, isLoading } = useDirEntries(dirPath, active)
  const { hide, pin, unhide, unpin } = usePathScope()
  const writes = useFileWrites()
  const [anchor, setAnchor] = useState<CommentAnchor | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingWrite | null>(null)
  const [newMenuOpen, setNewMenuOpen] = useState(false)

  // Every scope write is a daemon round trip that can fail; report it here instead of letting
  // a long-press action look like it worked.
  const guard = (label: string, run: () => Promise<void>): void => {
    setActionError(null)
    run().catch((cause: unknown) => {
      setActionError(`${label}: ${cause instanceof Error ? cause.message : String(cause)}`)
    })
  }

  /** Opening a prompt clears whatever the last write said — it was about another path. */
  const ask = (next: PendingWrite): void => {
    setActionError(null)
    setPending(next)
  }

  const actions: EntryActions = {
    onComment: (path) => {
      setAnchor({ path })
    },
    onCreateFile: (entry) => {
      ask({ dir: containerFor(entry), kind: 'create-file' })
    },
    onCreateFolder: (entry) => {
      ask({ dir: containerFor(entry), kind: 'create-folder' })
    },
    onDuplicate: (entry) => {
      guard('Duplicate failed', async () => {
        await writes.duplicate(entry.path)
      })
    },
    onOpen: (entry: FileEntry) => {
      if (entry.kind === 'dir') onOpenDir(entry.path)
      else onOpenFile(entry.path)
    },
    onRename: (entry) => {
      ask({ kind: 'rename', name: entry.name, path: entry.path })
    },
    onSetHidden: (path, hidden) => {
      guard(hidden ? 'Hide failed' : 'Unhide failed', () => (hidden ? hide(path) : unhide(path)))
    },
    onSetPinned: (path, pinned) => {
      guard(pinned ? 'Pin failed' : 'Unpin failed', () => (pinned ? pin(path) : unpin(path)))
    },
    onTrash: (entry) => {
      ask({ kind: 'trash', name: entry.name, path: entry.path })
    },
  }

  // The header's own "New", for the case a long press cannot reach: an empty folder has no row
  // to press, and the repo root has no parent row either.
  const newActions: SheetAction[] = [
    {
      glyph: 'plus',
      id: 'new-file',
      label: 'New file',
      onPress: () => {
        ask({ dir: dirPath, kind: 'create-file' })
      },
    },
    {
      glyph: 'folder',
      id: 'new-folder',
      label: 'New folder',
      onPress: () => {
        ask({ dir: dirPath, kind: 'create-folder' })
      },
    },
  ]

  const reading = isLoading && entries.length === 0

  return {
    actionError,
    actions,
    anchor,
    clearAnchor: () => {
      setAnchor(null)
    },
    closePending: () => {
      setPending(null)
    },
    entries,
    error,
    guard,
    newActions,
    newMenuOpen,
    pending,
    reading,
    setNewMenuOpen,
    summary: directorySummary(entries, { reading, showHidden }),
    writes,
  }
}
