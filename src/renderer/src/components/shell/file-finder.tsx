import type { SearchResult } from '@main/fuzzy'
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
import { useFileSearch } from '@renderer/hooks/use-search'
import { isTerminalTarget } from '@renderer/lib/keyboard'
import { useFileFinderStore } from '@renderer/stores/file-finder'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useRevealStore } from '@renderer/stores/reveal'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { useEffect, useState } from 'react'

export function FileFinder(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const setSidebarTab = usePreferencesStore((s) => s.setSidebarTab)
  const reveal = useRevealStore((s) => s.reveal)
  // Open state lives in a store so the titlebar search bar can raise the popup too.
  const open = useFileFinderStore((s) => s.open)
  const setOpen = useFileFinderStore((s) => s.setOpen)
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

  const { results, isFetching } = useFileSearch(debouncedQuery, open)
  const searching = isFetching || query !== debouncedQuery

  const select = (result: SearchResult): void => {
    if (!repo) return
    const absolute = `${repo.path}/${result.path}`
    if (result.kind === 'dir') {
      // Porcelain isn't an editor — a folder can't open as a tab. Flip to the
      // Files tab and reveal it in the tree (expand down to it + scroll), the
      // same path Changes → Open file takes.
      setSidebarTab('files')
      reveal(absolute)
    } else {
      const name = result.path.split('/').at(-1) ?? result.path
      openTab({ id: tabId('file', absolute), kind: 'file', title: name, path: absolute })
    }
    setOpen(false)
    setQuery('')
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Go to file or folder"
      className="sm:max-w-2xl"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search files and folders…"
          value={query}
          onValueChange={setQuery}
          className="text-[13px]"
        />
        <CommandList>
          {query.trim() !== '' &&
            results.length === 0 &&
            (searching ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Searching…</p>
            ) : (
              <CommandEmpty>No matches found</CommandEmpty>
            ))}
          <CommandGroup>
            {results.map((result) => {
              const { path, kind } = result
              const slash = path.lastIndexOf('/')
              const name = slash === -1 ? path : path.slice(slash + 1)
              const dir = slash === -1 ? '' : path.slice(0, slash)
              return (
                <CommandItem
                  key={`${kind}:${path}`}
                  value={`${kind}:${path}`}
                  onSelect={() => select(result)}
                >
                  {kind === 'dir' ? (
                    <FolderIcon className="shrink-0" />
                  ) : (
                    <FileTypeIcon name={name} className="shrink-0" />
                  )}
                  <span className="shrink-0 text-[13px]">{name}</span>
                  {dir && (
                    <span className="min-w-0 truncate text-xs text-muted-foreground" dir="rtl">
                      {dir}
                    </span>
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
