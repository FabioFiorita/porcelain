import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useDaemonToken } from '@renderer/hooks/use-daemon-token'
import { useLanStatus, useSetLanBind } from '@renderer/hooks/use-lan'
import {
  useAddRemoteEnvironment,
  useConnectRemoteEnvironment,
  useDisconnectRemoteEnvironment,
  useOpenWindowInEnvironment,
  useRemoteEnvironments,
  useRemoveRemoteEnvironment,
} from '@renderer/hooks/use-remote-daemon'
import { useCopyRepoSettingsOnDaemon, useSeedFromLocalMac } from '@renderer/hooks/use-repo-settings'
import { useSetTailnetBind, useTailnetStatus } from '@renderer/hooks/use-tailnet'
import { isBrowser } from '@renderer/lib/platform'
import { copyText } from '@renderer/lib/utils'
import {
  type DiffMode,
  type MarkdownMode,
  type PullMode,
  usePreferencesStore,
} from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { X } from 'lucide-react'
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

/** Copy the daemon token to the clipboard — the affordance a peer needs to connect. */
function CopyTokenButton(): React.JSX.Element {
  const daemonToken = useDaemonToken()
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        // copyText, not navigator.clipboard directly: the daemon-served browser
        // client (the LAN/tailnet peer that reaches this very block) is an insecure
        // context where navigator.clipboard is undefined — copyText falls back to
        // the execCommand path there. See the architecture skill's insecure-context trap.
        await copyText(daemonToken)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? 'Copied' : 'Copy token'}
    </Button>
  )
}

/**
 * The reveal shown once a second listener is up: the reachable url(s), a copy-token
 * button, and the token-path hint. Shared by the Tailscale and LAN blocks — the LAN
 * passes a `numericUrl` fallback alongside its `.local` name.
 */
function ShareReveal({
  url,
  numericUrl,
}: {
  url: string
  numericUrl?: string | null
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <p className="font-mono text-xs text-muted-foreground">{url}</p>
        <CopyTokenButton />
      </div>
      {numericUrl != null && numericUrl !== url && (
        <p className="font-mono text-xs text-muted-foreground">{numericUrl}</p>
      )}
      <p className="text-xs text-muted-foreground">
        The token lives at <span className="font-mono">~/.porcelain/daemon-token</span>.
      </p>
    </div>
  )
}

/**
 * Save other machines' Porcelain daemons and bind THIS window (or open a new
 * one) to them. Environments are per-window: local project in one window, remote
 * in another. Electron-only — hidden in the browser client (which already IS
 * served by its daemon). Adding probes the url+token and surfaces a failure
 * inline. Connect / disconnect / remove-when-this-window reloads THIS window
 * only (see use-remote-daemon).
 */
