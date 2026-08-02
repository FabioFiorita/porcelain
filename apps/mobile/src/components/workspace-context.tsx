import { Button, HStack, Image, Menu, Section, Text } from '@expo/ui/swift-ui'
import { disabled, font, lineLimit } from '@expo/ui/swift-ui/modifiers'
import { headLabel } from '@porcelain/contracts'
import { router, useIsFocused } from 'expo-router'
import { Alert } from 'react-native'
import { repoNameOf } from '@/lib/daemon/environment'
import { DaemonError, daemonErrorMessage } from '@/lib/daemon/errors'
import { gitHeadQuery } from '@/lib/daemon/procedures/changes'
import {
  type BranchRef,
  gitBranchesQuery,
  gitCheckoutMutation,
  gitWorktreesQuery,
  WORKSPACE_CHECKOUT_INVALIDATIONS,
  type Worktree,
} from '@/lib/daemon/procedures/workspace'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { openRepo, useActiveRepo } from '@/lib/daemon/repo'
import { secondary } from '@/theme/modifiers'

/** The project, branch, and worktree controls sit together; environment selection stays in Settings. */
export function WorkspaceContext(): React.JSX.Element {
  const repo = useActiveRepo()
  const focused = useIsFocused()
  const repoPath = repo?.path ?? ''
  const enabled = repo !== null && focused
  const head = useDaemonQuery(gitHeadQuery, repoPath, { enabled, pollMs: 5_000 })
  const branches = useDaemonQuery(gitBranchesQuery, repoPath, {
    enabled,
    staleTime: 30_000,
  })
  const worktrees = useDaemonQuery(gitWorktreesQuery, repoPath, {
    enabled,
    pollMs: 15_000,
  })
  const checkout = useDaemonMutation(gitCheckoutMutation, {
    invalidates: WORKSPACE_CHECKOUT_INVALIDATIONS,
  })

  const branch = head.data === undefined ? 'Branch' : headLabel(head.data)
  const currentWorktree = worktrees.data?.find((candidate) => candidate.path === repo?.path)
  const worktree = currentWorktree === undefined ? 'Worktree' : repoNameOf(currentWorktree.path)

  async function selectBranch(target: BranchRef): Promise<void> {
    if (repo === null || (target.remote === null && target.name === head.data?.branch)) return
    try {
      await checkout.mutateAsync({ branch: target.name, repoPath: repo.path })
    } catch (cause) {
      showWorkspaceError('Switch branch failed', cause)
    }
  }

  async function selectWorktree(target: Worktree): Promise<void> {
    if (target.path === repo?.path) return
    try {
      await openRepo(target.path)
    } catch (cause) {
      showWorkspaceError('Switch worktree failed', cause)
    }
  }

  return (
    <HStack spacing={4}>
      {/* One compact trigger keeps all three native pickers reachable in the iPhone toolbar. */}
      <Menu label={<ContextLabel label={repo?.name ?? 'Project'} systemName="folder" />}>
        <Section title="Project">
          <Button
            label={repo?.name ?? 'No project selected'}
            modifiers={[disabled(repo === null)]}
            systemImage="checkmark"
          />
          <Button
            label="Choose project…"
            onPress={(): void => router.push('/repo')}
            systemImage="folder"
          />
        </Section>
        <Menu label={`Branch · ${branch}`} systemImage="arrow.triangle.branch">
          <BranchMenuContent
            branches={branches.data}
            currentBranch={head.data?.branch}
            isPending={branches.isPending}
            onRefresh={(): void => {
              branches.refetch()
            }}
            onSelect={(target: BranchRef): void => {
              selectBranch(target)
            }}
          />
        </Menu>
        <Menu label={`Worktree · ${worktree}`} systemImage="folder.fill">
          <WorktreeMenuContent
            currentPath={repo?.path}
            isPending={worktrees.isPending}
            onRefresh={(): void => {
              worktrees.refetch()
            }}
            onSelect={(target: Worktree): void => {
              selectWorktree(target)
            }}
            worktrees={worktrees.data}
          />
        </Menu>
      </Menu>
    </HStack>
  )
}

