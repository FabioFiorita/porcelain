import type { ProjectPath } from '@porcelain/client-runtime/projects'
import { shellTrpc } from '@renderer/lib/trpc'

/**
 * Opens another window — `openWindow()` raises a welcome window, `openWindow(projectPath)`
 * opens that Project in a fresh window; the current one stays put either way. Wraps the raw
 * mutation in a small domain object, matching the other mutation hooks (e.g. useInstallUpdate)
 * so callers — and their tests — never handle the TanStack result directly.
 */
export function useNewWindow(): {
  openWindow: (projectPath?: ProjectPath, environmentId?: string | null) => void
} {
  const mutation = shellTrpc.newWindow.useMutation()
  return {
    openWindow: (projectPath?: ProjectPath, environmentId?: string | null): void => {
      if (projectPath === undefined && environmentId === undefined) {
        mutation.mutate(undefined)
        return
      }
      mutation.mutate({ repoPath: projectPath, environmentId })
    },
  }
}
