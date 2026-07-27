import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import {
  type EnvironmentEndpoint,
  useAddEnvironmentEndpoint,
  usePreferEnvironmentEndpoint,
  useRemoveEnvironmentEndpoint,
} from '@renderer/hooks/use-remote-daemon'
import { compactButtonClass, compactInputClass, rowActionClass } from '@renderer/lib/controls'
import { cn } from '@renderer/lib/utils'
import { TestIds } from '@shared/test-ids'
import { X } from 'lucide-react'
import { useState } from 'react'

// Named after the network the address reaches the machine over, not after the config
// key — "tailnet"/"lan" are our words, not the human's. `other` gets "Direct" rather
// than nothing so every line has the same shape.
const KIND_LABELS = {
  tailnet: 'Tailscale',
  lan: 'Local network',
  other: 'Direct',
} as const

function EndpointRow({
  environmentId,
  endpoint,
  isLive,
  canRemove,
}: {
  environmentId: string
  endpoint: EnvironmentEndpoint
  isLive: boolean
  canRemove: boolean
}): React.JSX.Element {
  const { preferEndpoint, pendingUrl: preferringUrl } = usePreferEnvironmentEndpoint()
  const { removeEndpoint, pendingUrl: removingUrl } = useRemoveEnvironmentEndpoint()

  return (
    <li className="flex items-center gap-2" data-testid={TestIds.environmentEndpoint(endpoint.url)}>
      <span className="truncate font-mono text-xs text-muted-foreground">{endpoint.url}</span>
      <span className="shrink-0 text-2xs text-muted-foreground">{KIND_LABELS[endpoint.kind]}</span>
      {isLive && (
        <Badge
          variant="outline"
          className="shrink-0 rounded-md border-border/60 text-2xs text-muted-foreground"
        >
          Live
        </Badge>
      )}
      {endpoint.preferred && (
        <Badge
          variant="outline"
          className="shrink-0 rounded-md border-border/60 text-2xs text-muted-foreground"
        >
          Preferred
        </Badge>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {/* Absent, not disabled, once preferred: the badge already says it, and a dead
            button on every line would outweigh the environment's own actions. */}
        {!endpoint.preferred && (
          <Button
            variant="ghost"
            size="sm"
            className={rowActionClass}
            disabled={preferringUrl === endpoint.url}
            onClick={() => preferEndpoint({ id: environmentId, url: endpoint.url })}
          >
            Prefer
          </Button>
        )}
        {canRemove && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={removingUrl === endpoint.url}
                  onClick={() => removeEndpoint({ id: environmentId, url: endpoint.url })}
                  aria-label={`Remove ${endpoint.url}`}
                >
                  <X />
                </Button>
              }
            />
            <TooltipContent>Remove address</TooltipContent>
          </Tooltip>
        )}
      </div>
    </li>
  )
}

/**
 * Every way in to one saved environment (phase 5: one identity, many endpoints) —
 * the same machine is a LAN address at home and a tailnet address away, and connecting
 * walks them in preference order. Secondary detail under the environment's own row:
 * muted type, ghost controls, so Use here / New window stay the headline.
 *
 * "Prefer" pins the KIND of that address, not the address, so it survives a new DHCP
 * lease. "Live" comes from the status probe (which endpoint actually answered), so it
 * can disagree with the preferred one — that IS the failover working, not a bug.
 */
export function EnvironmentEndpoints({
  environmentId,
  endpoints,
  liveEndpoint,
}: {
  environmentId: string
  endpoints: EnvironmentEndpoint[]
  liveEndpoint: string | null
}): React.JSX.Element {
  const { addEndpoint, isPending, error } = useAddEnvironmentEndpoint()
  const [showAdd, setShowAdd] = useState(false)
  const [url, setUrl] = useState('')

  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-col gap-0.5">
        {endpoints.map((endpoint) => (
          <EndpointRow
            key={endpoint.url}
            environmentId={environmentId}
            endpoint={endpoint}
            isLive={endpoint.url === liveEndpoint}
            // The last address is the environment: removing it would leave a row with
            // no way in, so that's a Remove environment, not a Remove address.
            canRemove={endpoints.length > 1}
          />
        ))}
      </ul>
      {showAdd ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Input
              className={cn(compactInputClass, 'font-mono')}
              placeholder="http://my-server.local:43117"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isPending}
              aria-label="Address"
            />
            <Button
              variant="default"
              size="sm"
              className={compactButtonClass}
              disabled={isPending || url.trim() === ''}
              onClick={async () => {
                // Only clear on success — a rejected address is usually a typo, and
                // retyping the whole url to fix one character is the wrong penalty.
                if (await addEndpoint({ id: environmentId, url })) {
                  setUrl('')
                  setShowAdd(false)
                }
              }}
            >
              {isPending ? 'Adding…' : 'Add'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={compactButtonClass}
              disabled={isPending}
              onClick={() => {
                setShowAdd(false)
                setUrl('')
              }}
            >
              Cancel
            </Button>
          </div>
          {error != null && <p className="text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className={cn('self-start', rowActionClass)}
          onClick={() => setShowAdd(true)}
        >
          Add address
        </Button>
      )}
    </div>
  )
}
