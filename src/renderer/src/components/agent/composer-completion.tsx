import { Command, CommandGroup, CommandItem, CommandList } from '@renderer/components/ui/command'
import { FileTypeIcon } from '@renderer/components/viewer/file-icon'
import { useAgentCommands } from '@renderer/hooks/use-agents'
import { useFileSearch } from '@renderer/hooks/use-search'
import { dirName, fileName } from '@renderer/lib/paths'
import type { AgentProvider } from '@shared/agent-protocol'
import { useEffect, useRef, useState } from 'react'

/**
 * The composer's inline autocomplete: one popup shared by @-file mentions and leading
 * `/` slash-commands. The controller (`useComposerCompletion`) detects the active token
 * under the caret, fetches candidates from the SAME sources the rest of the app uses
 * (`useFileSearch` for files — the file finder's source — and `useAgentCommands` for the
 * provider's commands), and drives selection from the textarea's own keydown so typing
 * stays 100% normal when nothing is open. Insertion is plain text (all three CLIs read
 * @-paths and /commands from the prompt), so there are no chips.
 */

// A ranked candidate. `insert` is the whole token replacement (leading sigil + trailing
// space); the controller splices it over the detected token range.
export type CompletionItem =
  | { kind: 'file'; value: string; name: string; dir: string; insert: string }
  | { kind: 'command'; value: string; name: string; description?: string; insert: string }

// The token under the caret we're completing. `start`/`end` bound the slice `insert`
// replaces (the file token can extend past the caret; the command token is the leading run).
interface Token {
  kind: 'file' | 'command'
  query: string
  start: number
  end: number
}

const MAX_ROWS = 10

/** The token being completed at `caret`, or null when the caret isn't in a completable spot. */
function detectToken(value: string, caret: number): Token | null {
  // Slash-command: only the message's FIRST token, and only while the caret sits inside it.
  if (value.startsWith('/')) {
    const leading = value.slice(0, caret)
    if (!/\s/.test(leading)) {
      const ws = value.search(/\s/)
      const end = ws === -1 ? value.length : ws
      return { kind: 'command', query: value.slice(1, caret), start: 0, end }
    }
  }
  // @-mention: a token opened by `@` at start/after whitespace, containing the caret.
  const before = value.slice(0, caret)
  const match = before.match(/(?:^|\s)@([^\s]*)$/)
  if (match) {
    const query = match[1]
    const start = caret - query.length - 1
    let end = caret
    while (end < value.length && !/\s/.test(value[end])) end++
    return { kind: 'file', query, start, end }
  }
  return null
}

export function useComposerCompletion({
  value,
  provider,
  textareaRef,
  onChange,
}: {
  value: string
  provider: AgentProvider
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onChange: (next: string) => void
}): {
  open: boolean
  items: CompletionItem[]
  selectedIndex: number
  onSelect: (item: CompletionItem) => void
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean
  onCaretChange: (caret: number) => void
  syncCaret: () => void
} {
  const [caret, setCaret] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const pendingCaret = useRef<number | null>(null)

  const token = detectToken(value, caret)
  const fileQuery = token?.kind === 'file' ? token.query : ''
  const commandQuery = token?.kind === 'command' ? token.query.toLowerCase() : null

  // Files ride the file finder's exact source; commands are already loaded per provider,
  // so we just prefix-filter them client-side (the leading `/` alone lists them all).
  const { results: files } = useFileSearch(fileQuery, token?.kind === 'file')
  const commands = useAgentCommands(provider)

  const items: CompletionItem[] =
    token?.kind === 'file'
      ? files.slice(0, MAX_ROWS).map((result) => ({
          kind: 'file' as const,
          value: `file:${result.path}`,
          name: fileName(result.path),
          dir: dirName(result.path),
          insert: `@${result.path} `,
        }))
      : commandQuery !== null
        ? commands
            .filter((c) => c.name.toLowerCase().startsWith(commandQuery))
            .slice(0, MAX_ROWS)
            .map((c) => ({
              kind: 'command' as const,
              value: `command:${c.name}`,
              name: c.name,
              description: c.description,
              insert: `/${c.name} `,
            }))
        : []

  // Reset the highlight when the candidate set changes under the caret.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on token/list change only
  useEffect(() => {
    setSelectedIndex(0)
  }, [token?.kind, token?.query, items.length])

  // A fresh keystroke re-opens a popup an Escape had dismissed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-arm on every value change
  useEffect(() => {
    setDismissed(false)
  }, [value])

  // Restore the caret after a controlled insertion lands in `value`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire once the inserted value lands
  useEffect(() => {
    const next = pendingCaret.current
    if (next !== null && textareaRef.current) {
      textareaRef.current.setSelectionRange(next, next)
      pendingCaret.current = null
      setCaret(next)
    }
  }, [value, textareaRef])

  const open = token !== null && !dismissed && items.length > 0
  const clampedIndex = Math.min(selectedIndex, Math.max(0, items.length - 1))

  const onSelect = (item: CompletionItem): void => {
    if (!token) return
    const next = value.slice(0, token.start) + item.insert + value.slice(token.end)
    pendingCaret.current = token.start + item.insert.length
    onChange(next)
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!open) return false
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % items.length)
        return true
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + items.length) % items.length)
        return true
      case 'Enter':
        e.preventDefault()
        onSelect(items[clampedIndex])
        return true
      case 'Tab':
        // Shift+Tab stays the composer's Build↔Plan flip; plain Tab completes.
        if (e.shiftKey) return false
        e.preventDefault()
        onSelect(items[clampedIndex])
        return true
      case 'Escape':
        e.preventDefault()
        setDismissed(true)
        return true
      default:
        return false
    }
  }

  const syncCaret = (): void => {
    const el = textareaRef.current
    if (el) setCaret(el.selectionStart ?? 0)
  }

  return {
    open,
    items,
    selectedIndex: clampedIndex,
    onSelect,
    handleKeyDown,
    onCaretChange: setCaret,
    syncCaret,
  }
}

/**
 * The anchored completion list — a fixed popup above the composer input (caret-precise
 * anchoring isn't needed). Presentational: the textarea keeps focus and drives selection,
 * so this reflects `selectedIndex` and reports clicks; it never captures keys itself.
 */
export function ComposerCompletion({
  open,
  items,
  selectedIndex,
  onSelect,
}: {
  open: boolean
  items: CompletionItem[]
  selectedIndex: number
  onSelect: (item: CompletionItem) => void
}): React.JSX.Element | null {
  if (!open || items.length === 0) return null
  const active = items[selectedIndex]
  return (
    <div className="absolute bottom-full left-0 z-20 mb-2 w-full max-w-md overflow-hidden rounded-xl border border-border bg-popover shadow-md">
      <Command shouldFilter={false} value={active?.value}>
        <CommandList className="max-h-60">
          <CommandGroup>
            {items.map((item) => (
              <CommandItem
                key={item.value}
                value={item.value}
                // cmdk fires onSelect on pointer; Enter/Tab are driven by the textarea.
                onSelect={() => onSelect(item)}
              >
                {item.kind === 'file' ? (
                  <>
                    <FileTypeIcon name={item.name} className="shrink-0" />
                    <span className="shrink-0 text-sm-minus">{item.name}</span>
                    {item.dir && (
                      <span className="min-w-0 truncate text-xs text-muted-foreground" dir="rtl">
                        {item.dir}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="shrink-0 text-sm-minus">/{item.name}</span>
                    {item.description && (
                      <span className="min-w-0 truncate text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    )}
                  </>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  )
}
