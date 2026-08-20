import type { ActionView } from '@porcelain/contracts/actions'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { ConfirmDialog, EmptyNote, ErrorNote, PanelLabel } from '@/components/surface-chrome'
import { useHubRepoPath } from '@/features/projects'
import { cn } from '@/lib/utils'
import { useActionRun } from './action-run'
import { useTrustAction } from './actions-mutations'
import { useActions } from './actions-queries'
import { useActionsSelectionStore } from './actions-selection-store'

/**
 * Saved actions — the project's curated commands.
 *
 * Running one spawns a shell named after it with the command typed in, and the shell STAYS
 * live afterwards, so you can read the output, interrupt it, or run it again. That is why an
 * action is a terminal rather than a fire-and-forget RPC.
 *
 * Agents curate this list but never execute from it; running is human-only. A command this
 * daemon's machine has not accepted yet is gated behind an explicit confirmation, because a
 * shared action can arrive from a clone or an agent write — accepting is keyed to the command
 * TEXT, so editing it later asks again.
 *
 * Placement remains under the Terminal surface (companion slot); ownership is Actions.
 */
export function ActionsCompanion({ active }: { active: boolean }): React.JSX.Element {
  const repoPath = useHubRepoPath()
  const { actions, error } = useActions(active)
  const runAction = useActionRun()
  const trust = useTrustAction()
  const selectedActionId = useActionsSelectionStore((state) => state.selectedActionId)
  const clearSelectedAction = useActionsSelectionStore((state) => state.clearSelectedAction)
  const [pendingTrust, setPendingTrust] = useState<ActionView | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const run = (action: ActionView): void => {
    if (repoPath === null) return
    setFailure(null)
    runAction(action).catch((cause: unknown) => {
      setFailure(`Run failed: ${cause instanceof Error ? cause.message : String(cause)}`)
    })
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-3 px-4 pb-8 pt-3"
      showsVerticalScrollIndicator={false}
      testID="porcelain-terminal-companion"
    >
      <PanelLabel>Actions</PanelLabel>

      {failure === null ? null : (
        <ErrorNote message={failure} testID="porcelain-terminal-run-error" />
      )}
      {error === null ? null : (
        <ErrorNote message={error.message} testID="porcelain-terminal-actions-error" />
      )}

      {actions.length === 0 ? (
        <EmptyNote
          body="Commands the agent saves for this project show up here, ready to run in a shell."
          testID="porcelain-terminal-actions-empty"
          title="No saved actions"
        />
      ) : (
        <View className="gap-1.5">
          {actions.map((action) => (
            <ActionRow
              key={action.id}
              action={action}
              onPress={() => {
                clearSelectedAction()
                if (action.trusted) run(action)
                else setPendingTrust(action)
              }}
              selected={action.id === selectedActionId}
            />
          ))}
        </View>
      )}

      <ConfirmDialog
        body={
          pendingTrust === null
            ? ''
            : `This machine has not run this command before:\n\n${pendingTrust.command}\n\nAccepting remembers it. Editing the command later asks again.`
        }
        confirmLabel="Accept and run"
        open={pendingTrust !== null}
        title="Run this command?"
        onCancel={() => {
          setPendingTrust(null)
        }}
        onConfirm={() => {
          const action = pendingTrust
          setPendingTrust(null)
          if (action === null) return
          setFailure(null)
          trust(action.id)
            .then(() => {
              // List refetch is async; prepare requires trusted — pass explicit true.
              run({ ...action, trusted: true })
            })
            .catch((cause: unknown) => {
              setFailure(`Accept failed: ${cause instanceof Error ? cause.message : String(cause)}`)
            })
        }}
      />
    </ScrollView>
  )
}

function ActionRow({
  action,
  onPress,
  selected,
}: {
  action: ActionView
  onPress: () => void
  selected: boolean
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`Run ${action.title}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      /* panel-card-allow: a quick-command chip, not a panel card — its radius belongs to the
         40pt control family the header chips set, not to the card family. */
      className={cn(
        'min-h-12 flex-row items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 active:bg-accent',
        selected && 'border-primary bg-primary/10',
      )}
      testID={`porcelain-terminal-action-${action.id}`}
      onPress={onPress}
    >
      <ChromeGlyph name={action.trusted ? 'terminal' : 'info'} size={15} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {action.title}
        </Text>
        <Text className="font-mono text-2xs text-muted-foreground" numberOfLines={1}>
          {action.command}
        </Text>
      </View>
      <ChromeGlyph name="chevronRight" size={14} />
    </Pressable>
  )
}
