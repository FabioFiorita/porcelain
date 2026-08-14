import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { useRevealInFinder } from '@renderer/hooks/use-reveal-in-finder'
import { fileName, relativeTo } from '@renderer/lib/paths'
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
  exploreFlow: (symbol?: string) => void
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
    // Open a read-only flow exploration seeded from this file (whole-file) or a
    // symbol in it. The seed path is project-relative — the walk resolves against the
    // project file list, not absolute paths.
    exploreFlow: (symbol?: string) => {
      const relative = relativeTo(repoPath, path)
      const seed = symbol?.trim()
      openTab(
        targetedTab(
          'explore',
          relative,
          {
            title: seed ? `Flow: ${seed}` : `Flow: ${fileName(relative)}`,
            key: seed ? `${relative}#${seed}` : relative,
            symbol: seed,
          },
          activeTabTarget(),
        ),
      )
    },
  }
}