function ContextLabel({
  label,
  systemName,
}: {
  label: string
  systemName: 'arrow.triangle.branch' | 'folder' | 'folder.fill'
}): React.JSX.Element {
  return (
    <HStack spacing={3}>
      <Image modifiers={[secondary]} size={11} systemName={systemName} />
      <Text modifiers={[font({ size: 11, weight: 'medium' }), secondary, lineLimit(1)]}>
        {label}
      </Text>
      <Image modifiers={[secondary]} size={8} systemName="chevron.down" />
    </HStack>
  )
}

function BranchMenuContent({
  branches,
  currentBranch,
  isPending,
  onRefresh,
  onSelect,
}: {
  branches: BranchRef[] | undefined
  currentBranch: string | null | undefined
  isPending: boolean
  onRefresh: () => void
  onSelect: (branch: BranchRef) => void
}): React.JSX.Element {
  const local = branches?.filter((branch) => branch.remote === null) ?? []
  const remote = branches?.filter((branch) => branch.remote !== null) ?? []

  if (branches === undefined) {
    return (
      <Section title="Branches">
        <Button
          label={isPending ? 'Loading branches…' : 'Retry branches'}
          modifiers={[disabled(isPending)]}
          onPress={onRefresh}
          systemImage="arrow.clockwise"
        />
      </Section>
    )
  }

  return (
    <>
      <Section title="Local">
        {local.length === 0 ? (
          <Button label="No local branches" modifiers={[disabled(true)]} />
        ) : (
          local.map((branch) => (
            <BranchButton
              branch={branch}
              current={branch.name === currentBranch}
              key={branch.name}
              onSelect={onSelect}
            />
          ))
        )}
      </Section>
      {remote.length === 0 ? null : (
        <Section title="Remote">
          {remote.map((branch) => (
            <BranchButton
              branch={branch}
              current={false}
              key={`${branch.remote}/${branch.name}`}
              onSelect={onSelect}
            />
          ))}
        </Section>
      )}
      <Button label="Refresh branches" onPress={onRefresh} systemImage="arrow.clockwise" />
    </>
  )
}

function BranchButton({
  branch,
  current,
  onSelect,
}: {
  branch: BranchRef
  current: boolean
  onSelect: (branch: BranchRef) => void
}): React.JSX.Element {
  return (
    <Button
      label={branch.remote === null ? branch.name : `${branch.remote}/${branch.name}`}
      onPress={(): void => onSelect(branch)}
      systemImage={current ? 'checkmark' : undefined}
    />
  )
}

function WorktreeMenuContent({
  currentPath,
  isPending,
  onRefresh,
  onSelect,
  worktrees,
}: {
  currentPath: string | undefined
  isPending: boolean
  onRefresh: () => void
  onSelect: (worktree: Worktree) => void
  worktrees: Worktree[] | undefined
}): React.JSX.Element {
  if (worktrees === undefined) {
    return (
      <Section title="Worktrees">
        <Button
          label={isPending ? 'Loading worktrees…' : 'Retry worktrees'}
          modifiers={[disabled(isPending)]}
          onPress={onRefresh}
          systemImage="arrow.clockwise"
        />
      </Section>
    )
  }

  return (
    <Section title="Worktrees">
      {worktrees.length === 0 ? (
        <Button label="No worktrees" modifiers={[disabled(true)]} />
      ) : (
        worktrees.map((worktree) => (
          <Button
            key={worktree.path}
            label={`${worktree.branch} · ${repoNameOf(worktree.path)}`}
            onPress={(): void => onSelect(worktree)}
            systemImage={worktree.path === currentPath ? 'checkmark' : 'folder'}
          />
        ))
      )}
      <Button label="Refresh worktrees" onPress={onRefresh} systemImage="arrow.clockwise" />
    </Section>
  )
}

function showWorkspaceError(title: string, cause: unknown): void {
  const message =
    cause instanceof DaemonError
      ? daemonErrorMessage(cause)
      : cause instanceof Error
        ? cause.message
        : 'The workspace could not be changed.'
  Alert.alert(title, message)
}
