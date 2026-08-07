import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import {
  ActionSheet,
  ConfirmDialog,
  EmptyNote,
  ErrorNote,
  IconAction,
  type SheetAction,
} from '@/components/surface-chrome'
import { SurfaceList } from '@/components/surface-scroll'
import { useActiveRepo } from '@/lib/daemon/repo'
import { cn } from '@/lib/utils'

import { TerminalRenameDialog } from './terminal-rename-dialog'
import { type TerminalSession, useTerminalStore } from './terminal-store'
import { useRenameTerminal, useTerminals } from './use-terminals'

/**
 * The roster of open shells: the tablet's supplementary column, and the phone tab's root list.
 *
 * A session is independent of whatever is showing it. Leaving a terminal — closing the screen,
 * switching tabs, backgrounding the app — keeps the PTY running on the daemon, which is the
 * whole point: the dev server you started this morning is still there this afternoon, and this
 * list is how you get back to it. Only the explicit kill ends a shell.
 */
export function TerminalList({
  active,
  onOpenSession,
}: {
  active: boolean
  /** Phone: push the session's route. Omitted on tablet, which selects into its viewer. */
  onOpenSession?: (id: string) => void
}): React.JSX.Element {
  const repo = useActiveRepo()
  const { error, isLoading, sessions } = useTerminals(active)
  const selectedId = useTerminalStore((state) => state.selectedId)
  const select = useTerminalStore((state) => state.select)
  const spawn = useTerminalStore((state) => state.spawn)
  const close = useTerminalStore((state) => state.close)
  const rename = useRenameTerminal()

  const [menuFor, setMenuFor] = useState<TerminalSession | null>(null)
  const [renaming, setRenaming] = useState<TerminalSession | null>(null)
  const [killing, setKilling] = useState<TerminalSession | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const open = (id: string): void => {
    select(id)
    onOpenSession?.(id)
  }

  // Every write here is a daemon round trip that can fail — a dead socket, a repo that moved.
  // Say so on the header rather than letting a tap look like it worked.
  const guard = (label: string, run: () => Promise<unknown>): void => {
    setFailure(null)
    run().catch((cause: unknown) => {
      setFailure(`${label}: ${cause instanceof Error ? cause.message : String(cause)}`)
    })
  }

  const handleNew = (): void => {
    if (repo === null) return
    guard('New terminal failed', async () => {
      const id = await spawn({ cwd: repo.path })
      onOpenSession?.(id)
    })
  }

  const rowActions = (session: TerminalSession): SheetAction[] => [
    {
      glyph: 'notebook',
      id: 'rename',
      label: 'Rename',
      onPress: () => {
        setRenaming(session)
      },
    },
    {
      destructive: true,
      glyph: 'trash',
      id: 'kill',
      label: session.status === 'exited' ? 'Remove from list' : 'Kill terminal',
      onPress: () => {
        setKilling(session)
      },
    },
  ]

  return (
    <View className="flex-1" testID="porcelain-terminal-list">
      <View className="flex-row items-center gap-1 px-4 pb-2 pt-3">
        <Text
          className="min-w-0 flex-1 text-xs text-muted-foreground"
          testID="porcelain-terminal-summary"
        >
          {summaryLabel(sessions, isLoading, repo !== null)}
        </Text>
        {/* Hung out by half the icon button's slack so the glyph — not its 36pt box — lands
            on the same gutter as the summary beside it. */}
        <View className="-mr-2">
          <IconAction
            accessibilityLabel="New terminal"
            disabled={repo === null}
            glyph="plus"
            testID="porcelain-terminal-new"
            onPress={handleNew}
          />
        </View>
      </View>

      {failure === null ? null : (
        <View className="px-4 pb-2">
          <ErrorNote message={failure} testID="porcelain-terminal-action-error" />
        </View>
      )}
      {error === null ? null : (
        <View className="px-4 pb-2">
          <ErrorNote message={error.message} testID="porcelain-terminal-error" />
        </View>
      )}

      {sessions.length === 0 && !isLoading ? (
        <EmptyNote
          body={
            repo === null
              ? 'Open a project first — a shell needs somewhere to run.'
              : 'Start one with +, or run a saved action from the companion.'
          }
          testID="porcelain-terminal-empty"
          title="No terminals"
        />
      ) : (
        <SurfaceList
          data={sessions}
          gap={2}
          keyExtractor={(session: TerminalSession) => session.id}
          renderItem={({ item }) => (
            <TerminalRow
              selected={item.id === selectedId}
              session={item}
              onLongPress={() => {
                setMenuFor(item)
              }}
              onPress={() => {
                open(item.id)
              }}
            />
          )}
          testID="porcelain-terminal-rows"
        />
      )}

      <ActionSheet
        actions={menuFor === null ? [] : rowActions(menuFor)}
        open={menuFor !== null}
        subtitle={menuFor?.status === 'exited' ? 'Exited' : 'Running'}
        testID="porcelain-terminal-row-menu"
        title={menuFor?.name ?? ''}
        onClose={() => {
          setMenuFor(null)
        }}
      />

      <TerminalRenameDialog
        key={renaming?.id ?? 'none'}
        initialName={renaming?.name ?? ''}
        open={renaming !== null}
        onClose={() => {
          setRenaming(null)
        }}
        onRename={(name) => {
          const target = renaming
          setRenaming(null)
          if (target !== null) guard('Rename failed', () => rename(target.id, name))
        }}
      />

      <ConfirmDialog
        body={
          killing?.status === 'exited'
            ? 'This shell has already finished. Removing it drops its final output from this list.'
            : 'The shell and anything running in it end now. Output that has not been read is lost.'
        }
        confirmLabel={killing?.status === 'exited' ? 'Remove' : 'Kill'}
        open={killing !== null}
        testID="porcelain-terminal-kill-confirm"
        title={killing === null ? '' : `Kill ${killing.name}?`}
        onCancel={() => {
          setKilling(null)
        }}
        onConfirm={() => {
          const target = killing
          setKilling(null)
          if (target !== null) close(target.id)
        }}
      />
    </View>
  )
}

