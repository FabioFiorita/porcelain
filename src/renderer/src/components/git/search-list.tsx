import type { CodeSearchFile, CodeSearchLine } from '@main/diff'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@renderer/components/ui/collapsible'
import { Input } from '@renderer/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@renderer/components/ui/input-group'
import { Toggle } from '@renderer/components/ui/toggle'
import { FileTypeIcon } from '@renderer/components/viewer/file-icon'
import { useCodeSearch } from '@renderer/hooks/use-search'
import { cn } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { useSearchStore } from '@renderer/stores/search'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { CaseSensitive, ChevronRight, Regex, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'

// Bold the literal matches inside a result line. Skipped for regex queries — JS
// regex semantics don't match git's POSIX -E exactly, so we'd risk highlighting
// the wrong span; the tinted match line carries the signal there instead.
function highlight(
  text: string,
  query: string,
  regex: boolean,
  caseSensitive: boolean,
): React.ReactNode {
  const needle = caseSensitive ? query : query.toLowerCase()
  if (regex || needle === '') return text
  const haystack = caseSensitive ? text : text.toLowerCase()
  const parts: React.ReactNode[] = []
  let from = 0
  let at = haystack.indexOf(needle)
  let key = 0
  while (at !== -1) {
    if (at > from) parts.push(<span key={key++}>{text.slice(from, at)}</span>)
    parts.push(
      <mark
        key={key++}
        className="rounded-[2px] bg-(--selected-fill) font-semibold text-foreground"
      >
        {text.slice(at, at + needle.length)}
      </mark>,
    )
    from = at + needle.length
    at = haystack.indexOf(needle, from)
  }
  if (parts.length === 0) return text
  if (from < text.length) parts.push(<span key={key++}>{text.slice(from)}</span>)
  return parts
}

/** Common leading-whitespace width to strip so a hunk reads as one tidy block. */
function commonIndent(lines: CodeSearchLine[]): number {
  let min = Number.POSITIVE_INFINITY
  for (const ln of lines) {
    if (ln.text.trim() === '') continue
    min = Math.min(min, ln.text.length - ln.text.trimStart().length)
  }
  return Number.isFinite(min) ? min : 0
}

function FileGroup({
  file,
  repoPath,
  query,
  regex,
  caseSensitive,
}: {
  file: CodeSearchFile
  repoPath: string
  query: string
  regex: boolean
  caseSensitive: boolean
}): React.JSX.Element {
  const openTab = useTabsStore((s) => s.openTab)
  const name = file.path.split('/').at(-1) ?? file.path
  const dir = file.path.split('/').slice(0, -1).join('/')

  const open = (line: number): void => {
    const absolute = `${repoPath}/${file.path}`
    openTab({ id: tabId('file', absolute), kind: 'file', title: name, path: absolute, line })
  }

  return (
    <Collapsible
      defaultOpen
      className="group/sf [&[data-state=open]>button>svg:first-child]:rotate-90"
    >
      <CollapsibleTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-(--hover-fill)"
          >
            <ChevronRight className="size-3 shrink-0 text-muted-foreground transition-transform" />
            <FileTypeIcon name={name} className="size-3.5 shrink-0" />
            <span className="shrink-0 truncate text-[13px]">{name}</span>
            {dir && (
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" dir="rtl">
                {dir}
              </span>
            )}
            <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
              {file.matchCount}
            </span>
          </button>
        }
      />
      <CollapsibleContent>
        <div className="flex flex-col pb-1">
          {file.hunks.map((hunk, h) => {
            const indent = commonIndent(hunk.lines)
            return (
              <div
                key={hunk.lines[0]?.line ?? h}
                className={cn(h > 0 && 'mt-0.5 border-t border-border/40 pt-0.5')}
              >
                {hunk.lines.map((ln) => (
                  <button
                    key={ln.line}
                    type="button"
                    onClick={() => open(ln.line)}
                    className={cn(
                      'flex w-full items-baseline gap-2 px-2 py-px text-left font-mono text-xs hover:bg-(--hover-fill)',
                      ln.match ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <span className="w-9 shrink-0 select-none text-right text-[10px] text-muted-foreground/50 tabular-nums">
                      {ln.line}
                    </span>
                    <span className="min-w-0 flex-1 overflow-hidden whitespace-pre">
                      {highlight(ln.text.slice(indent), query, regex, caseSensitive)}
                    </span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Repo-wide code search: literal/regex with case + include/exclude globs, grouped
 *  by file with context. Rows open the file at the line. Sibling to the ⌘⇧F overlay. */
export function SearchList(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const query = useSearchStore((s) => s.query)
  const regex = useSearchStore((s) => s.regex)
  const caseSensitive = useSearchStore((s) => s.caseSensitive)
  const showFilters = useSearchStore((s) => s.showFilters)
  const include = useSearchStore((s) => s.include)
  const exclude = useSearchStore((s) => s.exclude)
  const setQuery = useSearchStore((s) => s.setQuery)
  const toggleRegex = useSearchStore((s) => s.toggleRegex)
  const toggleCaseSensitive = useSearchStore((s) => s.toggleCaseSensitive)
  const toggleFilters = useSearchStore((s) => s.toggleFilters)
  const setInclude = useSearchStore((s) => s.setInclude)
  const setExclude = useSearchStore((s) => s.setExclude)
  const remember = useSearchStore((s) => s.remember)

  // Debounce the whole option set so each IPC round-trip searches a settled query.
  const [debounced, setDebounced] = useState({ query, regex, caseSensitive, include, exclude })
  useEffect(() => {
    const timer = setTimeout(
      () => setDebounced({ query, regex, caseSensitive, include, exclude }),
      150,
    )
    return () => clearTimeout(timer)
  }, [query, regex, caseSensitive, include, exclude])

  const { result, error, isFetching } = useCodeSearch(debounced)
  const settled =
    debounced.query === query &&
    debounced.regex === regex &&
    debounced.caseSensitive === caseSensitive &&
    debounced.include === include &&
    debounced.exclude === exclude
  const searching = isFetching || !settled

  // Record a query in the recents once it settles and actually finds something.
  useEffect(() => {
    if (debounced.query.trim() !== '' && result && result.files.length > 0) {
      remember(debounced.query)
    }
  }, [result, debounced.query, remember])

  const totalMatches = result?.files.reduce((n, f) => n + f.matchCount, 0) ?? 0

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col gap-1.5 px-2 pt-1">
        <InputGroup className="h-8">
          <InputGroupInput
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="text-[13px]"
          />
          <InputGroupAddon align="inline-end" className="gap-0.5 text-muted-foreground">
            <Toggle
              aria-label="Match case"
              pressed={caseSensitive}
              onPressedChange={toggleCaseSensitive}
              className="size-6 min-w-6 p-0"
            >
              <CaseSensitive />
            </Toggle>
            <Toggle
              aria-label="Use regular expression"
              pressed={regex}
              onPressedChange={toggleRegex}
              className="size-6 min-w-6 p-0"
            >
              <Regex />
            </Toggle>
            <Toggle
              aria-label="Toggle search filters"
              pressed={showFilters}
              onPressedChange={toggleFilters}
              className="size-6 min-w-6 p-0"
            >
              <SlidersHorizontal />
            </Toggle>
          </InputGroupAddon>
        </InputGroup>
        <Collapsible open={showFilters}>
          <CollapsibleContent className="flex flex-col gap-1.5 pt-0.5">
            <Input
              placeholder="files to include (e.g. src/**, *.ts)"
              value={include}
              onChange={(e) => setInclude(e.target.value)}
              className="h-7 text-xs"
            />
            <Input
              placeholder="files to exclude"
              value={exclude}
              onChange={(e) => setExclude(e.target.value)}
              className="h-7 text-xs"
            />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {error ? (
        <p className="px-3 py-2 text-xs break-words text-destructive">{error.message}</p>
      ) : query.trim() === '' ? (
        <p className="px-3 py-2 text-[13px] text-muted-foreground">
          Search the repository for text or a regular expression.
        </p>
      ) : !result || result.files.length === 0 ? (
        <p className="px-3 py-2 text-[13px] text-muted-foreground">
          {searching ? 'Searching…' : 'No results'}
        </p>
      ) : (
        <div className="flex flex-col">
          <p className="px-3 pb-1 text-xs text-muted-foreground">
            {totalMatches} {totalMatches === 1 ? 'result' : 'results'} in {result.files.length}{' '}
            {result.files.length === 1 ? 'file' : 'files'}
            {result.truncated && ' · showing the first matches, refine to narrow'}
          </p>
          {result.files.map((file) => (
            <FileGroup
              key={file.path}
              file={file}
              repoPath={repo?.path ?? ''}
              query={debounced.query}
              regex={debounced.regex}
              caseSensitive={debounced.caseSensitive}
            />
          ))}
        </div>
      )}
    </div>
  )
}
