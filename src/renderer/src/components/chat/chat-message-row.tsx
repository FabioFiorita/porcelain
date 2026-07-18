import type { ChatMessage } from '@backend/chat-store'
import { fileName } from '@renderer/lib/paths'
import { cn } from '@renderer/lib/utils'

/** Absolute short timestamp for a relay message. Exported so the Coordination panel reuses it. */
export function formatTime(ms: number): string {
  if (ms <= 0) return ''
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/** One relay message chip — compact in the sidebar list, full in the viewer. A message with a
 * file footprint renders as a claim (intent line + file chips + a Claim tag); a `closes`
 * message renders dimmed. */
export function ChatMessageRow({
  message,
  compact = false,
}: {
  message: ChatMessage
  compact?: boolean
}): React.JSX.Element {
  const when = formatTime(message.createdAt)
  const isClaim = message.files !== undefined && message.files.length > 0
  const isClose = message.closes === true && !isClaim
  const line = isClaim && message.intent ? message.intent : message.body
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded-xl border bg-card p-2',
        compact && 'p-1.5',
        isClose && 'opacity-55',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-medium">{message.from}</span>
          {isClaim && (
            <span className="shrink-0 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Claim
            </span>
          )}
        </span>
        {when !== '' && <span className="shrink-0 text-2xs text-muted-foreground/70">{when}</span>}
      </div>
      <p
        className={cn(
          'whitespace-pre-wrap break-words text-xs-minus text-muted-foreground',
          compact ? 'line-clamp-4' : 'max-h-48 overflow-y-auto',
          isClose && 'italic',
        )}
      >
        {isClose ? `closed: ${message.body}` : line}
      </p>
      {isClaim && message.files && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {message.files.map((file) => (
            <span
              key={file}
              title={file}
              className="max-w-full truncate rounded bg-muted px-1 py-0.5 font-mono text-2xs text-muted-foreground"
            >
              {fileName(file)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
