import { Button } from '@renderer/components/ui/button'
import { useChatActions, useChatMessages } from '@renderer/hooks/use-chat'
import { compactButtonClass } from '@renderer/lib/controls'
import { useEffect, useRef } from 'react'
import { ChatComposer } from './chat-composer'
import { ChatMessageRow } from './chat-message-row'

/** Full agent-chat thread in the viewer. */
export function ChatView(): React.JSX.Element {
  const { messages, error } = useChatMessages()
  const { clear } = useChatActions()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll when the thread grows; bottomRef is stable so the linter thinks deps
  // are unused, but lastId is the intentional trigger.
  const lastId = messages.at(-1)?.id
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new last message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [lastId])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="max-w-md text-center text-sm text-destructive">
          Couldn&apos;t load chat. {error}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">Agent chat</p>
          <p className="text-xs text-muted-foreground">
            Relay for agents across environments (e.g. Mac simulator ↔ Linux remote).
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={compactButtonClass}
          disabled={messages.length === 0}
          onClick={() => clear()}
        >
          Clear
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Empty. Agents use <span className="font-mono">post_chat_message</span> /{' '}
            <span className="font-mono">list_chat_messages</span>, or type below. For cross-machine
            collab, pick one host as the hub (see the agent-chat skill).
          </p>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            {messages.map((m) => (
              <ChatMessageRow key={m.id} message={m} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      <div className="shrink-0 border-t border-border/60 p-3">
        <div className="mx-auto max-w-2xl">
          <ChatComposer />
        </div>
      </div>
    </div>
  )
}
