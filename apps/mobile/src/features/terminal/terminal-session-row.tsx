import { Pressable, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { RowContextMenu, type RowMenuAction } from '@/components/ui/row-context-menu'
import { SURFACE_ROW } from '@/components/surface-layout'
import { cn } from '@/lib/utils'

import type { TerminalSession } from './terminal-store'

/**
 * One shell in the Terminals list.
 *
 * A tap opens it full screen; a long press opens the platform's own context menu, which is
 * where rename and kill live. The web board hangs an X off the row on hover — there is no
 * hover here, and a destructive control sitting under a thumb on a scrolling list is how a
 * shell gets killed by accident.
 */
export function TerminalSessionRow({
  onKill,
  onOpen,
  onRename,
  session,
}: {
  onKill: () => void
  onOpen: () => void
  onRename: () => void
  session: TerminalSession
}): React.JSX.Element {
  const exited = session.status === 'exited'
  const actions: RowMenuAction[] = [
    { glyph: 'pencil', id: 'rename', label: 'Rename', onPress: onRename },
    {
      destructive: true,
      glyph: 'trash',
      id: 'kill',
      label: exited ? 'Remove from list' : 'Kill terminal',
      onPress: onKill,
    },
  ]

  return (
    <RowContextMenu
      actions={actions}
      testID={`porcelain-terminals-row-menu-${session.id}`}
      title={session.name}
    >
      <Pressable
        accessibilityLabel={`${session.name}, ${exited ? 'exited' : 'running'}`}
        accessibilityRole="button"
        className={cn('min-h-12 flex-row items-center gap-2.5 py-2.5', SURFACE_ROW)}
        testID={`porcelain-terminals-row-${session.id}`}
        onPress={onOpen}
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
          <Text className="text-3xs uppercase tracking-widest text-muted-foreground">exited</Text>
        ) : (
          <View className="size-2 rounded-full bg-success" />
        )}
      </Pressable>
    </RowContextMenu>
  )
}
