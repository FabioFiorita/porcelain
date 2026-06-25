import type { Diagnostic } from '@main/lsp'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Kbd } from '@renderer/components/ui/kbd'
import { CodeLine, useTokenizedLines } from '@renderer/components/viewer/code-line'
import {
  type HoverAnchor,
  LspHoverCard,
  stripHoverFences,
} from '@renderer/components/viewer/lsp-hover-card'
import { useWriteTextFile } from '@renderer/hooks/use-files'
import {
  useDiagnostics,
  useLspActions,
  useLspDocSync,
  useLspEnabledFor,
} from '@renderer/hooks/use-lsp'
import { languageFor } from '@renderer/lib/highlight'
import { offsetToPosition } from '@renderer/lib/lsp-position'
import { cn } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import {
  ClipboardPaste,
  Compass,
  Copy,
  FileSymlink,
  FolderOpen,
  Link2,
  Scissors,
  Search,
  SquareArrowOutUpRight,
} from 'lucide-react'
import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { usePathActions } from './use-path-actions'

// Above this many lines the viewer falls back to the read-only virtualized
// view — the editor renders every line into the DOM.
export const EDITABLE_MAX_LINES = 5000
const AUTOSAVE_DELAY_MS = 800

// Memoized so a line only re-renders when its own tokens change.
const EditorLine = memo(CodeLine)

// How long the pointer must rest (no movement) before a hover query fires, and the
// throttle between mousemove samples. Tuned so hover feels deliberate, not flickery.
const HOVER_REST_MS = 400
const MOUSEMOVE_THROTTLE_MS = 60
// After a keystroke, suppress hover for this long so it doesn't pop mid-typing.
const HOVER_SUPPRESS_AFTER_EDIT_MS = 600

// The character cell is 1ch wide in the monospace mirror; diagnostic underlines and
// dots are positioned in `ch` units off the line text start.
const severityClass = (severity: Diagnostic['severity']): string =>
  severity === 'error'
    ? 'text-destructive'
    : severity === 'warning'
      ? 'text-amber-500'
      : 'text-muted-foreground'

// Severity rank so the gutter dot reflects the loudest diagnostic on the line.
const SEVERITY_RANK: Record<Diagnostic['severity'], number> = {
  error: 3,
  warning: 2,
  info: 1,
  hint: 0,
}

function worstSeverity(diagnostics: Diagnostic[]): Diagnostic['severity'] {
  let worst = diagnostics[0].severity
  for (const d of diagnostics) {
    if (SEVERITY_RANK[d.severity] > SEVERITY_RANK[worst]) worst = d.severity
  }
  return worst
}

// The mirror line text starts after the w-10 (2.5rem) line-number gutter; underlines
// offset from there so `start` cells line up with the rendered characters.
const GUTTER_REM = 2.5

// Group diagnostics by their START line so each mirror line can render its own
// underlines/dot without scanning the whole array. Multi-line diagnostics anchor to
// their first line — good enough for a subtle underline, and cheap.
function groupByLine(diagnostics: Diagnostic[]): Map<number, Diagnostic[]> {
  const byLine = new Map<number, Diagnostic[]>()
  for (const diagnostic of diagnostics) {
    const list = byLine.get(diagnostic.line)
    if (list) list.push(diagnostic)
    else byLine.set(diagnostic.line, [diagnostic])
  }
  return byLine
}

