import type { Action } from '@backend/actions-store'
import type { Commit } from '@backend/diff'
import type { SearchResult } from '@backend/fuzzy'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@renderer/components/ui/command'
import { FileTypeIcon, FolderIcon } from '@renderer/components/viewer/file-icon'
import { useActions, useRunAction } from '@renderer/hooks/use-actions'
import { useGitLog } from '@renderer/hooks/use-history'
import { useFileSearch } from '@renderer/hooks/use-search'
import { commandGroupHeadingClass } from '@renderer/lib/controls'
import { isTerminalTarget } from '@renderer/lib/keyboard'
import { dirName, fileName } from '@renderer/lib/paths'
import { useFileFinderStore } from '@renderer/stores/file-finder'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useRevealStore } from '@renderer/stores/reveal'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { GitCommitHorizontal, Play } from 'lucide-react'
import { useEffect, useState } from 'react'

// A 7–40 char hex string is almost certainly a pasted commit SHA (the History list
// shows 7-char short hashes; "Copy SHA" yields the full 40). We match these against
// the already-loaded recent commits only — no fresh `git log`, so commits older than
// the History limit aren't searched (by design, for now).
const SHA_QUERY = /^[0-9a-f]{7,40}$/i

/** Saved commands whose title or command text contains the query (few items, plain substring). */
function matchCommands(query: string, actions: Action[]): Action[] {
  const q = query.trim().toLowerCase()
  if (q === '') return []
  return actions
    .filter((a) => a.title.toLowerCase().includes(q) || a.command.toLowerCase().includes(q))
    .slice(0, 5)
}

/** Recent commits whose hash starts with the pasted SHA. Empty unless the query is SHA-shaped. */
function matchCommits(query: string, commits: Commit[]): Commit[] {
  const q = query.trim().toLowerCase()
  if (!SHA_QUERY.test(q)) return []
  return commits.filter((c) => c.hash.toLowerCase().startsWith(q)).slice(0, 5)
}

export function FileFinder(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const setSidebarTab = usePreferencesStore((s) => s.setSidebarTab)
  const reveal = useRevealStore((s) => s.reveal)
  // Open state lives in a store so the titlebar search bar can raise the popup too.
  const open = useFileFinderStore((s) => s.open)
  const setOpen = useFileFinderStore((s) => s.setOpen)
  const runAction = useRunAction()
  const [query, setQuery] = useState('')
  // debounce keystrokes so each IPC round-trip searches a settled query
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 100)
    return () => clearTimeout(timer)
  }, [query])

  // reset on close so reopening starts a fresh search (Escape keeps state otherwise)
  useEffect(() => {
    if (!open) {
      setQuery('')
      setDebouncedQuery('')
    }
  }, [open])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey)) return
      // ⌘P always; ⌘K mirrors the titlebar search bar, but over a focused terminal
      // ⌘K stays the shell's clear-screen (handled in the xterm registry).
      if (e.key === 'p' || (e.key === 'k' && !isTerminalTarget(e.target))) {
        e.preventDefault()
        setOpen(!useFileFinderStore.getState().open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setOpen])

  const { results: files, isFetching } = useFileSearch(debouncedQuery, open)
  // Commands + commits match the already-loaded repo data instantly (no IPC), gated to
  // when the finder is open so the always-mounted finder doesn't fetch them on launch.
  const commands = matchCommands(query, useActions(open))
  const commits = matchCommits(query, useGitLog(200, open) ?? [])
  const searching = isFetching || query !== debouncedQuery
  const empty = files.length === 0 && commands.length === 0 && commits.length === 0
  // Label the groups only when more than one kind is present; a plain file search
  // (the common case) stays heading-less, as before.
  const kinds =
    (files.length > 0 ? 1 : 0) + (commands.length > 0 ? 1 : 0) + (commits.length > 0 ? 1 : 0)
  const labelled = kinds > 1

  const openFile = (result: SearchResult): void => {
    if (!repo) return
    const absolute = `${repo.path}/${result.path}`
    if (result.kind === 'dir') {
      // Porcelain isn't an editor — a folder can't open as a tab. Flip to the
      // Files tab and reveal it in the tree (expand down to it + scroll), the
      // same path Changes → Open file takes.
      setSidebarTab('files')
      reveal(absolute)
    } else {
      const name = fileName(result.path)
      openTab({ id: tabId('file', absolute), kind: 'file', title: name, path: absolute })
    }
    setOpen(false)
    setQuery('')
  }

  const runCommand = (action: Action): Promise<void> => {
    setOpen(false)
    setQuery('')
    return runAction(action)
  }

  const openCommit = (commit: Commit): void => {
    // "Go to the History tab and find it": surface the History tab + open the commit view.
    setSidebarTab('history')
    openTab({
      id: tabId('commit', commit.hash),
      kind: 'commit',
      title: commit.subject.slice(0, 32),
      path: commit.hash,
    })
    setOpen(false)
    setQuery('')
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Go to file, command, or commit"
      className="sm:max-w-2xl"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search files, folders, commands, commits…"
          value={query}
          onValueChange={setQuery}
          className="text-sm-minus"
        />
        <CommandList>
          {query.trim() !== '' &&
            empty &&
            (searching ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Searching…</p>
            ) : (
              <CommandEmpty>No matches found</CommandEmpty>
            ))}
          {files.length > 0 && (
            <CommandGroup
              heading={labelled ? 'Files' : undefined}
              className={commandGroupHeadingClass}
            >
              {files.map((result) => {
                const { path, kind } = result
                const name = fileName(path)
                const dir = dirName(path)
                return (
                  <CommandItem
                    key={`${kind}:${path}`}
                    value={`${kind}:${path}`}
                    onSelect={() => openFile(result)}
                  >
                    {kind === 'dir' ? (
                      <FolderIcon className="shrink-0" />
                    ) : (
                      <FileTypeIcon name={name} className="shrink-0" />
                    )}
                    <span className="shrink-0 font-mono text-sm-minus">{name}</span>
                    {dir && (
                      <span
                        className="min-w-0 truncate font-mono text-xs text-muted-foreground"
                        dir="rtl"
                      >
                        {dir}
                      </span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}
          {commands.length > 0 && (
            <CommandGroup
              heading={labelled ? 'Commands' : undefined}
              className={commandGroupHeadingClass}
            >
              {commands.map((action) => (
                <CommandItem
                  key={`command:${action.id}`}
                  value={`command:${action.id}`}
                  onSelect={() => runCommand(action)}
                >
                  <Play className="shrink-0 text-muted-foreground" />
                  <span className="shrink-0 text-sm-minus">{action.title}</span>
                  <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                    {action.command}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {commits.length > 0 && (
            <CommandGroup
              heading={labelled ? 'Commits' : undefined}
              className={commandGroupHeadingClass}
            >
              {commits.map((commit) => (
                <CommandItem
                  key={`commit:${commit.hash}`}
                  value={`commit:${commit.hash}`}
                  onSelect={() => openCommit(commit)}
                >
                  <GitCommitHorizontal className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm-minus">{commit.subject}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {commit.hash.slice(0, 7)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
