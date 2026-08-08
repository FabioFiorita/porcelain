import { fileName } from '@porcelain/client-runtime/paths'
import { headLabel } from '@porcelain/contracts'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChromeGlyph } from '@/components/chrome-glyph'
import { ShellModalScroll } from '@/components/shell-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text as UiText } from '@/components/ui/text'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import { gitHeadQuery } from '@/lib/daemon/procedures/changes'
import {
  type BrowseDirsResult,
  browseDirsQuery,
  recentReposQuery,
} from '@/lib/daemon/procedures/connection'
import {
  type BranchRef,
  gitAddWorktreeMutation,
  gitBranchesQuery,
  gitCheckoutMutation,
  gitCreateBranchMutation,
  gitWorktreesQuery,
  WORKSPACE_ADD_WORKTREE_INVALIDATIONS,
  WORKSPACE_CHECKOUT_INVALIDATIONS,
  type Worktree,
} from '@/lib/daemon/procedures/workspace'
import { useDaemonInvalidate, useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { openRepo, useActiveRepo } from '@/lib/daemon/repo'
import { cn } from '@/lib/utils'
import { useShellStore } from './shell-store'
import { WorkspaceCreateForm } from './workspace-create-form'

type WorkspaceHeader = {
  repo: ReturnType<typeof useActiveRepo>
  branch: string
  /** The project's own name — the MAIN checkout's folder, never a linked worktree's. */
  projectName: string
  worktree: string
  projectInitial: string
  environmentLabel: string
}

/**
 * The live three-part workspace identity used by both phone and tablet chrome.
 *
 * Three chips have to carry three different facts or they are noise. Two of them used to
 * collide: the worktree chip read back the branch checked out in it, and a worktree is named
 * for its branch — so the header said the same word twice and the reader had to work out which
 * chip was which. `repo.name` is only the active path's basename, so naming the worktree by its
 * folder instead just moves the collision onto the project chip, which in a linked checkout was
 * already reporting the worktree's folder as the project.
 *
 * So both come off the worktree roster: git lists the main worktree first, its folder is the
 * project, and the chip says where you are actually standing.
 */
export function useWorkspaceHeader(): WorkspaceHeader {
  const repo = useActiveRepo()
  const environment = useActiveEnvironment()
  const repoPath = repo?.path ?? ''
  const head = useDaemonQuery(gitHeadQuery, repoPath, {
    enabled: repo !== null,
    pollMs: 5_000,
    staleTime: 0,
  })
  const worktrees = useDaemonQuery(gitWorktreesQuery, repoPath, {
    enabled: repo !== null,
    placeholderData: 'keepPreviousData',
    pollMs: 15_000,
  })
  // `git worktree list` puts the main worktree first; the linked ones live in a sibling
  // `<repo>-worktrees/` directory and must not rename the project.
  const main = worktrees.data?.[0] ?? null
  const projectName = main === null ? (repo?.name ?? 'Project') : fileName(main.path)

  return {
    branch:
      repo === null
        ? 'No project'
        : head.data !== undefined
          ? headLabel(head.data)
          : head.isError
            ? 'No branch'
            : '…',
    environmentLabel: environment?.nickname ?? 'No environment',
    projectInitial: projectName.charAt(0).toUpperCase() || '?',
    projectName,
    repo,
    // Until the roster lands, the folder is the honest answer: less specific than "Main", never
    // wrong. Naming it before we know which checkout is the main one would be a guess.
    worktree:
      repo === null
        ? 'No project'
        : main !== null && main.path === repoPath
          ? 'Main'
          : fileName(repoPath) || repo.name,
  }
}

type PickerBodyProps = {
  open: boolean
}

/**
 * A picker that can create. `creating` lives in the sheet host, not here: the create form is a
 * mode of the SAME `ShellModal` (its title swaps with it), because stacking a second native
 * modal on the picker is what broke iOS keyboard avoidance for these two forms.
 */
type CreatingPickerBodyProps = PickerBodyProps & {
  creating: boolean
  onCreatingChange: (creating: boolean) => void
}

/** Project recents plus the daemon-side directory browser used by local and remote daemons. */
export function ProjectSheetBody({ open }: PickerBodyProps): React.JSX.Element {
  const closeSheet = useShellStore((state) => state.closeSheet)
  const repo = useActiveRepo()
  const environment = useActiveEnvironment()
  const invalidate = useDaemonInvalidate()
  const [mode, setMode] = useState<'projects' | 'browse'>('projects')
  const [browsePath, setBrowsePath] = useState<string | null>(null)
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const recentQuery = useDaemonQuery(
    recentReposQuery,
    { includeWorktrees: false },
    { enabled: open && mode === 'projects', placeholderData: 'keepPreviousData' },
  )
  const browseQuery = useDaemonQuery(browseDirsQuery, browsePath, {
    enabled: open && mode === 'browse',
    placeholderData: 'keepPreviousData',
  })

  useEffect(() => {
    if (!open) {
      setActionError(null)
      setBrowsePath(null)
      setBusyPath(null)
      setMode('projects')
    }
  }, [open])

  const handleOpen = async (path: string): Promise<void> => {
    setBusyPath(path)
    setActionError(null)
    try {
      await openRepo(path)
      invalidate(['recentRepos'])
      closeSheet()
    } catch (error) {
      setActionError(errorMessage(error, 'Could not open that project.'))
    } finally {
      setBusyPath(null)
    }
  }

  const paired = environment !== null && environment.token !== null
  if (mode === 'browse') {
    return (
      <DirectoryBrowser
        actionError={actionError}
        browseQuery={browseQuery}
        busyPath={busyPath}
        onBack={() => {
          setActionError(null)
          setMode('projects')
        }}
        onOpen={handleOpen}
        onPathChange={setBrowsePath}
        paired={paired}
      />
    )
  }

  const projects = recentQuery.data ?? []
  return (
    <View className="gap-4" testID="porcelain-project-sheet">
      {!paired ? (
        <EmptyPickerState
          body="Pair a daemon in Settings → Environments before opening a project."
          testID="porcelain-project-no-environment"
          title="No daemon connected"
        />
      ) : null}

      {paired && recentQuery.isLoading ? (
        <Text className="text-sm text-muted-foreground" testID="porcelain-project-loading">
          Loading projects…
        </Text>
      ) : null}
      {paired && recentQuery.isError ? (
        <ErrorState
          message={errorMessage(recentQuery.error, 'Could not load recent projects.')}
          testID="porcelain-project-error"
        />
      ) : null}
      {paired && !recentQuery.isLoading && !recentQuery.isError && projects.length === 0 ? (
        <EmptyPickerState
          body="Open a directory on the daemon to add it to Projects."
          testID="porcelain-project-empty"
          title="No recent projects"
        />
      ) : null}
      {projects.length > 0 ? (
        <PickerSection title="Projects">
          {projects.map((project) => (
            <WorkspaceRow
              key={project.path}
              detail={project.path}
              disabled={busyPath !== null}
              label={project.name}
              selected={project.path === repo?.path}
              testID={workspaceTestId('project-row', project.path)}
              onPress={() => {
                handleOpen(project.path)
              }}
            />
          ))}
        </PickerSection>
      ) : null}

      <Button
        accessibilityLabel="Open project directory"
        disabled={!paired || busyPath !== null}
        testID="porcelain-project-open-directory"
        variant="outline"
        onPress={() => {
          setActionError(null)
          setBrowsePath(null)
          setMode('browse')
        }}
      >
        <ChromeGlyph name="folder" size={16} tone="foreground" />
        <UiText>Open directory…</UiText>
      </Button>
      {actionError ? (
        <ErrorState message={actionError} testID="porcelain-project-action-error" />
      ) : null}
    </View>
  )
}

function DirectoryBrowser({
  actionError,
  browseQuery,
  busyPath,
  onBack,
  onOpen,
  onPathChange,
  paired,
}: {
  actionError: string | null
  browseQuery: {
    data: BrowseDirsResult | undefined
    error: unknown
    isError: boolean
    isFetching: boolean
    isLoading: boolean
  }
  busyPath: string | null
  onBack: () => void
  onOpen: (path: string) => Promise<void>
  onPathChange: (path: string | null) => void
  paired: boolean
}): React.JSX.Element {
  const result = browseQuery.data
  const entries = result?.entries ?? []

  return (
    <View className="gap-3" testID="porcelain-project-browser">
      <View className="gap-1">
        <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Daemon folders
        </Text>
        <Text
          className="font-mono text-xs text-muted-foreground"
          numberOfLines={1}
          testID="porcelain-project-browser-path"
        >
          {result?.path ?? (browseQuery.isError ? 'Unable to read this folder' : 'Loading…')}
        </Text>
      </View>

      <Pressable
        accessibilityLabel="Go to parent folder"
        accessibilityRole="button"
        accessibilityState={{
          disabled: !paired || result?.parent === null || result === undefined || busyPath !== null,
        }}
        className="h-11 flex-row items-center gap-3 border-b border-border px-3 active:bg-accent"
        disabled={!paired || result?.parent === null || result === undefined || busyPath !== null}
        testID="porcelain-project-up"
        onPress={() => {
          if (result?.parent !== null && result?.parent !== undefined) onPathChange(result.parent)
        }}
      >
        <ChromeGlyph name="arrowUp" size={18} tone="foreground" />
        <Text className="font-mono text-sm text-foreground">..</Text>
      </Pressable>

      <ShellModalScroll className="max-h-72" contentContainerClassName="gap-1">
        {browseQuery.isLoading ? (
          <Text className="px-4 py-6 text-center text-sm text-muted-foreground">
            Loading folders…
          </Text>
        ) : null}
        {browseQuery.isError ? (
          <ErrorState
            message={errorMessage(browseQuery.error, 'Could not browse this folder.')}
            testID="porcelain-project-browser-error"
          />
        ) : null}
        {!browseQuery.isLoading && !browseQuery.isError && entries.length === 0 ? (
          <Text className="px-4 py-6 text-center text-sm text-muted-foreground">
            No folders here
          </Text>
        ) : null}
        {entries.map((entry) => (
          <View key={entry.path} className="flex-row items-center gap-2 rounded-xl px-2 py-1">
            <Pressable
              accessibilityLabel={`Browse folder ${entry.name}`}
              accessibilityRole="button"
              className="min-w-0 flex-1 flex-row items-center gap-2 rounded-lg px-1 py-2 active:bg-accent"
              testID={workspaceTestId('project-folder', entry.path)}
              onPress={() => {
                onPathChange(entry.path)
              }}
            >
              <ChromeGlyph name="folder" size={16} tone={entry.isRepo ? 'primary' : 'muted'} />
              <Text className="min-w-0 flex-1 font-mono text-sm text-foreground" numberOfLines={1}>
                {entry.name}
              </Text>
              {entry.isRepo ? <Text className="text-[10px] text-primary">repo</Text> : null}
            </Pressable>
            {entry.isRepo ? (
              <Button
                accessibilityLabel={`Open ${entry.name}`}
                disabled={busyPath !== null}
                size="sm"
                testID={workspaceTestId('project-folder-open', entry.path)}
                variant="ghost"
                onPress={() => {
                  onOpen(entry.path)
                }}
              >
                <UiText>Open</UiText>
              </Button>
            ) : null}
          </View>
        ))}
      </ShellModalScroll>

      <View className="gap-2">
        <Button
          accessibilityLabel="Open current folder"
          disabled={!paired || result === undefined || browseQuery.isFetching || busyPath !== null}
          testID="porcelain-project-open-current-folder"
          onPress={() => {
            if (result !== undefined) onOpen(result.path)
          }}
        >
          <ChromeGlyph name="folder" size={16} tone="primaryForeground" />
          <UiText>{busyPath === result?.path ? 'Opening…' : 'Open this folder'}</UiText>
        </Button>
        <Button
          accessibilityLabel="Back to projects"
          disabled={busyPath !== null}
          testID="porcelain-project-back"
          variant="ghost"
          onPress={onBack}
        >
          <UiText>Back to projects</UiText>
        </Button>
      </View>
      {actionError ? (
        <ErrorState message={actionError} testID="porcelain-project-action-error" />
      ) : null}
    </View>
  )
}

/** Searchable Local / Remote branch picker with the daemon's worktree guard. */
export function BranchSheetBody({
  creating,
  onCreatingChange,
  open,
}: CreatingPickerBodyProps): React.JSX.Element {
  const closeSheet = useShellStore((state) => state.closeSheet)
  const openSheet = useShellStore((state) => state.openSheet)
  const repo = useActiveRepo()
  const invalidate = useDaemonInvalidate()
  const [query, setQuery] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const repoPath = repo?.path ?? ''
  const headQuery = useDaemonQuery(gitHeadQuery, repoPath, {
    enabled: open && repo !== null,
    pollMs: 5_000,
    staleTime: 0,
  })
  const branchesQuery = useDaemonQuery(gitBranchesQuery, repoPath, {
    enabled: open && repo !== null,
    placeholderData: 'keepPreviousData',
    // Branch refs can change outside the mobile client; the sheet establishes the
    // freshness boundary when it opens instead of trusting the shared 5s cache.
    staleTime: 0,
  })
  const worktreesQuery = useDaemonQuery(gitWorktreesQuery, repoPath, {
    enabled: open && repo !== null,
    placeholderData: 'keepPreviousData',
    pollMs: 15_000,
  })
  const checkout = useDaemonMutation(gitCheckoutMutation, {
    invalidates: WORKSPACE_CHECKOUT_INVALIDATIONS,
  })
  // `checkout -b` lands HEAD on the new branch, so creating one has a checkout's blast radius.
  const createBranch = useDaemonMutation(gitCreateBranchMutation, {
    invalidates: WORKSPACE_CHECKOUT_INVALIDATIONS,
  })
  const currentBranch = headQuery.data === undefined ? null : headLabel(headQuery.data)
  const normalizedQuery = query.trim().toLowerCase()
  const branches = branchesQuery.data ?? []
  const localBranches = useMemo(
    () =>
      branches.filter(
        (branch) => branch.remote === null && branch.name.toLowerCase().includes(normalizedQuery),
      ),
    [branches, normalizedQuery],
  )
  const remoteBranches = useMemo(
    () =>
      branches.filter(
        (branch) =>
          branch.remote !== null &&
          `${branch.remote}/${branch.name}`.toLowerCase().includes(normalizedQuery),
      ),
    [branches, normalizedQuery],
  )
  // Unfiltered: the create form validates against every local name, not the searched subset.
  const localBranchNames = useMemo(
    () => branches.filter((branch) => branch.remote === null).map((branch) => branch.name),
    [branches],
  )

  useEffect(() => {
    if (!open) {
      setActionError(null)
      setCreateError(null)
      setQuery('')
      return
    }
    if (repoPath !== '') invalidate(['gitBranches'])
  }, [open, invalidate, repoPath])

  const handleSelect = async (branch: BranchRef): Promise<void> => {
    const blockedBy = (worktreesQuery.data ?? []).find(
      (worktree) => worktree.path !== repo?.path && worktree.branch === branch.name,
    )
    if (blockedBy !== undefined) {
      openSheet('worktree')
      return
    }
    if (repo === null || branch.name === currentBranch) {
      closeSheet()
      return
    }

    setActionError(null)
    try {
      await checkout.mutateAsync({ branch: branch.name, repoPath: repo.path })
      closeSheet()
    } catch (error) {
      setActionError(errorMessage(error, 'Checkout failed.'))
    }
  }

  const handleCreate = async (branch: string): Promise<void> => {
    if (repo === null || createBranch.isPending) return
    setCreateError(null)
    try {
      await createBranch.mutateAsync({ branch, repoPath: repo.path })
      onCreatingChange(false)
      closeSheet()
    } catch (error) {
      // git's refusal (an existing branch, a malformed ref) is the message worth reading.
      setCreateError(errorMessage(error, 'Create branch failed.'))
    }
  }

  if (repo === null) {
    return (
      <EmptyPickerState
        body="Open a project before switching branches."
        testID="porcelain-branch-no-project"
        title="No project open"
      />
    )
  }

  if (creating) {
    return (
      <WorkspaceCreateForm
        daemonError={createError}
        existingBranches={localBranchNames}
        fromLabel={currentBranch ?? 'HEAD'}
        pending={createBranch.isPending}
        repoPath={repo.path}
        target="branch"
        onCancel={() => {
          onCreatingChange(false)
          setCreateError(null)
        }}
        onSubmit={(branch) => {
          handleCreate(branch)
        }}
      />
    )
  }

  const empty = !branchesQuery.isLoading && !branchesQuery.isError && branches.length === 0
  return (
    <View className="gap-3" testID="porcelain-branch-sheet">
      <Input
        accessibilityLabel="Search branches"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Switch branch…"
        testID="porcelain-branch-search"
        value={query}
        onChangeText={setQuery}
      />
      {branchesQuery.isLoading ? (
        <Text className="text-sm text-muted-foreground" testID="porcelain-branch-loading">
          Loading branches…
        </Text>
      ) : null}
      {branchesQuery.isError ? (
        <ErrorState
          message={errorMessage(branchesQuery.error, 'Could not load branches.')}
          testID="porcelain-branch-error"
        />
      ) : null}
      {empty ? (
        <EmptyPickerState
          body={
            normalizedQuery
              ? `No branches match “${query.trim()}”.`
              : 'This folder has no Git branches.'
          }
          testID="porcelain-branch-empty"
          title={normalizedQuery ? 'No branches found' : 'No branches'}
        />
      ) : null}
      {!branchesQuery.isLoading && !branchesQuery.isError && !empty ? (
        <ShellModalScroll className="max-h-80" contentContainerClassName="gap-3">
          {localBranches.length > 0 ? (
            <PickerSection title="Local">
              {localBranches.map((branch) => (
                <BranchRow
                  key={branch.name}
                  branch={branch}
                  currentBranch={currentBranch}
                  repoPath={repo.path}
                  worktrees={worktreesQuery.data ?? []}
                  disabled={checkout.isPending}
                  onPress={() => {
                    handleSelect(branch)
                  }}
                />
              ))}
            </PickerSection>
          ) : null}
          {remoteBranches.length > 0 ? (
            <PickerSection title="Remote">
              {remoteBranches.map((branch) => (
                <BranchRow
                  key={`${branch.remote}/${branch.name}`}
                  branch={branch}
                  currentBranch={currentBranch}
                  repoPath={repo.path}
                  worktrees={worktreesQuery.data ?? []}
                  disabled={checkout.isPending}
                  onPress={() => {
                    handleSelect(branch)
                  }}
                />
              ))}
            </PickerSection>
          ) : null}
          {localBranches.length === 0 && remoteBranches.length === 0 ? (
            <Text className="px-2 py-6 text-center text-sm text-muted-foreground">
              No branches match “{query.trim()}”.
            </Text>
          ) : null}
        </ShellModalScroll>
      ) : null}

      <Button
        accessibilityLabel="New branch"
        accessibilityRole="button"
        disabled={checkout.isPending || createBranch.isPending}
        testID="porcelain-workspace-new-branch"
        variant="outline"
        onPress={() => {
          setCreateError(null)
          onCreatingChange(true)
        }}
      >
        <ChromeGlyph name="plus" size={16} tone="foreground" />
        <UiText>New branch…</UiText>
      </Button>

      {actionError ? (
        <ErrorState message={actionError} testID="porcelain-branch-action-error" />
      ) : null}
    </View>
  )
}

function BranchRow({
  branch,
  currentBranch,
  disabled,
  onPress,
  repoPath,
  worktrees,
}: {
  branch: BranchRef
  currentBranch: string | null
  disabled: boolean
  onPress: () => void
  repoPath: string
  worktrees: readonly Worktree[]
}): React.JSX.Element {
  const blockedBy = worktrees.find(
    (worktree) => worktree.path !== repoPath && worktree.branch === branch.name,
  )
  const selected = branch.remote === null && branch.name === currentBranch
  const label = branch.remote === null ? branch.name : `${branch.remote}/${branch.name}`
  const detail =
    blockedBy !== undefined
      ? `Checked out in ${blockedBy.path} · switch worktree`
      : selected
        ? 'Current branch'
        : branch.remote === null
          ? undefined
          : 'Remote branch'

  return (
    <WorkspaceRow
      accessibilityLabel={
        blockedBy === undefined ? label : `${label}, checked out in another worktree`
      }
      detail={detail}
      disabled={disabled}
      glyph="branch"
      label={label}
      selected={selected}
      testID={workspaceTestId('branch-row', label)}
      onPress={onPress}
    />
  )
}

/** Worktree switcher: switching the row opens that checkout, including linked worktrees. */
export function WorktreeSheetBody({
  creating,
  onCreatingChange,
  open,
}: CreatingPickerBodyProps): React.JSX.Element {
  const closeSheet = useShellStore((state) => state.closeSheet)
  const repo = useActiveRepo()
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const repoPath = repo?.path ?? ''
  const worktreesQuery = useDaemonQuery(gitWorktreesQuery, repoPath, {
    enabled: open && repo !== null,
    placeholderData: 'keepPreviousData',
    pollMs: 15_000,
  })
  // `worktree add -b` creates a branch too, so this sheet needs the same HEAD and roster the
  // branch sheet reads to say what it forks from and to reject a name git already knows.
  const headQuery = useDaemonQuery(gitHeadQuery, repoPath, {
    enabled: open && repo !== null,
    pollMs: 5_000,
    staleTime: 0,
  })
  const branchesQuery = useDaemonQuery(gitBranchesQuery, repoPath, {
    enabled: open && repo !== null,
    placeholderData: 'keepPreviousData',
    staleTime: 0,
  })
  const addWorktree = useDaemonMutation(gitAddWorktreeMutation, {
    invalidates: WORKSPACE_ADD_WORKTREE_INVALIDATIONS,
  })
  const localBranchNames = useMemo(
    () =>
      (branchesQuery.data ?? [])
        .filter((branch) => branch.remote === null)
        .map((branch) => branch.name),
    [branchesQuery.data],
  )

  useEffect(() => {
    if (!open) {
      setActionError(null)
      setBusyPath(null)
      setCreateError(null)
    }
  }, [open])

  const handleOpen = async (path: string): Promise<void> => {
    if (path === repo?.path) {
      closeSheet()
      return
    }
    setBusyPath(path)
    setActionError(null)
    try {
      await openRepo(path)
      closeSheet()
    } catch (error) {
      setActionError(errorMessage(error, 'Could not open that worktree.'))
    } finally {
      setBusyPath(null)
    }
  }

  const handleCreate = async (branch: string): Promise<void> => {
    if (repo === null || addWorktree.isPending || busyPath !== null) return
    setCreateError(null)
    try {
      // The daemon derives and realpaths the destination, so its answer — not the preview the
      // form showed — is what gets opened. Creating a worktree you are not standing in would
      // leave the tap with nothing to show for it. The form stays up until the switch lands so
      // a failing open still has somewhere to report.
      const created = await addWorktree.mutateAsync({ branch, repoPath: repo.path })
      setBusyPath(created.path)
      await openRepo(created.path)
      onCreatingChange(false)
      closeSheet()
    } catch (error) {
      setCreateError(errorMessage(error, 'Create worktree failed.'))
    } finally {
      setBusyPath(null)
    }
  }

  if (repo === null) {
    return (
      <EmptyPickerState
        body="Open a project before switching worktrees."
        testID="porcelain-worktree-no-project"
        title="No project open"
      />
    )
  }

  if (creating) {
    return (
      <WorkspaceCreateForm
        daemonError={createError}
        existingBranches={localBranchNames}
        fromLabel={headQuery.data === undefined ? 'HEAD' : headLabel(headQuery.data)}
        pending={addWorktree.isPending || busyPath !== null}
        repoPath={repo.path}
        target="worktree"
        onCancel={() => {
          onCreatingChange(false)
          setCreateError(null)
        }}
        onSubmit={(branch) => {
          handleCreate(branch)
        }}
      />
    )
  }

  const worktrees = worktreesQuery.data ?? []
  return (
    <View className="gap-3" testID="porcelain-worktree-sheet">
      {worktreesQuery.isLoading ? (
        <Text className="text-sm text-muted-foreground" testID="porcelain-worktree-loading">
          Loading worktrees…
        </Text>
      ) : null}
      {worktreesQuery.isError ? (
        <ErrorState
          message={errorMessage(worktreesQuery.error, 'Could not load worktrees.')}
          testID="porcelain-worktree-error"
        />
      ) : null}
      {!worktreesQuery.isLoading && !worktreesQuery.isError && worktrees.length === 0 ? (
        <EmptyPickerState
          body="This project has no Git worktrees."
          testID="porcelain-worktree-empty"
          title="No worktrees"
        />
      ) : null}
      {worktrees.length > 0 ? (
        <PickerSection title="Worktrees">
          {worktrees.map((worktree) => (
            <WorkspaceRow
              key={worktree.path}
              detail={worktree.path}
              disabled={busyPath !== null}
              label={worktree.branch}
              selected={worktree.path === repo.path}
              testID={workspaceTestId('worktree-row', worktree.path)}
              onPress={() => {
                handleOpen(worktree.path)
              }}
            />
          ))}
        </PickerSection>
      ) : null}

      <Button
        accessibilityLabel="New worktree"
        accessibilityRole="button"
        disabled={busyPath !== null || addWorktree.isPending}
        testID="porcelain-workspace-new-worktree"
        variant="outline"
        onPress={() => {
          setCreateError(null)
          onCreatingChange(true)
        }}
      >
        <ChromeGlyph name="plus" size={16} tone="foreground" />
        <UiText>New worktree…</UiText>
      </Button>

      {actionError ? (
        <ErrorState message={actionError} testID="porcelain-worktree-action-error" />
      ) : null}
    </View>
  )
}

function PickerSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <View className="gap-1.5">
      <Text className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </Text>
      <View className="gap-1">{children}</View>
    </View>
  )
}

