import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@renderer/components/ui/command'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { useTabsStore } from '@renderer/stores/tabs'
import { File } from 'lucide-react'
import { useEffect, useState } from 'react'

export function FileFinder(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

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

  const { data: results = [] } = trpc.searchFiles.useQuery(
    { repoPath: repo?.path ?? '', query },
    { enabled: open && repo !== null && query.trim() !== '', keepPreviousData: true },
  )

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
          {query.trim() !== '' && <CommandEmpty>No files found</CommandEmpty>}
          {results.map((path) => {
            const slash = path.lastIndexOf('/')
            const name = slash === -1 ? path : path.slice(slash + 1)
            const dir = slash === -1 ? '' : path.slice(0, slash)
            return (
              <CommandItem key={path} value={path} onSelect={() => select(path)}>
                <File className="shrink-0 text-muted-foreground" />
                <span className="shrink-0">{name}</span>
                {dir && (
                  <span className="min-w-0 truncate text-xs text-muted-foreground" dir="rtl">
                    {dir}
                  </span>
                )}
              </CommandItem>
            )
          })}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
