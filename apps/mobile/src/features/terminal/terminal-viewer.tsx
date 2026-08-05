import { View } from 'react-native'

import { EmptyNote } from '@/components/surface-chrome'

import { useTerminalStore } from './terminal-store'
import { TerminalView } from './terminal-view'

/**
 * The tablet's viewer column: whichever session the roster last selected.
 *
 * Keyed by session id so each shell gets its own view — the emulator itself is shared from the
 * registry, but the pane's measured grid and keyboard state belong to the session on screen.
 */
export function TerminalViewer(): React.JSX.Element {
  const selectedId = useTerminalStore((state) => state.selectedId)

  if (selectedId === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <EmptyNote
          body="Pick a terminal from the list, or start one with +."
          testID="porcelain-terminal-viewer-empty"
          title="No terminal open"
        />
      </View>
    )
  }

  return <TerminalView key={selectedId} sessionId={selectedId} />
}
