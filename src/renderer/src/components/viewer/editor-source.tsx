import type { ReviewComment } from '@backend/comment-store'
import { CommentMarker } from '@renderer/components/git/comment-marker'
import { Badge } from '@renderer/components/ui/badge'
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
import { ROW_HEIGHT } from '@renderer/components/viewer/virtual-rows'
import { useWriteTextFile } from '@renderer/hooks/use-files'
import { languageFor } from '@renderer/lib/highlight'
import { kbdLabel } from '@renderer/lib/keyboard'
import { lineRangeFromOffsets } from '@renderer/lib/line-selection'
import { cn, copyText } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import {
  ClipboardPaste,
  Compass,
  Copy,
  FileSymlink,
  FolderOpen,
  Link2,
  MessageSquarePlus,
  Scissors,
  Search,
} from 'lucide-react'
import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { type CommentAnchor, CommentComposer } from '../git/comment-composer'
import { usePathActions } from './use-path-actions'

// Above this many lines the viewer falls back to the read-only virtualized
// view — the editor renders every line into the DOM.
export const EDITABLE_MAX_LINES = 5000
const AUTOSAVE_DELAY_MS = 800

// The floating save-status pill in the editor's bottom-right — a borderless Badge
// on the muted surface; each state supplies only its own text color.
const STATUS_PILL =
  'pointer-events-none absolute bottom-2 right-3 rounded-md border-transparent bg-muted/80 text-2xs'

// Memoized so a line only re-renders when its own tokens change.
const EditorLine = memo(CodeLine)

// The editor mirror is padded `py-2` (8px) above the first line; each line is
// ROW_HEIGHT tall (leading-5), so line N's top is PADDING_TOP + (N-1)*ROW_HEIGHT. The
// clickable marker overlay reuses this to sit each glyph on its line.
const PADDING_TOP = 8

