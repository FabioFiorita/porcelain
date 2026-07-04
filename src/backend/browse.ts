import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export interface BrowseEntry {
  name: string
  path: string
  /** The directory holds a `.git` entry (a repo checkout or a worktree). */
  isRepo: boolean
}

export interface BrowseResult {
  path: string
  /** dirname(path), or null when `path` is the filesystem root. */
  parent: string | null
  entries: BrowseEntry[]
}

/**
 * List the directories directly inside `path` for the daemon-side repo browser
 * (the folder picker on the welcome screen). `null` starts at the daemon user's
 * home. Returns directory NAMES only — never file contents — so it exposes no
 * more than a `readdir`; any token-holder can already open any path via
 * openRepoPath, so this widens nothing.
 *
 * Files are skipped and dotfiles (leading `.`) hidden; entries are sorted by
 * name, case-insensitive. `isRepo` flags a directory containing a `.git` entry
 * (dir OR file — worktrees use a `.git` file). An unreadable/nonexistent path
 * throws, so the caller surfaces the message instead of showing partial junk.
 */
export async function browseDirs(path: string | null): Promise<BrowseResult> {
  const target = path ?? homedir()
  const dirents = await readdir(target, { withFileTypes: true })
  const entries = dirents
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry): BrowseEntry => {
      const entryPath = join(target, entry.name)
      return { name: entry.name, path: entryPath, isRepo: existsSync(join(entryPath, '.git')) }
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'accent' }))
  const parent = dirname(target)
  return { path: target, parent: parent === target ? null : parent, entries }
}
