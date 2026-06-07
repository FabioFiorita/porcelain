import { useRevealInFinder } from '@renderer/hooks/use-files'
import { relativeTo } from '@renderer/lib/paths'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'

export function usePathActions(path: string): {
  copyPath: () => void
  copyRelativePath: () => void
  reveal: () => void
  findReferences: (text: string) => void
} {
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const reveal = useRevealInFinder()

  return {
    copyPath: () => {
      navigator.clipboard.writeText(path)
    },
    copyRelativePath: () => {
      navigator.clipboard.writeText(relativeTo(repo?.path, path))
    },
    reveal: () => reveal(path),
    findReferences: (text) => {
      const query = text.trim()
      if (query === '') return
      openTab({ id: tabId('search', query), kind: 'search', title: query, path: query })
    },
  }
}