function WorkspaceRow({
  accessibilityLabel,
  detail,
  disabled = false,
  glyph,
  label,
  onPress,
  selected = false,
  testID,
}: {
  accessibilityLabel?: string
  detail?: string
  disabled?: boolean
  glyph?: 'branch' | 'folder'
  label: string
  onPress: () => void
  selected?: boolean
  testID: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      className={cn(
        'min-h-12 flex-row items-center gap-3 rounded-xl border border-transparent px-3 py-2 active:bg-accent',
        selected && 'border-border bg-muted/70',
        disabled && 'opacity-50',
      )}
      disabled={disabled}
      testID={testID}
      onPress={onPress}
    >
      {glyph ? <ChromeGlyph name={glyph} size={16} tone={selected ? 'primary' : 'muted'} /> : null}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {selected ? <ChromeGlyph name="check" size={15} tone="primary" /> : null}
    </Pressable>
  )
}

function EmptyPickerState({
  body,
  testID,
  title,
}: {
  body: string
  testID: string
  title: string
}): React.JSX.Element {
  return (
    <View
      className="gap-1 rounded-xl border border-dashed border-border bg-muted/30 p-3"
      testID={testID}
    >
      <Text className="text-sm font-medium text-foreground">{title}</Text>
      <Text className="text-xs leading-5 text-muted-foreground">{body}</Text>
    </View>
  )
}

function ErrorState({ message, testID }: { message: string; testID: string }): React.JSX.Element {
  return (
    <View className="rounded-xl border border-destructive/40 bg-destructive/5 p-3" testID={testID}>
      <Text className="text-xs leading-5 text-destructive">{message}</Text>
    </View>
  )
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback
}

/** Test IDs are deterministic path identities, never array positions. */
function workspaceTestId(prefix: string, value: string): string {
  const slug = value
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return `porcelain-${prefix}-${slug || 'item'}`
}
