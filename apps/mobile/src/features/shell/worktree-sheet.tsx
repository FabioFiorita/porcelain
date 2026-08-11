import { Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { Button } from '@/components/ui/button'
import { Text as UiText } from '@/components/ui/text'
import { useWorktreeSheet } from './use-workspace'
import { WorkspaceCreateForm } from './workspace-create-form'
import { workspaceTestId } from './workspace-lists'
import {
  type CreatingPickerBodyProps,
  EmptyPickerState,
  ErrorState,
  PickerSection,
  WorkspaceRow,
} from './workspace-picker'

/** Worktree switcher: switching the row opens that checkout, including linked worktrees. */
export function WorktreeSheetBody({
  creating,
  onCreatingChange,
  open,
}: CreatingPickerBodyProps): React.JSX.Element {
  const sheet = useWorktreeSheet(open, onCreatingChange)
  const { repoPath } = sheet

  if (repoPath === null) {
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
        daemonError={sheet.createError}
        existingBranches={sheet.existingBranches}
        fromLabel={sheet.fromLabel}
        pending={sheet.busy}
        repoPath={repoPath}
        target="worktree"
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

  return (
    <View className="gap-3" testID="porcelain-worktree-sheet">
      {sheet.isLoading ? (
        <Text className="text-sm text-muted-foreground" testID="porcelain-worktree-loading">
          Loading worktrees…
        </Text>
      ) : null}
      {sheet.loadError !== null ? (
        <ErrorState message={sheet.loadError} testID="porcelain-worktree-error" />
      ) : null}
      {!sheet.isLoading && sheet.loadError === null && sheet.worktrees.length === 0 ? (
        <EmptyPickerState
          body="This project has no Git worktrees."
          testID="porcelain-worktree-empty"
          title="No worktrees"
        />
      ) : null}
      {sheet.worktrees.length > 0 ? (
        <PickerSection title="Worktrees">
          {sheet.worktrees.map((worktree) => (
            <WorkspaceRow
              key={worktree.path}
              detail={worktree.path}
              disabled={sheet.busyPath !== null}
              label={worktree.branch}
              selected={worktree.path === repoPath}
              testID={workspaceTestId('worktree-row', worktree.path)}
              onPress={() => {
                sheet.open(worktree.path)
              }}
            />
          ))}
        </PickerSection>
      ) : null}

      <Button
        accessibilityLabel="New worktree"
        accessibilityRole="button"
        disabled={sheet.busy}
        testID="porcelain-workspace-new-worktree"
        variant="outline"
        onPress={() => {
          sheet.clearCreateError()
          onCreatingChange(true)
        }}
      >
        <ChromeGlyph name="plus" size={16} tone="foreground" />
        <UiText>New worktree…</UiText>
      </Button>

      {sheet.actionError ? (
        <ErrorState message={sheet.actionError} testID="porcelain-worktree-action-error" />
      ) : null}
    </View>
  )
}
