import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@renderer/components/ui/command'
import { useTextSearch } from '@renderer/hooks/use-search'
import { fileName } from '@renderer/lib/paths'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { useEffect, useState } from 'react'

export function ContentSearch(): React.JSX.Element {
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

  // reset on close so reopening starts a fresh search
  useEffect(() => {
    if (!open) {
      setQuery('')
      setDebouncedQuery('')
    }
  }, [open])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.code === 'KeyF' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const { matches, error, isFetching } = useTextSearch(debouncedQuery, open)
  const searching = isFetching || query !== debouncedQuery

  const select = (path: string, line: number): void => {
    if (!repo) return
    const name = fileName(path)
    openTab({
      id: tabId('file', `${repo.path}/${path}`),
      kind: 'file',
      title: name,
      path: `${repo.path}/${path}`,
      line,
    })
    setOpen(false)
    setQuery('')
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search in files"
      className="sm:max-w-2xl"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search in files…"
          value={query}
          onValueChange={setQuery}
          className="text-sm-minus"
        />
        <CommandList>
          {error && <p className="py-6 text-center text-sm text-destructive">{error.message}</p>}
          {!error &&
            query.trim() !== '' &&
            (!matches || matches.length === 0) &&
            (searching ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Searching…</p>
            ) : (
              <CommandEmpty>No matches</CommandEmpty>
            ))}
          {!error && matches && matches.length > 0 && (
            <CommandGroup>
              {matches.map((match) => (
                <CommandItem
                  key={`${match.path}:${match.line}`}
                  value={`${match.path}:${match.line}`}
                  onSelect={() => select(match.path, match.line)}
                >
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {match.path}:{match.line}
                  </span>
                  <span className="min-w-0 truncate font-mono text-xs">{match.text.trim()}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
