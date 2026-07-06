import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { useDaemonToken } from '@renderer/hooks/use-daemon-token'
import {
  useClearRemoteDaemon,
  useRemoteDaemon,
  useSetRemoteDaemon,
} from '@renderer/hooks/use-remote-daemon'
import { useSetTailnetBind, useTailnetStatus } from '@renderer/hooks/use-tailnet'
import { isBrowser } from '@renderer/lib/platform'
import {
  type DiffMode,
  type MarkdownMode,
  type PullMode,
  usePreferencesStore,
} from '@renderer/stores/preferences'
import { useState } from 'react'

function PreferenceRow({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm-minus font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

/**
 * Point this Mac app at a REMOTE daemon over the tailnet (remote-envs Phase 4),
 * or clear back to the local one. Electron-only — the whole block is hidden in
 * the browser client (which already IS served by its daemon). On connect the
 * shell probes the url+token; a failure surfaces inline. Both connect and
 * disconnect reload the window (see use-remote-daemon).
 */
function RemoteDaemonBlock(): React.JSX.Element {
  const remote = useRemoteDaemon()
  const { connect, isPending: isConnecting, error } = useSetRemoteDaemon()
  const { disconnect, isPending: isDisconnecting } = useClearRemoteDaemon()
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm-minus font-semibold">Remote daemon</p>
        <p className="text-xs text-muted-foreground">
          Point this app at another machine's Porcelain daemon on your tailnet.
        </p>
      </div>
      {remote == null ? (
        <div className="flex flex-col gap-2">
          <Input
            placeholder="http://my-mac.tailnet.ts.net:43117"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isConnecting}
          />
          <Input
            type="password"
            placeholder="Daemon token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={isConnecting}
          />
          <p className="text-xs text-muted-foreground">
            On the other machine, copy it from Settings → Share over Tailscale, or run{' '}
            <span className="font-mono">cat ~/.porcelain/daemon-token</span>.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            disabled={isConnecting || url.trim() === '' || token.trim() === ''}
            onClick={() => connect({ url, token })}
          >
            {isConnecting ? 'Connecting…' : 'Connect'}
          </Button>
          {error != null && <p className="text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs text-muted-foreground">{remote.url}</p>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            disabled={isDisconnecting}
            onClick={() => disconnect()}
          >
            {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        </div>
      )}
    </div>
  )
}

export function GeneralSection(): React.JSX.Element {
  const diffMode = usePreferencesStore((s) => s.diffMode)
  const setDiffMode = usePreferencesStore((s) => s.setDiffMode)
  const markdownMode = usePreferencesStore((s) => s.markdownMode)
  const setMarkdownMode = usePreferencesStore((s) => s.setMarkdownMode)
  const pullMode = usePreferencesStore((s) => s.pullMode)
  const setPullMode = usePreferencesStore((s) => s.setPullMode)
  const tailnet = useTailnetStatus()
  const { setEnabled } = useSetTailnetBind()
  const daemonToken = useDaemonToken()
  const [tokenCopied, setTokenCopied] = useState(false)

  return (
    <div className="flex flex-col gap-5">
      <PreferenceRow label="Diff layout" description="How file diffs are rendered.">
        <ToggleGroup
          value={[diffMode]}
          onValueChange={(value: string[]) => {
            const mode = value[0]
            if (mode === 'unified' || mode === 'split') setDiffMode(mode satisfies DiffMode)
          }}
        >
          <ToggleGroupItem value="unified" size="sm">
            Unified
          </ToggleGroupItem>
          <ToggleGroupItem value="split" size="sm">
            Split
          </ToggleGroupItem>
        </ToggleGroup>
      </PreferenceRow>
      <PreferenceRow label="Markdown" description="Default view when opening markdown files.">
        <ToggleGroup
          value={[markdownMode]}
          onValueChange={(value: string[]) => {
            const mode = value[0]
            if (mode === 'reader' || mode === 'source') setMarkdownMode(mode satisfies MarkdownMode)
          }}
        >
          <ToggleGroupItem value="reader" size="sm">
            Reader
          </ToggleGroupItem>
          <ToggleGroupItem value="source" size="sm">
            Source
          </ToggleGroupItem>
        </ToggleGroup>
      </PreferenceRow>
      <PreferenceRow label="Pull strategy" description="How the git pull quick command reconciles.">
        <ToggleGroup
          value={[pullMode]}
          onValueChange={(value: string[]) => {
            const mode = value[0]
            if (mode === 'merge' || mode === 'rebase') setPullMode(mode satisfies PullMode)
          }}
        >
          <ToggleGroupItem value="merge" size="sm">
            Merge
          </ToggleGroupItem>
          <ToggleGroupItem value="rebase" size="sm">
            Rebase
          </ToggleGroupItem>
        </ToggleGroup>
      </PreferenceRow>
      <div className="flex flex-col gap-2">
        <PreferenceRow
          label="Share over Tailscale"
          description="Lets other devices on your tailnet reach this daemon — token-gated."
        >
          <Switch
            checked={tailnet?.enabled ?? false}
            onCheckedChange={(checked) => setEnabled(checked)}
          />
        </PreferenceRow>
        {tailnet?.url != null && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs text-muted-foreground">{tailnet.url}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(daemonToken)
                  setTokenCopied(true)
                  setTimeout(() => setTokenCopied(false), 1500)
                }}
              >
                {tokenCopied ? 'Copied' : 'Copy token'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The token lives at <span className="font-mono">~/.porcelain/daemon-token</span>.
            </p>
          </div>
        )}
        {tailnet?.enabled === true && tailnet.url == null && (
          <p className="text-xs text-muted-foreground">No Tailscale interface found</p>
        )}
      </div>
      {!isBrowser && <RemoteDaemonBlock />}
    </div>
  )
}
