import { Button, HStack, Image, Spacer, SwipeActions, Text, VStack } from '@expo/ui/swift-ui'
import { contentShape, font, frame, onTapGesture, shapes, tint } from '@expo/ui/swift-ui/modifiers'

import type { TerminalInfo } from '@/lib/daemon/procedures/terminal'
import { type AppearanceScheme, ink } from '@/theme/colors'
import { monospace, secondary } from '@/theme/modifiers'

/**
 * Rename and Kill are swipe actions, not a trailing menu: the row is a tap target for the shell
 * itself, and an ellipsis button beside it competes with that for the same thumb. Full swipe is
 * off — the outermost action ends a process that may be an agent mid-run, and an over-swipe is not
 * the way to decide that. The confirm still stands behind it.
 */
export function TerminalSessionRow({
  onKill,
  onOpen,
  onRename,
  repoPath,
  scheme,
  session,
}: {
  onKill: () => void
  onOpen: () => void
  onRename: () => void
  repoPath: string | null
  scheme: AppearanceScheme
  session: TerminalInfo
}): React.JSX.Element {
  const relativeCwd = repoPath === null ? session.cwd : relativePath(session.cwd, repoPath)
  const detail = `${relativeCwd} · ${statusLabel(session)}`
  const statusColor = ink(session.status === 'running' ? 'green' : 'muted', scheme)

  return (
    <SwipeActions>
      {/*
        A tappable HStack, not a Button: a Button as the swipe host's content renders blank the
        moment the row opens, so you cannot see which shell you are about to kill. `contentShape`
        keeps the whole row — padding and Spacer included — inside the tap target.
      */}
      <HStack
        modifiers={[
          contentShape(shapes.rectangle()),
          frame({ maxWidth: Infinity }),
          onTapGesture(onOpen),
        ]}
        spacing={12}
      >
        <Image color={statusColor} size={18} systemName="terminal.fill" />
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ weight: 'semibold' })]}>{session.name}</Text>
          <Text modifiers={[monospace, secondary]}>{detail}</Text>
        </VStack>
        <Spacer />
      </HStack>
      {/*
        Declared edge-inward: Kill lands outermost, where iOS puts the destructive action.
        `role="destructive"` does not reach a swipe button — it renders in the accent like any
        other — so the red is an explicit tint, or Kill reads as safe as Rename.
      */}
      <SwipeActions.Actions allowsFullSwipe={false} edge="trailing">
        <Button
          label="Kill"
          modifiers={[tint(ink('red', scheme))]}
          onPress={onKill}
          role="destructive"
          systemImage="xmark.circle"
        />
        <Button label="Rename" onPress={onRename} systemImage="pencil" />
      </SwipeActions.Actions>
    </SwipeActions>
  )
}

function relativePath(path: string, repoPath: string): string {
  if (path === repoPath) return '.'
  const prefix = `${repoPath}/`
  return path.startsWith(prefix) ? path.slice(prefix.length) : path
}

function statusLabel(session: TerminalInfo): string {
  if (session.status === 'running') return 'running'
  return `exit ${session.exitCode ?? 0}`
}
