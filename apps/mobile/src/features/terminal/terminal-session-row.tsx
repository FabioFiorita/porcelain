import { Button, HStack, Image, Menu, Spacer, Text, VStack } from '@expo/ui/swift-ui'
import { buttonStyle, contentShape, font, frame, shapes } from '@expo/ui/swift-ui/modifiers'

import type { TerminalInfo } from '@/lib/daemon/procedures/terminal'
import { monospace, secondary } from '@/theme/modifiers'

export function TerminalSessionRow({
  onKill,
  onOpen,
  onRename,
  repoPath,
  session,
}: {
  onKill: () => void
  onOpen: () => void
  onRename: () => void
  repoPath: string | null
  session: TerminalInfo
}): React.JSX.Element {
  const relativeCwd = repoPath === null ? session.cwd : relativePath(session.cwd, repoPath)
  const detail = `${relativeCwd} · ${statusLabel(session)}`
  const tint = session.status === 'running' ? '#34C759' : '#8E8E93'

  return (
    <HStack spacing={8}>
      <Button
        modifiers={[
          buttonStyle('plain'),
          contentShape(shapes.rectangle()),
          frame({ maxWidth: Infinity }),
        ]}
        onPress={onOpen}
      >
        <HStack
          modifiers={[contentShape(shapes.rectangle()), frame({ maxWidth: Infinity })]}
          spacing={12}
        >
          <Image color={tint} size={18} systemName="terminal.fill" />
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ weight: 'semibold' })]}>{session.name}</Text>
            <Text modifiers={[monospace, secondary]}>{detail}</Text>
          </VStack>
          <Spacer />
        </HStack>
      </Button>
      <Menu label={<Image modifiers={[secondary]} size={18} systemName="ellipsis.circle" />}>
        <Button label="Rename" onPress={onRename} systemImage="pencil" />
        <Button label="Kill" onPress={onKill} role="destructive" systemImage="xmark.circle" />
      </Menu>
    </HStack>
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