function summaryLabel(
  sessions: readonly TerminalSession[],
  isLoading: boolean,
  hasRepo: boolean,
): string {
  if (!hasRepo) return 'No project open'
  // Until the first read lands there is no honest count to print — "no terminals" would read
  // as a fact about the daemon rather than about this client.
  if (isLoading && sessions.length === 0) return 'Loading terminals…'
  const running = sessions.filter((session) => session.status === 'running').length
  const exited = sessions.length - running
  if (sessions.length === 0) return 'No terminals'
  return `${running} running${exited > 0 ? ` · ${exited} exited` : ''}`
}

function TerminalRow({
  onLongPress,
  onPress,
  selected,
  session,
}: {
  onLongPress: () => void
  onPress: () => void
  selected: boolean
  session: TerminalSession
}): React.JSX.Element {
  const exited = session.status === 'exited'
  return (
    <Pressable
      accessibilityLabel={`${session.name}, ${exited ? 'exited' : 'running'}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        'min-h-12 flex-row items-center gap-2.5 rounded-xl border border-transparent px-3 py-2.5 active:bg-accent',
        selected && 'border-border bg-muted/70',
      )}
      testID={`porcelain-terminal-row-${session.id}`}
      onLongPress={onLongPress}
      onPress={onPress}
    >
      <ChromeGlyph name="terminal" size={16} tone={exited ? 'muted' : 'foreground'} />
      <Text
        className={cn(
          'min-w-0 flex-1 text-sm font-medium',
          exited ? 'text-muted-foreground' : 'text-foreground',
        )}
        numberOfLines={1}
      >
        {session.name}
      </Text>
      {exited ? (
        <Text className="text-[10px] uppercase tracking-widest text-muted-foreground">exited</Text>
      ) : (
        <View className="size-2 rounded-full bg-success" />
      )}
    </Pressable>
  )
}
