import logo from '@renderer/assets/logo.png'
import { CommitView } from '@renderer/components/git/commit-view'
import { DiffView } from '@renderer/components/git/diff-view'
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Input } from '@renderer/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { CodeLine, useHighlighter } from '@renderer/components/viewer/code-line'
import { isMarkdownPath, MarkdownView } from '@renderer/components/viewer/markdown-view'
import { SearchView } from '@renderer/components/viewer/search-view'
import { VirtualRows } from '@renderer/components/viewer/virtual-rows'
import { languageFor } from '@renderer/lib/highlight'
import { trpc } from '@renderer/lib/trpc'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useTabsStore } from '@renderer/stores/tabs'
import {
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Copy,
  FileSymlink,
  FolderOpen,
  Link2,
  Pencil,
  Save,
  Scissors,
  Search,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

function relativeTo(repoPath: string | undefined, path: string): string {
  return repoPath && path.startsWith(`${repoPath}/`) ? path.slice(repoPath.length + 1) : path
}

function usePathActions(path: string): {
  copyPath: () => void
  copyRelativePath: () => void
  reveal: () => void
  findReferences: (text: string) => void
} {
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const revealMutation = trpc.revealInFinder.useMutation()

  return {
    copyPath: () => {
      navigator.clipboard.writeText(path)
    },
    copyRelativePath: () => {
      navigator.clipboard.writeText(relativeTo(repo?.path, path))
    },
    reveal: () => revealMutation.mutate(path),
    findReferences: (text) => {
      const query = text.trim()
      if (query === '') return
      openTab({ id: `search:${query}`, kind: 'search', title: query, path: query })
    },
  }
}

function SourceContextMenu({
  path,
  children,
}: {
  path: string
  children: React.ReactNode
}): React.JSX.Element {
  const [selection, setSelection] = useState('')
  const { copyPath, copyRelativePath, reveal, findReferences } = usePathActions(path)

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) setSelection(window.getSelection()?.toString() ?? '')
      }}
    >
      {/* the ui trigger defaults to select-none; the viewer must stay selectable */}
      <ContextMenuTrigger className="block h-full select-text">{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {selection !== '' ? (
          <>
            <ContextMenuItem onClick={() => navigator.clipboard.writeText(selection)}>
              <Copy /> Copy
            </ContextMenuItem>
            <ContextMenuItem
              disabled={selection.trim() === ''}
              onClick={() => findReferences(selection)}
            >
              <Search /> Find references
            </ContextMenuItem>
          </>
        ) : (
          <>
            <ContextMenuItem onClick={copyPath}>
              <Link2 /> Copy path
            </ContextMenuItem>
            <ContextMenuItem onClick={copyRelativePath}>
              <FileSymlink /> Copy relative path
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={reveal}>
              <FolderOpen /> Reveal in Finder
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}

function SourceView({
  path,
  content,
  highlightLine,
}: {
  path: string
  content: string
  highlightLine?: number
}): React.JSX.Element {
  const highlighter = useHighlighter()
  const lang = languageFor(path)
  const lines = content.split('\n')

  return (
    <VirtualRows
      rows={lines}
      className="px-4 py-2 leading-5"
      scrollToLine={highlightLine}
      renderRow={(line, i) => (
        <div className={cn('flex', i + 1 === highlightLine && 'bg-primary/15')}>
          <span className="w-10 shrink-0 select-none pr-3 text-right text-muted-foreground/50">
            {i + 1}
          </span>
          <CodeLine text={line} lang={lang} highlighter={highlighter} />
        </div>
      )}
    />
  )
}

function FindBar({
  content,
  onClose,
  onMatchLine,
}: {
  content: string
  onClose: () => void
  onMatchLine: (line: number | undefined) => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [step, setStep] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const matches = useMemo(() => {
    const q = query.toLowerCase()
    if (q === '') return []
    const lines: number[] = []
    content.split('\n').forEach((text, i) => {
      if (text.toLowerCase().includes(q)) lines.push(i + 1)
    })
    return lines
  }, [content, query])

  const position =
    matches.length === 0 ? 0 : ((step % matches.length) + matches.length) % matches.length
  const current = matches.length === 0 ? undefined : matches[position]

  useEffect(() => {
    onMatchLine(current)
  }, [current, onMatchLine])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b px-3">
      <Search className="size-3.5 shrink-0 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setStep(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          if (e.key === 'Enter') setStep((s) => s + (e.shiftKey ? -1 : 1))
        }}
        placeholder="Find in file…"
        aria-label="Find in file"
        className="h-6 max-w-64 border-none bg-transparent text-xs shadow-none focus-visible:ring-0"
      />
      <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
        {query === ''
          ? ''
          : matches.length === 0
            ? 'No results'
            : `${position + 1}/${matches.length}`}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-6"
        disabled={matches.length === 0}
        onClick={() => setStep((s) => s - 1)}
        aria-label="Previous match"
      >
        <ChevronUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-6"
        disabled={matches.length === 0}
        onClick={() => setStep((s) => s + 1)}
        aria-label="Next match"
      >
        <ChevronDown />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-6"
        onClick={onClose}
        aria-label="Close find bar"
      >
        <X />
      </Button>
    </div>
  )
}

