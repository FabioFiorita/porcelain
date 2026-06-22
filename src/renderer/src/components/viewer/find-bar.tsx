import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

export function FindBar({
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
    <div className="absolute right-3 top-3 z-30 flex items-center gap-1 rounded-lg border bg-popover/95 px-2 py-1 shadow-lg backdrop-blur-xl">
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
      <span className="shrink-0 text-2xs text-muted-foreground tabular-nums">
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
