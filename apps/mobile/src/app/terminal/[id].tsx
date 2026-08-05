import { useLocalSearchParams } from 'expo-router'

import { TerminalSessionScreen } from '@/features/terminal/terminal-session-screen'

/** One live shell, pushed over the roster. The id is the daemon-minted session id. */
export default function TerminalSessionRoute(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <TerminalSessionScreen sessionId={id} />
}
