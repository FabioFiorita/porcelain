import type { Commit } from '@porcelain/contracts/git'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { useFetchCommitMessage } from '@renderer/features/git'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { copyText } from '@renderer/lib/utils'
import { runUserAction } from '@shared/background'
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

  const handleCopyMessage = (): void => {
    runUserAction(
      async () => {
        await copyText(await fetchMessage(commit.hash))
      },
      (error) => {
        toastUserActionError('Copy commit message', error)
      },
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => {
            runUserAction(
              () => copyText(commit.hash),
              (error) => {
                toastUserActionError('Copy SHA', error)
              },
            )
          }}
        >
          <Copy />
          Copy SHA
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyMessage}>
          <MessageSquare />
          Copy commit message
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
