import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Kbd } from '@renderer/components/ui/kbd'
import { CodeLine, useHighlighter } from '@renderer/components/viewer/code-line'
import { useWriteTextFile } from '@renderer/hooks/use-files'
import { languageFor } from '@renderer/lib/highlight'
import { cn } from '@renderer/lib/utils'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import {
  ClipboardPaste,
  Copy,
  FileSymlink,
  FolderOpen,
  Link2,
  Scissors,
  Search,
} from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import { usePathActions } from './use-path-actions'

// Above this many lines the viewer falls back to the read-only virtualized
// view — the editor renders every line into the DOM.
export const EDITABLE_MAX_LINES = 5000
const AUTOSAVE_DELAY_MS = 800

// Memoized so a keystroke only re-tokenizes the lines that actually changed.
const EditorLine = memo(CodeLine)

export function EditorSource({
  path,
  initialContent,
  highlightLine,
}: {
  path: string
  initialContent: string
  highlightLine?: number
}): React.JSX.Element {
  const [content, setContent] = useState(initialContent)
  const [savedContent, setSavedContent] = useState(initialContent)
  const [selection, setSelection] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const highlighter = useHighlighter()
  const lang = languageFor(path)
  const { findReferences, copyPath, copyRelativePath, reveal } = usePathActions(path)
  const { save, isSaving, error: saveError } = useWriteTextFile(path)

  const saveRef = useRef<() => void>(() => {})
  saveRef.current = (): void => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (content === savedContent) return
    setSavedContent(content)
    save(content)
  }

  const edit = (next: string): void => {
    setContent(next)
    // an edited preview tab must not be silently replaced
    useTabsStore.getState().pinTab(tabId('file', path))
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => saveRef.current(), AUTOSAVE_DELAY_MS)
  }

  // flush pending changes when the tab unmounts (close, switch, mode change)
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      saveRef.current()
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || highlightLine === undefined) return
    el.scrollTop = Math.max(0, (highlightLine - 1) * 20 - el.clientHeight / 2 + 10)
  }, [highlightLine])

  const insertAtCursor = (text: string): void => {
    const el = textareaRef.current
    if (!el) return
    const { selectionStart, selectionEnd, value } = el
    edit(value.slice(0, selectionStart) + text + value.slice(selectionEnd))
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

  const dirty = content !== savedContent

  return (
    <ContextMenu
      onOpenChange={(open) => {
        // capture on open: nothing re-renders this component when the user
        // selects text, so reading the selection at render time goes stale
        if (open) setSelection(selectedText())
      }}
    >
      <ContextMenuTrigger className="relative block h-full select-text overflow-hidden">
        {/* ONE scroll container holds both layers, so the native selection can
            never drift from the highlighted text. (The old design scrolled the
            textarea and its mirror separately and synced them in JS — that lag
            put selection boxes over the wrong lines after a scroll.) The
            textarea sizes to its content via field-sizing, so the container —
            not the textarea — owns the single scroll for both layers. */}
        <div ref={scrollRef} className="h-full overflow-auto">
          <div className="relative min-h-full w-max min-w-full">
            {/* Highlighted mirror; the textarea on top has transparent text so
                the native caret/selection sit over these colors. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 px-4 py-2 font-mono text-xs leading-5"
            >
              <div className="w-max min-w-full">
                {content.split('\n').map((line, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: lines have no stable identity
                  <div key={i} className={cn('flex', i + 1 === highlightLine && 'bg-primary/15')}>
                    <span className="w-10 shrink-0 select-none pr-3 text-right text-muted-foreground/50">
                      {i + 1}
                    </span>
                    <EditorLine text={line} lang={lang} highlighter={highlighter} />
                  </div>
                ))}
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => edit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  saveRef.current()
                }
              }}
              spellCheck={false}
              wrap="off"
              aria-label={`Edit ${path}`}
              className="relative z-10 block min-h-full min-w-full resize-none whitespace-pre bg-transparent py-2 pl-14 pr-4 font-mono text-xs leading-5 text-transparent caret-foreground outline-none field-sizing-content"
            />
          </div>
        </div>
        {saveError ? (
          <span className="pointer-events-none absolute bottom-2 right-3 rounded-md bg-muted/80 px-2 py-0.5 text-[10px] text-destructive">
            {saveError.message}
          </span>
        ) : isSaving ? (
          <span className="pointer-events-none absolute bottom-2 right-3 rounded-md bg-muted/80 px-2 py-0.5 text-[10px] text-muted-foreground">
            Saving…
          </span>
        ) : dirty ? (
          <span className="pointer-events-none absolute bottom-2 right-3 flex items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5 text-[10px] text-muted-foreground">
            Unsaved <Kbd>⌘S</Kbd>
          </span>
        ) : null}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuItem
          disabled={selection === ''}
          onClick={async () => {
            await navigator.clipboard.writeText(selection)
            insertAtCursor('')
          }}
        >
          <Scissors /> Cut
          <ContextMenuShortcut>
            <Kbd>⌘X</Kbd>
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={selection === ''}
          onClick={() => navigator.clipboard.writeText(selection)}
        >
          <Copy /> Copy
          <ContextMenuShortcut>
            <Kbd>⌘C</Kbd>
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => paste()}>
          <ClipboardPaste /> Paste
          <ContextMenuShortcut>
            <Kbd>⌘V</Kbd>
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={selection.trim() === ''}
          onClick={() => findReferences(selection)}
        >
          <Search /> Find references
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={copyPath}>
          <Link2 /> Copy path
        </ContextMenuItem>
        <ContextMenuItem onClick={copyRelativePath}>
          <FileSymlink /> Copy relative path
        </ContextMenuItem>
        <ContextMenuItem onClick={reveal}>
          <FolderOpen /> Reveal in Finder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
