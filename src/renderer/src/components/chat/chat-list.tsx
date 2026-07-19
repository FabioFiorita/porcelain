import { Button } from '@renderer/components/ui/button'
import { useChatMessages } from '@renderer/hooks/use-chat'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { MessagesSquare } from 'lucide-react'
import { ChatComposer } from './chat-composer'
import { ChatMessageRow } from './chat-message-row'

/**
 * The Chat sidebar tab body: recent agent-relay messages + a compact composer.
 * "Open chat" expands the full thread in the viewer (mirrors Board).
 */
export function ChatList(): React.JSX.Element {
  const { messages, error } = useChatMessages()
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)

  const openChat = (): void => {
    if (!repo) return
    openTab({ id: tabId('chat', repo.path), kind: 'chat', title: 'Chat', path: repo.path })
  }

  const recent = messages.slice(-12)

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between gap-1 px-1">
        <p className="text-xs text-muted-foreground">
          Agent relay — local ↔ remote context exchange
        </p>
        <Button variant="ghost" size="icon-sm" onClick={openChat} aria-label="Open chat">
          <MessagesSquare />
        </Button>
      </div>
      {error != null && (
        <p className="px-1 text-xs text-destructive">Couldn&apos;t load chat. {error}</p>
      )}
      <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
        {recent.length === 0 && error == null && (
          <div className="px-3 py-8 text-center">
            <p className="text-xs font-medium text-foreground">No messages yet</p>
            <p className="mx-auto mt-1 max-w-[15rem] text-xs text-muted-foreground">
              Agents post via the porcelain CLI; you can type below.
            </p>
          </div>
        )}
        {recent.map((m) => (
          <ChatMessageRow key={m.id} message={m} compact />
        ))}
      </div>
      <ChatComposer />
    </div>
  )
}
