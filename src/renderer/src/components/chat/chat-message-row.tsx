import type { ChatMessage } from '@backend/chat-store'
import { cn } from '@renderer/lib/utils'

function formatTime(ms: number): string {
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

/** One relay message chip — compact in the sidebar list, full in the viewer. */
export function ChatMessageRow({
  message,
  compact = false,
}: {
  message: ChatMessage
  compact?: boolean
}): React.JSX.Element {
  const when = formatTime(message.createdAt)
  return (
    <div className={cn('flex flex-col gap-0.5 rounded-xl border bg-card p-2', compact && 'p-1.5')}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-medium">{message.from}</span>
        {when !== '' && <span className="shrink-0 text-2xs text-muted-foreground/70">{when}</span>}
      </div>
      <p
        className={cn(
          'whitespace-pre-wrap break-words text-xs-minus text-muted-foreground',
          compact ? 'line-clamp-4' : 'max-h-48 overflow-y-auto',
        )}
      >
        {message.body}
      </p>
    </div>
  )
}
