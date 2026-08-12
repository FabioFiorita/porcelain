import { headLabel } from '@porcelain/contracts'
import { useGitWorkspace } from '@/features/git'
import { useSelectedProject } from '@/features/projects'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import { deriveWorkspaceIdentity, type WorkspaceIdentity } from './workspace-lists'

/**
 * The shell's presentation seam. Git workspace reads and writes live in the Git feature; this
 * adapter only turns its public state into the identity shown by the shell header.
 */

export function useWorkspaceHeader(): WorkspaceIdentity & {
  project: ReturnType<typeof useSelectedProject>
} {
  const project = useSelectedProject()
  const environment = useActiveEnvironment()
  const projectPath = project?.path ?? ''
  const workspace = useGitWorkspace({ enabled: project !== null, placeholderData: true })

  return {
    ...deriveWorkspaceIdentity({
      branch: workspace.head.data === undefined ? null : headLabel(workspace.head.data),
      branchFailed: workspace.head.isError,
      environmentNickname: environment?.nickname ?? null,
      mainWorktreePath: workspace.worktrees.data?.[0]?.path ?? null,
      projectName: project?.name ?? null,
      projectPath,
    }),
    project,
  }
}