function MarkdownModeToggle(): React.JSX.Element {
  const markdownMode = usePreferencesStore((s) => s.markdownMode)
  const setMarkdownMode = usePreferencesStore((s) => s.setMarkdownMode)

  return (
    <ToggleGroup
      value={[markdownMode]}
      onValueChange={(value: string[]) => {
        const mode = value[0]
        if (mode === 'reader' || mode === 'source') setMarkdownMode(mode)
      }}
    >
      <ToggleGroupItem value="reader" size="sm">
        Reader
      </ToggleGroupItem>
      <ToggleGroupItem value="source" size="sm">
        Source
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

function FileEditor({
  path,
  initialContent,
  onClose,
}: {
  path: string
  initialContent: string
  onClose: () => void
}): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const [content, setContent] = useState(initialContent)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveMutation = trpc.writeTextFile.useMutation({
    onSuccess: async () => {
      // the edit changes git state too, not just the file
      await Promise.all([
        utils.readFile.invalidate(path),
        utils.gitFlow.invalidate(),
        utils.gitDiffFile.invalidate(),
      ])
      onClose()
    },
  })

  const save = (): void => {
    if (saveMutation.isLoading) return
    saveMutation.mutate({ path, content })
  }

  const insertAtCursor = (text: string): void => {
    const el = textareaRef.current
    if (!el) return
    const { selectionStart, selectionEnd, value } = el
    setContent(value.slice(0, selectionStart) + text + value.slice(selectionEnd))
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = selectionStart + text.length
    })
  }

  const selectedText = (): string => {
    const el = textareaRef.current
    if (!el) return ''
    return el.value.slice(el.selectionStart, el.selectionEnd)
  }

  const paste = async (): Promise<void> => {
    insertAtCursor(await navigator.clipboard.readText())
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 items-center justify-between gap-2 border-b px-3">
        <span className="truncate font-mono text-xs text-muted-foreground">
          {relativeTo(repo?.path, path)} — editing
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saveMutation.isLoading}>
            <X /> Cancel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={save}
            disabled={saveMutation.isLoading || content === initialContent}
          >
            <Save /> {saveMutation.isLoading ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      {saveMutation.error && (
        <p className="border-b px-3 py-1 text-xs text-destructive">{saveMutation.error.message}</p>
      )}
      <ContextMenu>
        <ContextMenuTrigger className="block min-h-0 flex-1 select-text">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                save()
              }
              if (e.key === 'Escape') onClose()
            }}
            spellCheck={false}
            aria-label={`Edit ${path}`}
            className="size-full resize-none bg-transparent px-4 py-2 font-mono text-xs leading-5 outline-none"
          />
        </ContextMenuTrigger>
        <ContextMenuContent className="w-44">
          <ContextMenuItem
            onClick={async () => {
              await navigator.clipboard.writeText(selectedText())
              insertAtCursor('')
            }}
          >
            <Scissors /> Cut
          </ContextMenuItem>
          <ContextMenuItem onClick={() => navigator.clipboard.writeText(selectedText())}>
            <Copy /> Copy
          </ContextMenuItem>
          <ContextMenuItem onClick={() => paste()}>
            <ClipboardPaste /> Paste
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}

