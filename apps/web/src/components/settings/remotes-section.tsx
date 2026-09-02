import {
  endpointKind,
  isCloudflareEndpoint,
  type WslDistribution,
  type WslReadinessIssue,
} from '@porcelain/contracts'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import {
  type EnvironmentStatus,
  useEnvironmentStatuses,
  usePairEnvironmentConnection,
  useRemoteEnvironments,
  useRemoveEnvironmentEndpoint,
  useRemoveRemoteEnvironment,
  useWslDistributions,
} from '@renderer/features/remote'
import { compactButtonClass } from '@renderer/lib/controls'
import { cn } from '@renderer/lib/utils'
import { platformLabel } from '@shared/platform'
import { TestIds } from '@shared/test-ids'
import { Cloud, Monitor, Terminal, X } from 'lucide-react'
import { useState } from 'react'
import { EnvironmentName } from './environment-name'

function describeStatus(status: EnvironmentStatus | undefined): string {
  if (status === undefined) return 'Checking…'
  if (status.state === 'offline') return 'Not reachable'
  if (status.state === 'unauthorized') return 'Reachable, but the saved token was rejected'
  const machine =
    status.host !== null && status.platform !== null
      ? `${status.host} · ${platformLabel(status.platform)}`
      : (status.host ?? 'Online')
  return status.version !== null ? `${machine} · daemon ${status.version}` : machine
}

/** The first label that is actually a label — a blank string is not one. */
function firstLabel(...candidates: (string | null | undefined)[]): string | null {
  return candidates.find((value) => value != null && value !== '') ?? null
}

function endpointLabel(url: string): string {
  switch (endpointKind(url)) {
    case 'lan':
      return 'LAN'
    case 'tailnet':
      return 'Tailscale'
    case 'other':
      return isCloudflareEndpoint(url) ? 'Cloudflare' : 'Internet'
  }
}

function activeRoute(status: EnvironmentStatus | undefined): string | null {
  if (status?.state !== 'online' || status.endpoint === null) return null
  return endpointLabel(status.endpoint)
}

const WSL_ISSUE_LABELS: Record<WslReadinessIssue, string> = {
  'unsupported-version': 'Upgrade this distribution to WSL 2',
  'probe-failed': 'Could not inspect this distribution',
  'node-missing': 'Install Node.js 22 or newer inside this distribution',
  'node-too-old': 'Upgrade Node.js to version 22 or newer inside this distribution',
  'npx-missing': 'Install npx inside this distribution',
  'git-missing': 'Install Git inside this distribution',
}

function describeWslReadiness(distribution: WslDistribution): string {
  if (distribution.ready) return 'Ready to host a Porcelain Linux Environment'
  return distribution.issues.map((issue) => WSL_ISSUE_LABELS[issue]).join(' · ')
}

/**
 * Each saved environment is a group of verified connections. A group of one is the normal
 * starting point; pairing another link adds a route to this same card.
 */
export function RemotesSection(): React.JSX.Element {
  return <ElectronRemotesSection />
}

