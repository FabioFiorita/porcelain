import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  browserEnvironmentConnections,
  removeBrowserEnvironmentConnection,
  useEnvironmentSessionsRevision,
} from '@renderer/lib/environment-sessions'
import { TestIds } from '@shared/test-ids'
import { X } from 'lucide-react'
import { useMemo } from 'react'

/**
 * The browser tab is served by one daemon. Extra remotes belong in the Mac app.
 * Leftover saved connections can be removed; new ones are not added here.
 */
export function BrowserRemotesSection(): React.JSX.Element {
  const revision = useEnvironmentSessionsRevision()
  const leftovers = useMemo(() => browserEnvironmentConnections(revision), [revision])

  return (
    <div className="flex flex-col gap-3" data-testid={TestIds.browserEnvironmentConnections}>
      <div className="rounded-md border border-border/60 p-3">
        <p className="text-sm-minus font-medium">This tab</p>
        <p className="text-xs text-muted-foreground">
          The browser is this daemon. Open a pairing link in a new tab to use a different one.
        </p>
        <Badge variant="outline" className="mt-2 rounded-md text-2xs text-muted-foreground">
          One environment
        </Badge>
      </div>
      {leftovers.length > 0 && (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
          {leftovers.map((connection) => (
            <li
              key={connection.id}
              className="flex items-center justify-between gap-3 p-3"
              data-testid={TestIds.browserEnvironmentConnection(connection.id)}
            >
              <div className="min-w-0">
                <p className="text-sm-minus font-medium">{connection.name}</p>
                <p className="truncate font-mono text-2xs-plus text-muted-foreground">
                  {connection.url}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${connection.name}`}
                onClick={(): void => removeBrowserEnvironmentConnection(connection.id)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        To share this daemon, create a pairing link on the host — Settings → Share in the Mac app
        when it is this device, or `porcelain-daemon access issue`. The Mac app can keep several
        named environments and fall back LAN → Tailscale → Cloudflare.
      </p>
    </div>
  )
}
