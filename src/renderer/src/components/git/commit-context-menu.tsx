import type { Commit } from '@backend/diff'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { useFetchCommitMessage } from '@renderer/hooks/use-history'
import { copyText } from '@renderer/lib/utils'
import { Copy, MessageSquare } from 'lucide-react'

// Right-click affordances shared by the History list and the file timeline:
// copy the SHA, or copy the full commit message. Extracted so both commit-row
// surfaces offer the same menu without duplicating it.
export function CommitContextMenu({
  commit,
  children,
}: {
  commit: Commit
  children: React.ReactNode
}): React.JSX.Element {
  const fetchMessage = useFetchCommitMessage()

  const copyMessage = async (): Promise<void> => {
    await copyText(await fetchMessage(commit.hash))
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => copyText(commit.hash)}>
          <Copy />
          Copy SHA
        </ContextMenuItem>
        <ContextMenuItem onClick={copyMessage}>
          <MessageSquare />
          Copy commit message
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