function RemoteEnvironmentsBlock(): React.JSX.Element {
  const data = useRemoteEnvironments()
  const { add, isPending: isAdding, error } = useAddRemoteEnvironment()
  const { connect, pendingId: connectingId } = useConnectRemoteEnvironment()
  const { disconnect, isPending: isDisconnecting } = useDisconnectRemoteEnvironment()
  const { open: openInEnv } = useOpenWindowInEnvironment()
  const { remove, pendingId: removingId } = useRemoveRemoteEnvironment()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [token, setToken] = useState('')

  const environments = data?.environments ?? []
  const activeId = data?.activeId ?? null

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm-minus font-semibold">Environments</p>
        <p className="text-xs text-muted-foreground">
          Save other machines' Porcelain daemons. Each window can use a different environment —
          local in one, remote in another.
        </p>
      </div>
      {/* This device row — always present so "Open in new window" works from a remote. */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm-minus font-semibold">This device</p>
          <p className="text-xs text-muted-foreground">Local daemon on this Mac</p>
        </div>
        <div className="flex items-center gap-2">
          {activeId == null ? (
            <span className="text-xs text-muted-foreground">This window</span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={isDisconnecting}
              onClick={() => disconnect()}
            >
              {isDisconnecting ? 'Switching…' : 'Use here'}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => openInEnv({ environmentId: null })}>
            New window
          </Button>
        </div>
      </div>
      {environments.length > 0 && (
        <div className="flex flex-col gap-2">
          {environments.map((env) => {
            const isActive = env.id === activeId
            return (
              <div key={env.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm-minus font-semibold">{env.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{env.url}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isActive ? (
                    <span className="text-xs text-muted-foreground">This window</span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={connectingId === env.id}
                      onClick={() => connect(env.id)}
                    >
                      {connectingId === env.id ? 'Switching…' : 'Use here'}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openInEnv({ environmentId: env.id })}
                  >
                    New window
                  </Button>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={removingId === env.id}
                          onClick={() => remove(env.id)}
                          aria-label="Remove"
                        >
                          <X />
                        </Button>
                      }
                    />
                    <TooltipContent>Remove</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Input
          placeholder="Beelink"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isAdding}
        />
        <Input
          placeholder="http://beelink.tailnet.ts.net:43117"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isAdding}
        />
        <Input
          type="password"
          placeholder="Daemon token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={isAdding}
        />
        <p className="text-xs text-muted-foreground">
          On the other machine, copy it from Settings → Share over Tailscale, or run{' '}
          <span className="font-mono">cat ~/.porcelain/daemon-token</span>.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={isAdding || url.trim() === '' || token.trim() === ''}
          onClick={() => add({ name, url, token })}
        >
          {isAdding ? 'Adding…' : 'Add & use here'}
        </Button>
        {error != null && <p className="text-xs text-destructive">{error}</p>}
      </div>
      {activeId != null && <SeedRepoSettingsBlock />}
    </div>
  )
}

/**
 * Explicit seed of actions / notes / board / layers / comments onto the active
 * remote environment. Channel files are keyed by absolute path on the daemon host
 * and never cross machines silently — this is the user-initiated copy.
 */
function SeedRepoSettingsBlock(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const { seed, isPending: seeding, result: seedResult, error: seedError } = useSeedFromLocalMac()
  const {
    copy,
    isPending: copying,
    result: copyResult,
    error: copyError,
  } = useCopyRepoSettingsOnDaemon()
  const [localPath, setLocalPath] = useState('')
  const [fromPath, setFromPath] = useState('')
  const targetPath = repo?.path ?? ''
  const busy = seeding || copying

  return (
    <div className="flex flex-col gap-3 border-t border-border/60 pt-3">
      <div>
        <p className="text-sm-minus font-semibold">Copy repo settings to this environment</p>
        <p className="text-xs text-muted-foreground">
          Seeds actions (commands), notes, board cards, flow layers, and review comments onto the
          open remote repo. Replaces those channels on the target path — never a silent merge.
        </p>
      </div>
      {targetPath === '' ? (
        <p className="text-xs text-muted-foreground">Open a repo on this environment first.</p>
      ) : (
        <>
          <p className="truncate font-mono text-xs text-muted-foreground">Target: {targetPath}</p>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium">From this Mac</p>
            <Input
              placeholder="/Users/you/Code/my-project"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              disabled={busy}
            />
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              disabled={busy || localPath.trim() === ''}
              onClick={() => seed(localPath.trim(), targetPath)}
            >
              {seeding ? 'Copying…' : 'Copy from this Mac'}
            </Button>
            {seedResult != null && (
              <p className="text-xs text-muted-foreground">
                {seedResult.imported.length === 0
                  ? 'Nothing to copy (source had no settings).'
                  : `Imported: ${seedResult.imported.join(', ')}`}
              </p>
            )}
            {seedError != null && <p className="text-xs text-destructive">{seedError}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium">Remap a path on this daemon</p>
            <Input
              placeholder="/other/path/on/daemon"
              value={fromPath}
              onChange={(e) => setFromPath(e.target.value)}
              disabled={busy}
            />
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              disabled={busy || fromPath.trim() === '' || fromPath.trim() === targetPath}
              onClick={() => copy(fromPath.trim(), targetPath)}
            >
              {copying ? 'Copying…' : 'Copy on daemon'}
            </Button>
            {copyResult != null && (
              <p className="text-xs text-muted-foreground">
                {copyResult.imported.length === 0
                  ? 'Nothing to copy (source had no settings).'
                  : `Imported: ${copyResult.imported.join(', ')}`}
              </p>
            )}
            {copyError != null && <p className="text-xs text-destructive">{copyError}</p>}
          </div>
        </>
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
  const { setEnabled: setTailnetEnabled } = useSetTailnetBind()
  const lan = useLanStatus()
  const { setEnabled: setLanEnabled } = useSetLanBind()

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
            disabled={tailnet?.envForced ?? false}
            onCheckedChange={(checked) => setTailnetEnabled(checked)}
          />
        </PreferenceRow>
        {tailnet?.envForced === true && (
          <p className="text-xs text-muted-foreground">
            Enabled via <span className="font-mono">PORCELAIN_TAILNET_BIND</span>
          </p>
        )}
        {tailnet?.url != null && <ShareReveal url={tailnet.url} />}
        {tailnet?.enabled === true && tailnet.url == null && (
          <p className="text-xs text-muted-foreground">
            {tailnet.error === 'in-use'
              ? 'Port 43117 is in use — another daemon may still be running.'
              : 'No Tailscale interface found'}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <PreferenceRow
          label="Share on local network"
          description="Lets devices on your home network reach this daemon — token-gated, traffic is unencrypted on the LAN."
        >
          <Switch
            checked={lan?.enabled ?? false}
            disabled={lan?.envForced ?? false}
            onCheckedChange={(checked) => setLanEnabled(checked)}
          />
        </PreferenceRow>
        {lan?.envForced === true && (
          <p className="text-xs text-muted-foreground">
            Enabled via <span className="font-mono">PORCELAIN_LAN_BIND</span>
          </p>
        )}
        {lan?.url != null && <ShareReveal url={lan.url} numericUrl={lan.numericUrl} />}
        {lan?.enabled === true && lan.url == null && (
          <p className="text-xs text-muted-foreground">
            {lan.error === 'in-use'
              ? 'Port 43117 is in use — another daemon may still be running.'
              : 'No local network interface found'}
          </p>
        )}
      </div>
      {!isBrowser && <RemoteEnvironmentsBlock />}
    </div>
  )
}
