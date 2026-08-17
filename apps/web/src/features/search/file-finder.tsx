import type { ActionView } from '@porcelain/contracts/actions'
import type { Commit } from '@porcelain/contracts/git'
import type { SearchResult } from '@porcelain/contracts/search'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@renderer/components/ui/command'
import { Kbd, KbdGroup } from '@renderer/components/ui/kbd'
import { FileTypeIcon, FolderIcon } from '@renderer/components/viewer/file-icon'
import { useActionRun, useActionRunStore, useActions } from '@renderer/features/actions'
import { useGitLog } from '@renderer/features/git'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { commandGroupHeadingClass } from '@renderer/lib/controls'
import { isTerminalTarget, kbdLabel } from '@renderer/lib/keyboard'
import { dirName, fileName } from '@renderer/lib/paths'
import { openTerminalPanel } from '@renderer/lib/terminal-actions'
import { useFileFinderStore } from '@renderer/stores/file-finder'
import { activeTabTarget, targetedTab } from '@renderer/stores/hub-tabs'
import { type SidebarTab, usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useRevealStore } from '@renderer/stores/reveal'
import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { useTabsStore } from '@renderer/stores/tabs'
import { runUserAction } from '@shared/background'
import type { LucideIcon } from 'lucide-react'
import {
  FileDiff,
  FileText,
  GitCommitHorizontal,
  History,
  Play,
  Search,
  Settings,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { useFileSearch } from './search-queries'

// A 7–40 char hex string is almost certainly a pasted commit SHA (the History list
// shows 7-char short hashes; "Copy SHA" yields the full 40). We match these against
// the already-loaded recent commits only — no fresh `git log`, so commits older than
// the History limit aren't searched (by design, for now).
const SHA_QUERY = /^[0-9a-f]{7,40}$/i

/** Saved commands whose title or command text contains the query (few items, plain substring). */
function matchCommands(query: string, actions: ActionView[]): ActionView[] {
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

interface FinderAction {
  id: string
  label: string
  description: string
  keywords: string
  icon: LucideIcon
  shortcut?: string
  onSelect: () => void
}

function matchesFinderAction(action: FinderAction, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  return `${action.label} ${action.description} ${action.keywords}`.toLowerCase().includes(q)
}

export function FileFinder(): React.JSX.Element {
  const project = useProjectSelectionStore((s) => s.project)
  const openTab = useTabsStore((s) => s.openTab)
  const setSidebarTab = usePreferencesStore((s) => s.setSidebarTab)
  const reveal = useRevealStore((s) => s.reveal)
  const openSettings = useSettingsDialogStore((s) => s.openTo)
  // Open state lives in a store so the navigation search trigger can raise the popup too.
  const open = useFileFinderStore((s) => s.open)
  const setOpen = useFileFinderStore((s) => s.setOpen)
  const runAction = useActionRun()
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
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey)) return
      // ⌘P always; ⌘K mirrors the navigation search trigger, but over a focused terminal
      // ⌘K stays the shell's clear-screen (handled in the Ghostty registry).
      if (e.key === 'p' || (e.key === 'k' && !isTerminalTarget(e.target))) {
        e.preventDefault()
        setOpen(!useFileFinderStore.getState().open)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setOpen])

  const { results: files, isFetching } = useFileSearch(debouncedQuery, open)
  // Commands + commits match the already-loaded project data instantly (no IPC), gated to
  // when the finder is open so the always-mounted finder doesn't fetch them on launch.
  const commands = matchCommands(query, useActions(open))
  const commits = matchCommits(query, useGitLog(200, open) ?? [])
  const searching = isFetching || query !== debouncedQuery
  const closeFinder = (): void => {
    setOpen(false)
    setQuery('')
  }

  const openSurface = (tab: SidebarTab): void => {
    setSidebarTab(tab)
    closeFinder()
  }

  const paletteActions: FinderAction[] = [
    {
      id: 'files',
      label: 'Browse project files',
      description: 'Open the project tree',
      keywords: 'files folders tree',
      icon: FileText,
      shortcut: kbdLabel('mod', '1'),
      onSelect: () => openSurface('files'),
    },
    {
      id: 'search',
      label: 'Search project contents',
      description: 'Search text across files',
      keywords: 'search code text contents grep',
      icon: Search,
      shortcut: kbdLabel('mod', 'shift', 'F'),
      onSelect: () => openSurface('search'),
    },
    {
      id: 'changes',
      label: 'Open changes',
      description: 'Review working-tree changes',
      keywords: 'git diff modified files',
      icon: FileDiff,
      shortcut: kbdLabel('mod', '2'),
      onSelect: () => openSurface('changes'),
    },
    {
      id: 'history',
      label: 'Open history',
      description: 'Inspect commit history',
      keywords: 'commits log git',
      icon: History,
      shortcut: kbdLabel('mod', '3'),
      onSelect: () => openSurface('history'),
    },
    {
      id: 'git',
      label: 'Open Git',
      description: 'Commands, suggestions, and commit',
      keywords: 'git commit pull push stash',
      icon: GitCommitHorizontal,
      shortcut: kbdLabel('mod', '5'),
      onSelect: () => openSurface('git'),
    },
    {
      id: 'settings',
      label: 'Open settings',
      description: 'Configure Porcelain',
      keywords: 'preferences options configuration',
      icon: Settings,
      onSelect: () => {
        closeFinder()
        openSettings()
      },
    },
  ].filter((action) => matchesFinderAction(action, query))

  const empty =
    files.length === 0 &&
    commands.length === 0 &&
    commits.length === 0 &&
    paletteActions.length === 0
  // Label the groups only when more than one kind is present; a plain file search
  // (the common case) stays heading-less, as before.
  const kinds =
    (files.length > 0 ? 1 : 0) +
    (commands.length > 0 ? 1 : 0) +
    (commits.length > 0 ? 1 : 0) +
    (paletteActions.length > 0 ? 1 : 0)
  const labelled = kinds > 1

  const handleOpenFile = (result: SearchResult): void => {
    if (!project) return
    const absolute = `${project.path}/${result.path}`
    if (result.kind === 'dir') {
      // Porcelain isn't an editor — a folder can't open as a tab. Flip to the
      // Files tab and reveal it in the tree (expand down to it + scroll), the
      // same path Changes → Open file takes.
      setSidebarTab('files')
      reveal(absolute)
    } else {
      const name = fileName(result.path)
      openTab(targetedTab('file', absolute, { title: name }, activeTabTarget()))
    }
    closeFinder()
  }

  const requestLocalRun = useActionRunStore((s) => s.requestLocalRun)
  const handleRunCommand = (action: ActionView): void => {
    closeFinder()
    runUserAction(
      async () => {
        const result = await runAction(action)
        if (result === 'needs-local-path') {
          // ActionsGroup owns the path dialog — open the bottom terminal panel, and hand
          // the pending action through the compose-intent store.
          await openTerminalPanel()
          requestLocalRun(action)
        }
        if (result === 'needs-trust') {
          // Trust dialog lives on ActionsGroup; open the terminal companion so the
          // human can accept the command from the list (unreviewed shield).
          await openTerminalPanel()
        }
        if (result === 'needs-target') {
          // No Worktree is selected, so there is no checkout to run in. Say so rather
          // than silently doing nothing or picking one (#24).
          throw new Error('Select a Worktree first — a command needs a checkout to run in.')
        }
      },
      (error) => {
        toastUserActionError('Run command', error)
      },
    )
  }

  const handleOpenCommit = (commit: Commit): void => {
    // "Go to the History tab and find it": surface the History tab + open the commit view.
    setSidebarTab('history')
    openTab(
      targetedTab('commit', commit.hash, { title: commit.subject.slice(0, 32) }, activeTabTarget()),
    )
    closeFinder()
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search commands, projects, files, and commits"
      className="sm:max-w-2xl gap-0"
    >
      <Command shouldFilter={false} className="rounded-none! bg-transparent! p-0">
        <CommandInput
          variant="palette"
          placeholder="Search commands, projects, files, and commits…"
          value={query}
          onValueChange={setQuery}
          className="text-sm-minus"
        />
        <CommandList>
          {paletteActions.length > 0 && (
            <CommandGroup heading="Actions" className={commandGroupHeadingClass}>
              {paletteActions.map((action) => {
                const Icon = action.icon
                return (
                  <CommandItem
                    key={`action:${action.id}`}
                    value={`action:${action.id}`}
                    onSelect={action.onSelect}
                    className="min-h-10"
                  >
                    <Icon className="shrink-0 text-muted-foreground" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm-minus">{action.label}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {action.description}
                      </span>
                    </span>
                    {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}
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
                    onSelect={() => handleOpenFile(result)}
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
                  onSelect={() => handleRunCommand(action)}
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
                  onSelect={() => handleOpenCommit(commit)}
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
      <div className="flex items-center gap-3 border-t bg-muted/20 px-3 py-2 text-2xs text-muted-foreground">
        <KbdGroup>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span>Navigate</span>
        </KbdGroup>
        <KbdGroup>
          <Kbd>Enter</Kbd>
          <span>Select</span>
        </KbdGroup>
        <KbdGroup>
          <Kbd>Esc</Kbd>
          <span>Close</span>
        </KbdGroup>
      </div>
    </CommandDialog>
  )
}
