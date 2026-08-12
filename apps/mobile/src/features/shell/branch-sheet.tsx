import { Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { ShellModalScroll } from '@/components/shell-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text as UiText } from '@/components/ui/text'
import { type BranchRef, useGitBranchSheet, type Worktree } from '@/features/git'
import { WorkspaceCreateForm } from './workspace-create-form'
import { branchRowFacts, workspaceTestId } from './workspace-lists'
import {
  type CreatingPickerBodyProps,
  EmptyPickerState,
  ErrorState,
  PickerSection,
  WorkspaceRow,
} from './workspace-picker'

/** Searchable Local / Remote branch picker with the daemon's worktree guard. */
export function BranchSheetBody({
  creating,
  onCreatingChange,
  open,
}: CreatingPickerBodyProps): React.JSX.Element {
  const sheet = useGitBranchSheet(open, onCreatingChange)
  const { projectPath } = sheet

  if (projectPath === null) {
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
        daemonError={sheet.createError}
        existingBranches={sheet.existingBranches}
        fromLabel={sheet.currentBranch ?? 'HEAD'}
        pending={sheet.createPending}
        projectPath={projectPath}
        target="branch"
        onCancel={() => {
          onCreatingChange(false)
          sheet.clearCreateError()
        }}
        onSubmit={(branch) => {
          sheet.create(branch)
        }}
      />
    )
  }

  const typed = sheet.query.trim()
  return (
    <View className="gap-3" testID="porcelain-branch-sheet">
      <Input
        accessibilityLabel="Search branches"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Switch branch…"
        testID="porcelain-branch-search"
        value={sheet.query}
        onChangeText={sheet.setQuery}
      />
      {sheet.isLoading ? (
        <Text className="text-sm text-muted-foreground" testID="porcelain-branch-loading">
          Loading branches…
        </Text>
      ) : null}
      {sheet.loadError !== null ? (
        <ErrorState message={sheet.loadError} testID="porcelain-branch-error" />
      ) : null}
      {sheet.isEmpty ? (
        <EmptyPickerState
          body={typed ? `No branches match “${typed}”.` : 'This folder has no Git branches.'}
          testID="porcelain-branch-empty"
          title={typed ? 'No branches found' : 'No branches'}
        />
      ) : null}
      {!sheet.isLoading && sheet.loadError === null && !sheet.isEmpty ? (
        <ShellModalScroll className="max-h-80" contentContainerClassName="gap-3">
          {sheet.local.length > 0 ? (
            <PickerSection title="Local">
              {sheet.local.map((branch) => (
                <BranchRow
                  key={branch.name}
                  branch={branch}
                  currentBranch={sheet.currentBranch}
                  disabled={sheet.busy}
                  projectPath={projectPath}
                  worktrees={sheet.worktrees}
                  onPress={() => {
                    sheet.select(branch)
                  }}
                />
              ))}
            </PickerSection>
          ) : null}
          {sheet.remote.length > 0 ? (
            <PickerSection title="Remote">
              {sheet.remote.map((branch) => (
                <BranchRow
                  key={`${branch.remote}/${branch.name}`}
                  branch={branch}
                  currentBranch={sheet.currentBranch}
                  disabled={sheet.busy}
                  projectPath={projectPath}
                  worktrees={sheet.worktrees}
                  onPress={() => {
                    sheet.select(branch)
                  }}
                />
              ))}
            </PickerSection>
          ) : null}
          {sheet.local.length === 0 && sheet.remote.length === 0 ? (
            <Text className="px-2 py-6 text-center text-sm text-muted-foreground">
              No branches match “{typed}”.
            </Text>
          ) : null}
        </ShellModalScroll>
      ) : null}

      <Button
        accessibilityLabel="New branch"
        accessibilityRole="button"
        disabled={sheet.busy || sheet.createPending}
        testID="porcelain-workspace-new-branch"
        variant="outline"
        onPress={() => {
          sheet.clearCreateError()
          onCreatingChange(true)
        }}
      >
        <ChromeGlyph name="plus" size={16} tone="foreground" />
        <UiText>New branch…</UiText>
      </Button>

      {sheet.actionError ? (
        <ErrorState message={sheet.actionError} testID="porcelain-branch-action-error" />
      ) : null}
    </View>
  )
}

function BranchRow({
  branch,
  currentBranch,
  disabled,
  onPress,
  projectPath,
  worktrees,
}: {
  branch: BranchRef
  currentBranch: string | null
  disabled: boolean
  onPress: () => void
  projectPath: string
  worktrees: readonly Worktree[]
}): React.JSX.Element {
  const facts = branchRowFacts(branch, currentBranch, worktrees, projectPath)

  return (
    <WorkspaceRow
      accessibilityLabel={facts.accessibilityLabel}
      detail={facts.detail}
      disabled={disabled}
      glyph="branch"
      label={facts.label}
      selected={facts.selected}
      testID={workspaceTestId('branch-row', facts.label)}
      onPress={onPress}
    />
  )
}
