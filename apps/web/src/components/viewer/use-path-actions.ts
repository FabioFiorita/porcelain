import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { useRevealInFinder } from '@renderer/hooks/use-reveal-in-finder'
import { relativeTo } from '@renderer/lib/paths'
import { copyText } from '@renderer/lib/utils'
import { useHubRepoPath } from '@renderer/stores/hub-repo'
import { activeTabTarget, targetedTab } from '@renderer/stores/hub-tabs'
import { useTabsStore } from '@renderer/stores/tabs'
import { runUserAction } from '@shared/background'

export function usePathActions(path: string): {
  copyPath: () => void
  copyRelativePath: () => void
  reveal: () => void
  findReferences: (text: string) => void
} {
  const repoPath = useHubRepoPath() ?? undefined
  const openTab = useTabsStore((s) => s.openTab)
  const reveal = useRevealInFinder()

  return {
    copyPath: () => {
      runUserAction(
        () => copyText(path),
        (error) => {
          toastUserActionError('Copy path', error)
        },
      )
    },
    copyRelativePath: () => {
      runUserAction(
        () => copyText(relativeTo(repoPath, path)),
        (error) => {
          toastUserActionError('Copy relative path', error)
        },
      )
    },
    reveal: () => reveal(path),
    findReferences: (text: string) => {
      const query = text.trim()
      if (query === '') return
      openTab(targetedTab('search', query, { title: query }, activeTabTarget()))
    },
  }
}