// The squiggly underlines for one line's diagnostics, positioned over the mirror
// text by character offset. Pointer-events stay off (the parent mirror is
// aria-hidden/pointer-events-none); the message surfaces through the textarea's own
// hover, which is the topmost layer.
const DiagnosticUnderlines = memo(function DiagnosticUnderlines({
  diagnostics,
  lineLength,
}: {
  diagnostics: Diagnostic[]
  lineLength: number
}): React.JSX.Element {
  return (
    <span className="pointer-events-none absolute inset-0">
      {diagnostics.map((d, i) => {
        const start = Math.max(0, d.character)
        // A single-line diagnostic ends at endCharacter; a multi-line one runs to
        // the end of this line. Guarantee at least one cell so a zero-width range
        // (whole-token errors sometimes report start === end) is still visible.
        const end = d.endLine === d.line ? d.endCharacter : lineLength
        const width = Math.max(1, end - start)
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: diagnostics on a line have no stable id
            key={i}
            className={cn('absolute bottom-0', severityClass(d.severity))}
            style={{
              left: `calc(${GUTTER_REM}rem + ${start}ch)`,
              width: `${width}ch`,
              // a wavy text-decoration needs text; emulate the squiggle with a
              // repeating wavy bottom border via background instead
              height: '3px',
              backgroundImage:
                'repeating-linear-gradient(135deg, currentColor 0, currentColor 1px, transparent 1px, transparent 2px)',
              backgroundSize: '4px 3px',
              backgroundRepeat: 'repeat-x',
            }}
          />
        )
      })}
    </span>
  )
})

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
  // Caret position (0-based LSP) captured when the context menu opens, so "Find
  // references" can query the symbol under the cursor on the LSP path.
  const [lspRefPos, setLspRefPos] = useState<{ line: number; character: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lang = languageFor(path)
  const deferredContent = useDeferredValue(content)
  const tokenLines = useTokenizedLines(deferredContent, lang)
  const { findReferences, exploreFlow, copyPath, copyRelativePath, reveal } = usePathActions(path)
  const { save, isSaving, error: saveError } = useWriteTextFile(path)

  // --- LSP: all gated behind `lspEnabled && isLspLang(path)`. When off, every hook
  // below is inert (sync no-ops, diagnostics is [], actions short-circuit) so no LSP
  // request ever fires and none of the listeners do work. -----------------------
  const repo = useRepoStore((s) => s.repo)
  const lspEnabled = useLspEnabledFor(path)
  useLspDocSync(repo?.path, path, content, lspEnabled)
  const diagnostics = useDiagnostics(repo?.path, path, lspEnabled)
  const { hover, definition } = useLspActions(repo?.path, path)

  const diagnosticsByLine = useMemo(() => groupByLine(diagnostics), [diagnostics])
  const [hoverCard, setHoverCard] = useState<{ anchor: HoverAnchor; text: string } | null>(null)
  // Refs drive the hover machinery without re-rendering on every mousemove sample.
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastMoveRef = useRef(0)
  const lastEditAtRef = useRef(0)
  const hoverOffsetRef = useRef<number | null>(null)

  const dismissHover = (): void => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
    hoverOffsetRef.current = null
    setHoverCard((prev) => (prev === null ? prev : null))
  }

  // Caret offset under a viewport point — the textarea is the topmost layer, so the
  // offset is an index into `content`. Returns null off the text or where unsupported.
  const offsetAtPoint = (clientX: number, clientY: number): number | null => {
    const docWithCaret = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
      caretRangeFromPoint?: (x: number, y: number) => Range | null
    }
    if (docWithCaret.caretPositionFromPoint) {
      const caret = docWithCaret.caretPositionFromPoint(clientX, clientY)
      return caret ? caret.offset : null
    }
    const range = docWithCaret.caretRangeFromPoint?.(clientX, clientY)
    return range ? range.startOffset : null
  }

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
    // suppress + dismiss the hover card while the user is actively typing
    lastEditAtRef.current = Date.now()
    dismissHover()
  }

  // flush pending changes when the tab unmounts (close, switch, mode change)
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      saveRef.current()
    }
  }, [])

  // Dismiss the hover card on scroll — its anchor is a frozen viewport point that
  // would otherwise drift away from the token. Only attached when LSP is on, so the
  // off-path adds no listener.
  useEffect(() => {
    if (!lspEnabled) return
    const el = scrollRef.current
    if (!el) return
    const onScroll = (): void => {
      // inline dismissal (not the `dismissHover` closure) so this effect's only
      // dependency is `lspEnabled` and the listener isn't re-subscribed every render
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
      hoverOffsetRef.current = null
      setHoverCard((prev) => (prev === null ? prev : null))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [lspEnabled])

  // Adopt an external rewrite of this file — readFile refetches with new content
  // when the coding agent edits it in the terminal — but ONLY when there's nothing
  // unsaved to lose. Mid-edit, the user's in-progress text wins; we never clobber
  // it. (The read-only/reader views render straight from the prop; only this editor
  // keeps a local copy that needs syncing.) Tracked via a ref so we react to a real
  // prop change, not to our own keystrokes updating `content`.
  const lastInitial = useRef(initialContent)
  useEffect(() => {
    if (initialContent === lastInitial.current) return
    // Only "consume" the external change once we actually adopt it. If we skip
    // because of unsaved edits, leave lastInitial behind so the change is
    // re-evaluated (and adopted) the next time the buffer is clean.
    if (content === savedContent) {
      lastInitial.current = initialContent
      setContent(initialContent)
      setSavedContent(initialContent)
    }
  }, [initialContent, content, savedContent])

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

  // --- LSP hover (throttled mousemove → rest delay → query → anchored card) -----
  const onMouseMove = (e: React.MouseEvent<HTMLTextAreaElement>): void => {
    if (!lspEnabled) return
    const now = Date.now()
    if (now - lastMoveRef.current < MOUSEMOVE_THROTTLE_MS) return
    lastMoveRef.current = now
    // calm, not flickery: never pop while the user is actively typing
    if (now - lastEditAtRef.current < HOVER_SUPPRESS_AFTER_EDIT_MS) {
      dismissHover()
      return
    }
    const offset = offsetAtPoint(e.clientX, e.clientY)
    if (offset === null) {
      dismissHover()
      return
    }
    // moved to a different offset → cancel the pending query + any open card
    if (offset !== hoverOffsetRef.current) {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      setHoverCard((prev) => (prev === null ? prev : null))
      hoverOffsetRef.current = offset
      const point = { x: e.clientX, y: e.clientY }
      hoverTimerRef.current = setTimeout(async () => {
        await runHover(offset, point)
      }, HOVER_REST_MS)
    }
  }

  const runHover = async (offset: number, point: HoverAnchor): Promise<void> => {
    const info = await hover(offsetToPosition(content, offset))
    // bail if the pointer moved off this offset while the request was in flight
    if (hoverOffsetRef.current !== offset) return
    if (!info) return
    const text = stripHoverFences(info.markdown)
    if (text === '') return
    setHoverCard({ anchor: point, text })
  }

  // --- Go to definition (Cmd/Ctrl+click, or the context-menu item) -------------
  const goToDefinition = async (offset: number): Promise<void> => {
    if (!lspEnabled || !repo) return
    const locations = await definition(offsetToPosition(content, offset))
    const target = locations[0]
    if (!target) return
    // SymbolLocation.path is absolute; tabs key file ids on the absolute path
    // (see search-list / use-files), and SymbolLocation.line is 0-based while tabs
    // expect a 1-based line.
    if (!target.path.startsWith(`${repo.path}/`)) {
      toast('Definition is outside the workspace')
      return
    }
    useTabsStore.getState().openTab({
      id: tabId('file', target.path),
      kind: 'file',
      title: target.path.split('/').at(-1) ?? target.path,
      path: target.path,
      line: target.line + 1,
    })
  }

  const onTextareaClick = async (e: React.MouseEvent<HTMLTextAreaElement>): Promise<void> => {
    if (!lspEnabled || !(e.metaKey || e.ctrlKey)) return
    e.preventDefault()
    const offset = offsetAtPoint(e.clientX, e.clientY)
    if (offset !== null) await goToDefinition(offset)
  }

  const dirty = content !== savedContent

  return (
    <ContextMenu
      onOpenChange={(open) => {
        // capture on open: nothing re-renders this component when the user
        // selects text, so reading the selection at render time goes stale
        if (open) {
          setSelection(selectedText())
          // also snapshot the caret as an LSP position so "Find references" can
          // resolve the symbol under the cursor without a text selection
          const offset = textareaRef.current?.selectionStart
          setLspRefPos(offset === undefined ? null : offsetToPosition(content, offset))
        }
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
                {content.split('\n').map((line, i) => {
                  const lineDiagnostics = diagnosticsByLine.get(i)
                  const worst = lineDiagnostics && worstSeverity(lineDiagnostics)
                  return (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: lines have no stable identity
                      key={i}
                      className={cn('relative flex', i + 1 === highlightLine && 'bg-primary/15')}
                    >
                      <span className="flex w-10 shrink-0 select-none items-center justify-end gap-1 pr-3 text-right text-muted-foreground/50">
                        {worst && lineDiagnostics && (
                          <span
                            data-testid="diagnostic-gutter-dot"
                            // the dot lives in the gutter (not pointer-events-none),
                            // so a native title surfaces the message(s) on hover —
                            // the findable fallback to the in-text hover tooltip
                            title={lineDiagnostics.map((d) => d.message).join('\n')}
                            className={cn('size-1.5 rounded-full bg-current', severityClass(worst))}
                          />
                        )}
                        {i + 1}
                      </span>
                      <EditorLine tokens={tokenLines?.[i] ?? null} text={line} />
                      {lineDiagnostics && (
                        <DiagnosticUnderlines
                          diagnostics={lineDiagnostics}
                          lineLength={line.length}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => edit(e.target.value)}
              onKeyDown={(e) => {
                // typing dismisses any open hover card
                if (lspEnabled) dismissHover()
                if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  saveRef.current()
                }
              }}
              onMouseMove={lspEnabled ? onMouseMove : undefined}
              onMouseLeave={lspEnabled ? dismissHover : undefined}
              onClick={lspEnabled ? onTextareaClick : undefined}
              spellCheck={false}
              wrap="off"
              aria-label={`Edit ${path}`}
              className="relative z-10 block min-h-full min-w-full resize-none whitespace-pre bg-transparent py-2 pl-14 pr-4 font-mono text-xs leading-5 text-transparent caret-foreground outline-none field-sizing-content"
            />
          </div>
        </div>
        {saveError ? (
          <span className="pointer-events-none absolute bottom-2 right-3 rounded-md bg-muted/80 px-2 py-0.5 text-2xs text-destructive">
            {saveError.message}
          </span>
        ) : isSaving ? (
          <span className="pointer-events-none absolute bottom-2 right-3 rounded-md bg-muted/80 px-2 py-0.5 text-2xs text-muted-foreground">
            Saving…
          </span>
        ) : dirty ? (
          <span className="pointer-events-none absolute bottom-2 right-3 flex items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5 text-2xs text-muted-foreground">
            Unsaved <Kbd>⌘S</Kbd>
          </span>
        ) : null}
        {lspEnabled && hoverCard && (
          <LspHoverCard anchor={hoverCard.anchor}>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-2xs leading-relaxed">
              {hoverCard.text}
            </pre>
          </LspHoverCard>
        )}
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
        {lspEnabled && (
          <ContextMenuItem
            onClick={async () => {
              // keyboard-friendly path: resolve from the textarea's current caret
              const el = textareaRef.current
              if (el) await goToDefinition(el.selectionStart)
            }}
          >
            <SquareArrowOutUpRight /> Go to definition
          </ContextMenuItem>
        )}
        <ContextMenuItem
          // LSP on: the caret suffices (no text selection needed); LSP off: the
          // heuristic text search needs a selection to query.
          disabled={lspEnabled ? false : selection.trim() === ''}
          onClick={() => {
            if (lspEnabled && lspRefPos) {
              useTabsStore.getState().openTab({
                id: tabId('references', `${path}#${lspRefPos.line}:${lspRefPos.character}`),
                kind: 'references',
                title: 'References',
                path,
                line: lspRefPos.line,
                character: lspRefPos.character,
              })
              return
            }
            findReferences(selection)
          }}
        >
          <Search /> Find references
        </ContextMenuItem>
        <ContextMenuItem disabled={selection.trim() === ''} onClick={() => exploreFlow(selection)}>
          <Compass /> Explore flow from “{selection.trim().slice(0, 24)}”
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
