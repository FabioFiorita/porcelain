import { ENVIRONMENT_GROUP_KEY, type TerminalGroup } from '@porcelain/client-runtime/terminal'
import { useIsFocused, useRouter } from 'expo-router'
import { Fragment, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import {
  ConfirmDialog,
  EmptyNote,
  ErrorNote,
  IconAction,
  ScreenHeader,
} from '@/components/surface-chrome'
import { SURFACE_GUTTER, SURFACE_NOTE } from '@/components/surface-layout'
import { SurfaceScroll } from '@/components/surface-scroll'
import { isPaired, useActiveEnvironment } from '@/features/remote'
import { cn } from '@/lib/utils'

import { TerminalLocationSheet } from './terminal-location-sheet'
import { TerminalRenameDialog } from './terminal-rename-dialog'
import { useRefreshTerminals, useRenameTerminal, useTerminals } from './terminal-roster'
import { TerminalSessionRow } from './terminal-session-row'
import { type TerminalSession, useTerminalStore } from './terminal-store'
import {
  ENVIRONMENT_SHELLS,
  type EnvironmentShell,
  newTerminalOptions,
  rosterSummary,
  runningShellNamed,
} from './terminals-board-model'
import { useTerminalsBoard } from './use-terminals-board'

/**
 * Terminals: the ONE place a shell is listed in this app.
 *
 * It leads with the Environment's own shells — the daemon host's home, where a multiplexer or
 * an agent herd lives — and lists the Project · Worktree groups under it, resolved by longest
 * `cwd` prefix because a daemon terminal carries no project id on the wire. The per-Worktree
 * Terminal surface is gone: two terminal homes is how a long-running shell becomes unreachable
 * from whichever one you happen to be standing in.
 *
 * Deliberately NOT scoped to the selected checkout. A dev server started this morning stays
 * reachable while you review a different Project, and the daemon owns the session, so the list
 * survives the app closing.
 */
export function TerminalsScreen(): React.JSX.Element {
  const focused = useIsFocused()
  const router = useRouter()
  const environment = useActiveEnvironment()
  const { error, isLoading, sessions } = useTerminals(focused)
  const board = useTerminalsBoard(focused, sessions)
  const spawn = useTerminalStore((state) => state.spawn)
  const close = useTerminalStore((state) => state.close)
  const rename = useRenameTerminal()
  const refresh = useRefreshTerminals()

  const [picking, setPicking] = useState(false)
  const [renaming, setRenaming] = useState<TerminalSession | null>(null)
  const [killing, setKilling] = useState<TerminalSession | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const open = (id: string): void => {
    router.push({ params: { id }, pathname: '/terminals/[id]' })
  }

  // Every write here is a daemon round trip that can fail — a dead socket, a worktree that
  // moved. Say so on the list rather than letting a tap look like it worked.
  const guard = (label: string, run: () => Promise<unknown>): void => {
    setFailure(null)
    run().catch((cause: unknown) => {
      setFailure(`${label}: ${cause instanceof Error ? cause.message : String(cause)}`)
    })
  }

  const spawnAt = (cwd: string, opts?: { name?: string; initialInput?: string }): void => {
    guard('New terminal failed', async () => {
      const id = await spawn({ cwd, ...opts })
      // Refresh BEFORE opening, and keep that order: `hydrate` replaces the roster outright, so
      // a poll already in flight when the shell was created would drop the optimistic row and
      // land the session screen on "This terminal is gone".
      await refresh()
      open(id)
    })
  }

  /** Find this Environment shell by name before starting a second one. */
  const openEnvironmentShell = (shell: EnvironmentShell): void => {
    const existing = runningShellNamed(board.environmentSessions, shell.name)
    if (existing !== null) {
      open(existing.id)
      return
    }
    if (board.environmentRoot === null) return
    spawnAt(board.environmentRoot, { initialInput: shell.initialInput, name: shell.name })
  }

  const groups = board.groups.filter((group) => group.key !== ENVIRONMENT_GROUP_KEY)

  const rowFor = (session: TerminalSession): React.JSX.Element => (
    <TerminalSessionRow
      key={session.id}
      session={session}
      onKill={() => {
        setKilling(session)
      }}
      onOpen={() => {
        open(session.id)
      }}
      onRename={() => {
        setRenaming(session)
      }}
    />
  )

  return (
    <View className="flex-1 bg-background" testID="porcelain-terminals-screen">
      {/* Both items belong to state living here: the picker is a sheet this screen owns, and
          Actions is a route. */}
      <ScreenHeader
        actions={
          <>
            <IconAction
              accessibilityLabel="Actions"
              glyph="companion"
              testID="porcelain-terminals-actions"
              tone="foreground"
              onPress={() => {
                router.push('/terminals/actions')
              }}
            />
            <IconAction
              accessibilityLabel="New terminal"
              glyph="plus"
              testID="porcelain-terminals-new"
              tone="foreground"
              onPress={() => {
                setPicking(true)
              }}
            />
          </>
        }
        testID="porcelain-terminals-header"
        title="Terminals"
      />

      <SurfaceScroll edgeToEdge gap={2} paddingTop={4}>
        <Text
          className={cn(SURFACE_GUTTER, 'pb-1 text-xs text-muted-foreground')}
          testID="porcelain-terminals-summary"
        >
          {rosterSummary(sessions, { isLoading, paired: isPaired(environment) })}
        </Text>

        {failure === null ? null : (
          <View className={SURFACE_NOTE}>
            <ErrorNote message={failure} testID="porcelain-terminals-action-error" />
          </View>
        )}
        {error === null ? null : (
          <View className={SURFACE_NOTE}>
            <ErrorNote message={error.message} testID="porcelain-terminals-error" />
          </View>
        )}

        {/* The Environment leads, and it is here even with nothing running on it: the
            multiplexer shortcuts are how a herd gets started in the first place. */}
        <GroupHeading label={board.environmentLabel}>
          {ENVIRONMENT_SHELLS.map((shell) => (
            <Pressable
              key={shell.key}
              accessibilityLabel={`Open ${shell.label} on ${board.environmentLabel}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: board.environmentRoot === null }}
              className={cn(
                'min-h-8 flex-row items-center gap-1 rounded-lg border border-border px-2 py-1 active:bg-accent',
                board.environmentRoot === null && 'opacity-40',
              )}
              disabled={board.environmentRoot === null}
              testID={`porcelain-terminals-shell-${shell.key}`}
              onPress={() => {
                openEnvironmentShell(shell)
              }}
            >
              <ChromeGlyph name="layers" size={13} tone="muted" />
              <Text className="text-2xs font-medium text-foreground">{shell.label}</Text>
            </Pressable>
          ))}
        </GroupHeading>
        {board.environmentSessions.map(rowFor)}

        {/* Fragments, not wrapper views: the scroll container's row gap only reaches its own
            children, and a group in a box would lose the rhythm the Environment rows keep. */}
        {groups.map((group: TerminalGroup) => (
          <Fragment key={group.key}>
            <GroupHeading
              detail={group.worktreeName === null ? undefined : group.worktreeName}
              label={group.label}
            />
            {group.sessions.map(rowFor)}
          </Fragment>
        ))}

        {sessions.length === 0 ? (
          <EmptyNote
            body="Start one with +, or open herdr on this environment."
            testID="porcelain-terminals-empty"
            title="No terminals running"
          />
        ) : null}
      </SurfaceScroll>

      <TerminalLocationSheet
        open={picking}
        options={newTerminalOptions({
          environmentLabel: board.environmentLabel,
          environmentRoot: board.environmentRoot,
          locations: board.locations,
        })}
        onClose={() => {
          setPicking(false)
        }}
        onPick={(option) => {
          setPicking(false)
          spawnAt(option.path)
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
        title={killing === null ? '' : `Kill ${killing.name}?`}
        onCancel={() => {
          setKilling(null)
        }}
        onConfirm={() => {
          const target = killing
          setKilling(null)
          if (target === null) return
          close(target.id)
          guard('Refresh failed', refresh)
        }}
      />
    </View>
  )
}

/** A group's caption: the Project (or the Environment), its Worktree, and any controls. */
function GroupHeading({
  children,
  detail,
  label,
}: {
  children?: React.ReactNode
  detail?: string
  label: string
}): React.JSX.Element {
  return (
    <View className={cn(SURFACE_GUTTER, 'flex-row items-center gap-2 pb-1 pt-3')}>
      <Text className="min-w-0 shrink text-xs font-semibold text-foreground" numberOfLines={1}>
        {label}
      </Text>
      {detail === undefined ? null : (
        <Text className="min-w-0 shrink text-xs text-muted-foreground" numberOfLines={1}>
          {detail}
        </Text>
      )}
      <View className="flex-1" />
      {children}
    </View>
  )
}
