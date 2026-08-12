import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { useRevealInFinder } from '@renderer/hooks/use-reveal-in-finder'
import { fileName, relativeTo } from '@renderer/lib/paths'
import { copyText } from '@renderer/lib/utils'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { runUserAction } from '@shared/background'

export function usePathActions(path: string): {
  copyPath: () => void
  copyRelativePath: () => void
  reveal: () => void
  findReferences: (text: string) => void
  exploreFlow: (symbol?: string) => void
} {
  const project = useProjectSelectionStore((s) => s.project)
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
        () => copyText(relativeTo(project?.path, path)),
        (error) => {
          toastUserActionError('Copy relative path', error)
        },
      )
    },
    reveal: () => reveal(path),
    findReferences: (text: string) => {
      const query = text.trim()
      if (query === '') return
      openTab({ id: tabId('search', query), kind: 'search', title: query, path: query })
    },
    // Open a read-only feature-flow explore seeded from this file (whole-file) or a
    // symbol in it. The seed path is project-relative — the walk resolves against the
    // project file list, not absolute paths.
    exploreFlow: (symbol?: string) => {
      const relative = relativeTo(project?.path, path)
      const seed = symbol?.trim()
      openTab({
        id: tabId('explore', seed ? `${relative}#${seed}` : relative),
        kind: 'explore',
        title: seed ? `Flow: ${seed}` : `Flow: ${fileName(relative)}`,
        path: relative,
        symbol: seed,
      })
    },
  }
}
