import { Button, ContentUnavailableView } from '@expo/ui/swift-ui'

import { type DaemonError, daemonErrorMessage } from '@/lib/daemon/errors'

/** The symbols this app's notices use — a literal union so no `SFSymbol` import is needed. */
type NoticeSymbol = 'doc.text' | 'checkmark.seal' | 'clock.arrow.circlepath' | 'text.alignleft'

/**
 * Loading, failed and empty in one row, for a query rendered inside a `List`. The daemon's own
 * message is shown verbatim — a rewritten git error is a debugging dead end — and a failed read
 * always offers the retry, because the usual cause is a phone that moved off the network.
 */
export function QueryNotice({
  description,
  error,
  isPending,
  onRetry,
  symbol,
  title,
}: {
  description: string
  error?: DaemonError | null
  isPending: boolean
  onRetry?: () => void
  symbol: NoticeSymbol
  title: string
}): React.JSX.Element {
  const failed = error !== undefined && error !== null

  return (
    <>
      <ContentUnavailableView
        description={failed ? daemonErrorMessage(error) : description}
        systemImage={symbol}
        title={failed ? 'Could not read the repo' : isPending ? 'Loading' : title}
      />
      {failed && onRetry !== undefined ? (
        <Button label="Retry" onPress={onRetry} systemImage="arrow.clockwise" />
      ) : null}
    </>
  )
}
