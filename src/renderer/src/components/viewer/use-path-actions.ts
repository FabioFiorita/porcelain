import { useRevealInFinder } from '@renderer/hooks/use-files'
import { fileName, relativeTo } from '@renderer/lib/paths'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'

export function usePathActions(path: string): {
  copyPath: () => void
  copyRelativePath: () => void
  reveal: () => void
  findReferences: (text: string) => void
  exploreFlow: (symbol?: string) => void
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
    // Open a read-only feature-flow explore seeded from this file (whole-file) or a
    // symbol in it. The seed path is repo-relative — the walk resolves against the
    // repo file list, not absolute paths.
    exploreFlow: (symbol) => {
      const relative = relativeTo(repo?.path, path)
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
