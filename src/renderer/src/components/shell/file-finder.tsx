import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@renderer/components/ui/command'
import { FileTypeIcon } from '@renderer/components/viewer/file-icon'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { useTabsStore } from '@renderer/stores/tabs'
import { useEffect, useState } from 'react'

export function FileFinder(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const [open, setOpen] = useState(false)
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
      if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const { data: results = [], isFetching } = trpc.searchFiles.useQuery(
    { repoPath: repo?.path ?? '', query: debouncedQuery },
    { enabled: open && repo !== null && debouncedQuery.trim() !== '', keepPreviousData: true },
  )
  const searching = isFetching || query !== debouncedQuery

  const select = (relPath: string): void => {
    if (!repo) return
    const name = relPath.split('/').at(-1) ?? relPath
    openTab({
      id: `${repo.path}/${relPath}`,
      kind: 'file',
      title: name,
      path: `${repo.path}/${relPath}`,
    })
    setOpen(false)
    setQuery('')
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Go to file" className="sm:max-w-2xl">
      <Command shouldFilter={false}>
        <CommandInput placeholder="Search files…" value={query} onValueChange={setQuery} />
        <CommandList>
          {query.trim() !== '' &&
            results.length === 0 &&
            (searching ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Searching…</p>
            ) : (
              <CommandEmpty>No files found</CommandEmpty>
            ))}
          <CommandGroup>
            {results.map((path) => {
              const slash = path.lastIndexOf('/')
              const name = slash === -1 ? path : path.slice(slash + 1)
              const dir = slash === -1 ? '' : path.slice(0, slash)
              return (
                <CommandItem key={path} value={path} onSelect={() => select(path)}>
                  <FileTypeIcon name={name} className="shrink-0" />
                  <span className="shrink-0">{name}</span>
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