export function EditorSource({
  path,
  initialContent,
  highlightLine,
  commentsByLine,
}: {
  path: string
  initialContent: string
  highlightLine?: number
  commentsByLine?: Map<number, ReviewComment[]>
}): React.JSX.Element {
  const [content, setContent] = useState(initialContent)
  const [savedContent, setSavedContent] = useState(initialContent)
  const [selection, setSelection] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null)
  const [lineRange, setLineRange] = useState<{ startLine: number; endLine: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lang = languageFor(path)
  const deferredContent = useDeferredValue(content)
  const tokenLines = useTokenizedLines(deferredContent, lang)
  const { findReferences, exploreFlow, copyPath, copyRelativePath, reveal } = usePathActions(path)
  const { save, isSaving, error: saveError } = useWriteTextFile(path)
  const repo = useRepoStore((s) => s.repo)

  // Comments store repo-relative paths; the viewer holds an absolute one.
  const relativePath =
    repo && path.startsWith(`${repo.path}/`) ? path.slice(repo.path.length + 1) : path

  // While the composer is open on a range in this file, tint those lines so the anchor
  // stays visible after the dialog steals focus (killing the DOM selection).
  const pendingLines = useMemo(() => {
    if (!commentAnchor || commentAnchor.startLine === undefined) return null
    const lines = new Set<number>()
    const end = commentAnchor.endLine ?? commentAnchor.startLine
    for (let line = commentAnchor.startLine; line <= end; line++) lines.add(line)
    return lines
  }, [commentAnchor])

  // While the context menu is open on a selection, tint those lines too — the menu
  // takes focus (killing the DOM selection), so this keeps what's selected visible.
  // Gate on a non-empty selection: lineRange is also set for a collapsed cursor, and
  // a plain right-click must not tint the cursor line.
  const menuLines = useMemo(() => {
    if (!menuOpen || selection === '' || !lineRange) return null
    const lines = new Set<number>()
    for (let line = lineRange.startLine; line <= lineRange.endLine; line++) lines.add(line)
    return lines
  }, [menuOpen, selection, lineRange])

  const saveRef = useRef<() => void>(() => {})
  saveRef.current = (): void => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (content === savedContent) return
    // Advance the watermark only once the write settles, pinned to the snapshot
    // we sent (the user may keep typing — that newer text must stay dirty). A
    // failed save leaves the watermark behind, so the buffer stays dirty: the
    // unmount flush retries and the external-adopt effect refuses to clobber.
    const snapshot = content
    save(snapshot, () => setSavedContent(snapshot))
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
    // readText has no insecure-context polyfill (tailnet browser client). When it's
    // absent, no-op: the browser's native paste event still delivers the text and
    // Cmd/Ctrl+V keeps working — only this context-menu Paste item goes quiet.
    if (!navigator.clipboard?.readText) return
    insertAtCursor(await navigator.clipboard.readText())
  }

  const dirty = content !== savedContent

  return (
    <>
      <ContextMenu
        onOpenChange={(open) => {
          // capture on open: nothing re-renders this component when the user
          // selects text, so reading the selection at render time goes stale
          setMenuOpen(open)
          if (open) {
            setSelection(selectedText())
            const el = textareaRef.current
            setLineRange(
              el ? lineRangeFromOffsets(el.value, el.selectionStart, el.selectionEnd) : null,
            )
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
                    const ln = i + 1
                    const pending =
                      (pendingLines?.has(ln) ?? false) || (menuLines?.has(ln) ?? false)
                    const open =
                      !pending && (commentsByLine?.get(ln)?.some((c) => !c.resolved) ?? false)
                    return (
                      <div
                        // biome-ignore lint/suspicious/noArrayIndexKey: lines have no stable identity
                        key={i}
                        className={cn(
                          'flex',
                          (ln === highlightLine || pending) && 'bg-primary/15',
                          open && 'bg-accent',
                        )}
                      >
                        <span className="w-10 shrink-0 select-none pr-3 text-right text-muted-foreground/50">
                          {ln}
                        </span>
                        <EditorLine tokens={tokenLines?.[i] ?? null} text={line} />
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* Clickable comment glyphs, above the transparent textarea (z-10) so the
                popover opens on click; the layer is pass-through except the glyphs, so
                typing elsewhere is unaffected. Positioned per line, not virtualized (the
                editor already renders every line). */}
              {commentsByLine && commentsByLine.size > 0 && (
                <div className="pointer-events-none absolute inset-0 z-20 font-mono text-xs leading-5">
                  {[...commentsByLine.entries()].map(([ln, comments]) => (
                    <div
                      key={ln}
                      className="pointer-events-auto absolute left-1 flex h-5 items-center"
                      style={{ top: PADDING_TOP + (ln - 1) * ROW_HEIGHT }}
                    >
                      <CommentMarker comments={comments} />
                    </div>
                  ))}
                </div>
              )}
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
            <Badge variant="outline" className={cn(STATUS_PILL, 'text-destructive')}>
              {saveError.message}
            </Badge>
          ) : isSaving ? (
            <Badge variant="outline" className={cn(STATUS_PILL, 'text-muted-foreground')}>
              Saving…
            </Badge>
          ) : dirty ? (
            <Badge variant="outline" className={cn(STATUS_PILL, 'text-muted-foreground')}>
              Unsaved <Kbd className="[@media(hover:none)]:hidden">{kbdLabel('mod', 'S')}</Kbd>
            </Badge>
          ) : null}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-60">
          <ContextMenuItem
            disabled={selection === ''}
            onClick={async () => {
              await copyText(selection)
              insertAtCursor('')
            }}
          >
            <Scissors /> Cut
            <ContextMenuShortcut>
              <Kbd>{kbdLabel('mod', 'X')}</Kbd>
            </ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem disabled={selection === ''} onClick={() => copyText(selection)}>
            <Copy /> Copy
            <ContextMenuShortcut>
              <Kbd>{kbdLabel('mod', 'C')}</Kbd>
            </ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => paste()}>
            <ClipboardPaste /> Paste
            <ContextMenuShortcut>
              <Kbd>{kbdLabel('mod', 'V')}</Kbd>
            </ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            disabled={selection.trim() === ''}
            onClick={() => findReferences(selection)}
          >
            <Search /> Find references
          </ContextMenuItem>
          <ContextMenuItem
            disabled={selection.trim() === ''}
            onClick={() => exploreFlow(selection)}
          >
            <Compass /> Explore flow from “{selection.trim().slice(0, 24)}”
          </ContextMenuItem>
          <ContextMenuItem
            disabled={selection === ''}
            onClick={() => {
              if (!lineRange) return
              setCommentAnchor({
                path: relativePath,
                startLine: lineRange.startLine,
                endLine: lineRange.endLine,
                anchorText: selection.slice(0, 2000),
              })
            }}
          >
            <MessageSquarePlus /> Add comment
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => setCommentAnchor({ path: relativePath })}>
            <MessageSquarePlus /> Comment on file
          </ContextMenuItem>
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
      <CommentComposer
        anchor={commentAnchor}
        open={commentAnchor !== null}
        onOpenChange={(open) => {
          if (!open) setCommentAnchor(null)
        }}
      />
    </>
  )
}
