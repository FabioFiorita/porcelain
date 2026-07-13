import { useRepoStore } from '@renderer/stores/repo'
import { useEffect } from 'react'

/**
 * Drives `document.title`, which Electron's default `page-title-updated` behavior
 * mirrors onto the native window — so the Dock/Mission Control label the window by
 * its repo instead of the bundle name. Mounted once in AppShell so it tracks every
 * window mode, including the welcome screen (repo === null → plain "Porcelain").
 */
export function useDocumentTitle(): void {
  const repoName = useRepoStore((s) => s.repo?.name)

  useEffect(() => {
    document.title = repoName ? `${repoName} — Porcelain` : 'Porcelain'
  }, [repoName])
}
