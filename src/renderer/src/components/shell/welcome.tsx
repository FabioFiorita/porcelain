import logo from '@renderer/assets/logo.png'
import { SettingsButton } from '@renderer/components/settings/settings-dialog'
import { Button } from '@renderer/components/ui/button'
import {
  useDisconnectRemoteEnvironment,
  useRemoteEnvironments,
} from '@renderer/hooks/use-remote-daemon'
import { useRecentRepos, useRemoveRecentRepo } from '@renderer/hooks/use-repo'
import { isBrowser } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { Folder, FolderOpen, Unplug, X } from 'lucide-react'

/**
 * Banner when this window is pointed at a remote daemon: name + disconnect so a
 * failed remote (empty disk, unreachable LAN) never traps the user without a
 * way back to local. Electron-only — the browser client already IS its daemon.
 */
function RemoteConnectionBanner(): React.JSX.Element | null {
  const data = useRemoteEnvironments()
  const { disconnect, isPending } = useDisconnectRemoteEnvironment()
  if (isBrowser || data == null || data.activeId == null) return null
  const active = data.environments.find((env) => env.id === data.activeId)
  if (active == null) return null

  return (
    <div className="flex w-full max-w-sm items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-medium">Connected to {active.name}</p>
        <p className="truncate font-mono text-2xs text-muted-foreground">{active.url}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        disabled={isPending}
        onClick={() => disconnect()}
      >
        <Unplug className="size-3.5" />
        {isPending ? 'Disconnecting…' : 'Disconnect'}
      </Button>
    </div>
  )
}

export function Welcome(): React.JSX.Element {
  const openRepo = useRepoStore((s) => s.openRepo)
  const openRepoPath = useRepoStore((s) => s.openRepoPath)
  const removeRecent = useRemoveRecentRepo()
  const recents = useRecentRepos()

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-8 px-6">
      {/* Settings must be reachable with no repo open — Remote daemons live there,
          and a stuck remote would otherwise leave no escape hatch. */}
      <div className="absolute top-2 right-3">
        <SettingsButton className="app-no-drag size-10 text-muted-foreground [&_svg]:size-5" />
      </div>
      <div className="flex flex-col items-center text-center">
        {/* Same fired-tile treatment as the empty viewer: the mark rests on the
            void with a soft squircle shadow, so first run and blank tabs match. */}
        <img
          src={logo}
          alt=""
          draggable={false}
          className="size-20 [filter:drop-shadow(0_14px_30px_rgb(0_0_0/0.5))]"
        />
        <h1 className="mt-4 text-3xl font-medium tracking-tight">porcelain</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review changes as a story</p>
      </div>
      <RemoteConnectionBanner />
      <Button onClick={openRepo}>
        <FolderOpen />
        Open repository
      </Button>
      {recents.length > 0 && (
        <div className="flex w-80 flex-col gap-0.5">
          <p className="px-2 pb-1 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent
          </p>
          {recents.map((repo) => (
            // A button can't nest a button, so the remove affordance is an overlaid
            // sibling revealed on hover (or keyboard focus) rather than a child.
            <div key={repo.path} className="group relative">
              <Button
                variant="ghost"
                className="h-auto w-full justify-start gap-2.5 py-1.5 pr-9"
                onClick={() => openRepoPath(repo.path)}
              >
                <Folder className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-col items-start">
                  <span className="truncate text-sm">{repo.name}</span>
                  <span className="max-w-full truncate text-xs text-muted-foreground" dir="rtl">
                    {repo.path}
                  </span>
                </span>
              </Button>
              <button
                type="button"
                aria-label="Remove from projects"
                className={cn(
                  'absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground',
                  'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
                  'hover:bg-accent/50 hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                )}
                onClick={() => removeRecent.remove(repo.path)}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {recents.length === 0 && (
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={() => useSettingsDialogStore.getState().openTo('general')}
        >
          Remote daemon settings
        </button>
      )}
    </div>
  )
}