function TextFileView({
  path,
  content,
  line,
}: {
  path: string
  content: string
  line?: number
}): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const markdownMode = usePreferencesStore((s) => s.markdownMode)
  const [editing, setEditing] = useState(false)
  const [finding, setFinding] = useState(false)
  const [findLine, setFindLine] = useState<number | undefined>(undefined)
  const markdown = isMarkdownPath(path)
  const reader = markdown && markdownMode === 'reader'

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'f' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        setFinding(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (editing) {
    return <FileEditor path={path} initialContent={content} onClose={() => setEditing(false)} />
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 items-center justify-between gap-2 border-b px-3">
        <span className="truncate font-mono text-xs text-muted-foreground">
          {relativeTo(repo?.path, path)}
        </span>
        <div className="flex items-center gap-1">
          {markdown && <MarkdownModeToggle />}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              useTabsStore.getState().pinTab(path)
              setEditing(true)
            }}
            aria-label="Edit file"
          >
            <Pencil />
          </Button>
        </div>
      </div>
      {finding && !reader && (
        <FindBar content={content} onClose={() => setFinding(false)} onMatchLine={setFindLine} />
      )}
      <div className="min-h-0 flex-1">
        <SourceContextMenu path={path}>
          {reader ? (
            <MarkdownView content={content} />
          ) : (
            <SourceView
              path={path}
              content={content}
              highlightLine={finding && findLine !== undefined ? findLine : line}
            />
          )}
        </SourceContextMenu>
      </div>
    </div>
  )
}

function FileContent({ path, line }: { path: string; line?: number }): React.JSX.Element {
  const { data: view, error } = trpc.readFile.useQuery(path)

  if (error) {
    return <p className="p-4 text-sm text-destructive">{error.message}</p>
  }
  if (view === undefined) {
    return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  }

  if (view.type === 'image') {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <img src={view.dataUrl} alt={path} className="max-h-full max-w-full object-contain" />
      </div>
    )
  }

  if (view.type === 'binary') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Binary file · {(view.size / 1024).toFixed(1)} KB
      </div>
    )
  }

  if (view.type === 'too-large') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        File too large to preview · {(view.size / (1024 * 1024)).toFixed(1)} MB
      </div>
    )
  }

  return <TextFileView path={path} content={view.content} line={line} />
}

export function Viewer(): React.JSX.Element {
  const activeTab = useTabsStore((s) => s.tabs.find((t) => t.id === s.activeTabId))

  if (!activeTab) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
        <img src={logo} alt="" className="size-16 opacity-80" draggable={false} />
        <p className="mt-2 text-lg font-medium">porcelain</p>
        <p className="text-sm">Review changes as a story</p>
        <p className="mt-3 text-xs">Open a file from the sidebar to view it</p>
      </div>
    )
  }

  if (activeTab.kind === 'diff') {
    return <DiffView filePath={activeTab.path} />
  }

  if (activeTab.kind === 'commit') {
    return <CommitView hash={activeTab.path} />
  }

  if (activeTab.kind === 'search') {
    return <SearchView query={activeTab.path} />
  }

  // keyed by path so edit state never leaks across tab switches
  return <FileContent key={activeTab.path} path={activeTab.path} line={activeTab.line} />
}
