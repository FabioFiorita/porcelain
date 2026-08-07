import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { ConfirmDialog, EmptyNote, ErrorNote, PanelLabel } from '@/components/surface-chrome'
import type { TerminalAction } from '@/lib/daemon/procedures/terminal'
import { useActiveRepo } from '@/lib/daemon/repo'
import { cn } from '@/lib/utils'

import { useTerminalStore } from './terminal-store'
import { useTerminalActions, useTrustAction } from './use-terminals'

/**
 * Saved actions — the repo's curated commands.
 *
 * Running one spawns a shell named after it with the command typed in, and the shell STAYS
 * live afterwards, so you can read the output, interrupt it, or run it again. That is why an
 * action is a terminal rather than a fire-and-forget RPC.
 *
 * Agents curate this list but never execute from it; running is human-only. A command this
 * daemon's machine has not accepted yet is gated behind an explicit confirmation, because a
 * shared action can arrive from a clone or an agent write — accepting is keyed to the command
 * TEXT, so editing it later asks again.
 */
export function TerminalCompanion({ active }: { active: boolean }): React.JSX.Element {
  const repo = useActiveRepo()
  const { actions, error } = useTerminalActions(active)
  const spawn = useTerminalStore((state) => state.spawn)
  const trust = useTrustAction()
  const [pendingTrust, setPendingTrust] = useState<TerminalAction | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const run = (action: TerminalAction): void => {
    if (repo === null) return
    setFailure(null)
    spawn({ cwd: repo.path, initialInput: action.command, name: action.title }).catch(
      (cause: unknown) => {
        setFailure(`Run failed: ${cause instanceof Error ? cause.message : String(cause)}`)
      },
    )
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-3 px-[16px] pb-8 pt-3"
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
          body="Commands the agent saves for this repo show up here, ready to run in a shell."
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
                if (action.trusted) run(action)
                else setPendingTrust(action)
              }}
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
        testID="porcelain-terminal-trust-confirm"
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
              run(action)
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
}: {
  action: TerminalAction
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={`Run ${action.title}`}
      accessibilityRole="button"
      className={cn(
        'min-h-12 flex-row items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 active:bg-accent',
      )}
      testID={`porcelain-terminal-action-${action.id}`}
      onPress={onPress}
    >
      <ChromeGlyph name={action.trusted ? 'terminal' : 'info'} size={15} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {action.title}
        </Text>
        <Text className="font-mono text-[11px] text-muted-foreground" numberOfLines={1}>
          {action.command}
        </Text>
      </View>
      <ChromeGlyph name="chevronRight" size={14} />
    </Pressable>
  )
}
