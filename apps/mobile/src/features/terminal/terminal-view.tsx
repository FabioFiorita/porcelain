import { NativeTerminalView } from './native-terminal-view'
import { resolvePorcelainTerminalNativeView } from './porcelain-terminal-native'
import { XtermTerminalView } from './xterm-terminal-view'

/**
 * One live terminal, on whichever backend the installed binary can render.
 *
 * Prefer the native Ghostty canvas whenever the installed development client contains it. An OTA
 * JS update can run against an older binary, though, so the previous xterm/React Native renderer
 * remains a deliberate compatibility fallback instead of crashing at requireNativeView.
 *
 * The two are whole sibling implementations with their own state, effects and gestures — they
 * live in their own files, split by backend the same way `native-terminal-buffer.ts` and
 * `xterm-host.ts` split the layer under them. This dispatcher is the only thing they share.
 */
export function TerminalView({ sessionId }: { sessionId: string }): React.JSX.Element {
  return resolvePorcelainTerminalNativeView() === null ? (
    <XtermTerminalView sessionId={sessionId} />
  ) : (
    <NativeTerminalView sessionId={sessionId} />
  )
}