function ElectronRemotesSection(): React.JSX.Element {
  const data = useRemoteEnvironments()
  const statuses = useEnvironmentStatuses()
  const { pair, isPending: isPairing, error } = usePairEnvironmentConnection()
  const { remove, pendingId: removingId } = useRemoveRemoteEnvironment()
  const { remove: removeEndpoint } = useRemoveEnvironmentEndpoint()
  const wslDistributions = useWslDistributions()
  const [connectionLink, setConnectionLink] = useState('')
  const [pairingTargetId, setPairingTargetId] = useState<string | null>(null)
  const [showPairing, setShowPairing] = useState(false)

  const environments = data?.environments ?? []
  const localStatus = statuses.get(null)
  // The nickname first, then the machine name, then the role label. With two daemons on this
  // machine the middle one is the SAME string twice — that is the confusion the nickname ends.
  const localName = firstLabel(localStatus?.name, localStatus?.host) ?? 'This device'

  function showPairForm(groupId: string | null): void {
    setPairingTargetId(groupId)
    setConnectionLink('')
    setShowPairing(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        <li
          className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4"
          data-testid={TestIds.environmentRow('local')}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Monitor className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <EnvironmentName
                  disabled={localStatus?.state !== 'online'}
                  environmentId={null}
                  machineName={localStatus?.host ?? null}
                  name={localName}
                />
                <p className="text-xs text-muted-foreground">{describeStatus(localStatus)}</p>
              </div>
            </div>
            <span className="size-7 shrink-0" aria-hidden />
          </div>
        </li>
        {environments.map((environment) => {
          const status = statuses.get(environment.id)
          const route = activeRoute(status)
          return (
            <li
              key={environment.id}
              className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4"
              data-testid={TestIds.environmentRow(environment.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Cloud className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <EnvironmentName
                      disabled={status?.state !== 'online'}
                      environmentId={environment.id}
                      machineName={status?.host ?? null}
                      name={firstLabel(status?.name, environment.name) ?? environment.name}
                    />
                    <p className="text-xs text-muted-foreground">
                      {describeStatus(status)}
                      {route == null ? '' : ` · via ${route}`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={removingId === environment.id}
                          onClick={() => remove(environment.id)}
                          aria-label="Remove environment group"
                        >
                          <X />
                        </Button>
                      }
                    />
                    <TooltipContent>Remove group</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="flex flex-col gap-1 rounded-md border border-border/60 p-2">
                <p className="px-1 text-2xs font-medium tracking-wider text-muted-foreground uppercase">
                  Connections · LAN, then Tailscale, then Cloudflare
                </p>
                {environment.endpoints.map((endpoint) => (
                  <EndpointRow
                    endpoint={endpoint}
                    environmentId={environment.id}
                    key={endpoint.url}
                    onRemove={() => removeEndpoint({ id: environment.id, url: endpoint.url })}
                    removable={environment.endpoints.length > 1}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className={cn('self-start', compactButtonClass)}
                onClick={() => showPairForm(environment.id)}
              >
                Add connection
              </Button>
            </li>
          )
        })}
      </ul>

      {wslDistributions !== undefined && wslDistributions.length > 0 && (
        <section className="flex flex-col gap-2 pt-2" aria-labelledby="wsl-environments-heading">
          <div>
            <h3 id="wsl-environments-heading" className="text-sm font-medium">
              Windows Subsystem for Linux
            </h3>
            <p className="text-xs text-muted-foreground">
              Each distribution runs its own Linux daemon and owns its Linux projects. Porcelain
              does not open them through a Windows UNC path.
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {wslDistributions.map((distribution) => (
              <li
                key={distribution.name}
                className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-4"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Terminal className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{distribution.name}</p>
                    <Badge variant="outline" className="rounded-md text-2xs">
                      WSL {distribution.version}
                    </Badge>
                    {distribution.isDefault && (
                      <Badge variant="secondary" className="rounded-md text-2xs">
                        Default
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {describeWslReadiness(distribution)}
                  </p>
                  {(distribution.nodeVersion !== null || distribution.gitVersion !== null) && (
                    <p className="mt-1 font-mono text-2xs text-muted-foreground">
                      {[
                        distribution.nodeVersion === null
                          ? null
                          : `Node ${distribution.nodeVersion}`,
                        distribution.gitVersion,
                      ]
                        .filter((value) => value !== null)
                        .join(' · ')}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showPairing ? (
        <div className="flex flex-col gap-2 rounded-md border border-border/60 p-3">
          <p className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">
            {pairingTargetId === null ? 'Create environment group' : 'Add connection to group'}
          </p>
          <Input
            type="password"
            placeholder="Connection link (https://…/pair#token=…)"
            value={connectionLink}
            onChange={(event: React.ChangeEvent<HTMLInputElement>): void =>
              setConnectionLink(event.target.value)
            }
            disabled={isPairing}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Pair LAN first, then add Tailscale or Cloudflare as the fallback. Each link is verified
            against the same daemon before it joins the group. Clients try LAN, then Tailscale, then
            Cloudflare.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              className={compactButtonClass}
              disabled={isPairing || connectionLink.trim() === ''}
              onClick={() =>
                pair({
                  connectionLink,
                  connectThisWindow: false,
                  groupId: pairingTargetId,
                })
              }
            >
              {isPairing
                ? 'Pairing…'
                : pairingTargetId === null
                  ? 'Pair environment'
                  : 'Add connection'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={compactButtonClass}
              disabled={isPairing}
              onClick={() => {
                setShowPairing(false)
                setConnectionLink('')
              }}
            >
              Cancel
            </Button>
          </div>
          {error != null && <p className="text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className={cn('self-start', compactButtonClass)}
          onClick={() => showPairForm(null)}
        >
          Pair an environment group
        </Button>
      )}
    </div>
  )
}

function EndpointRow({
  endpoint,
  environmentId,
  onRemove,
  removable,
}: {
  endpoint: { url: string; kind: 'lan' | 'tailnet' | 'other'; preferred: boolean }
  environmentId: string
  onRemove: () => void
  removable: boolean
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 rounded-sm px-1 py-1">
      <div className="flex min-w-0 items-center gap-2">
        <Badge variant="outline" className="shrink-0 rounded-md text-2xs">
          {endpointLabel(endpoint.url)}
        </Badge>
        <span className="truncate font-mono text-2xs-plus text-muted-foreground">
          {endpoint.url}
        </span>
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!removable}
              onClick={onRemove}
              aria-label={`Remove ${endpointLabel(endpoint.url)} connection`}
              data-environment-id={environmentId}
            >
              <X />
            </Button>
          }
        />
        <TooltipContent>
          {removable ? 'Remove connection' : 'A group needs one connection'}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
