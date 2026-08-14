import logo from '@renderer/assets/logo.png'
import { SettingsButton } from '@renderer/components/settings/settings-dialog'
import { Button } from '@renderer/components/ui/button'
import { HubTree } from '@renderer/features/projects'
import { useDisconnectRemoteEnvironment, useRemoteEnvironments } from '@renderer/features/remote'
import { isBrowser } from '@renderer/lib/platform'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { TestIds } from '@shared/test-ids'
import { Cloud, FolderOpen, Laptop, Unplug } from 'lucide-react'

/**
 * Always-visible environment identity on the landing page: which daemon this
 * window talks to, and how to leave a remote. Without this, Disconnect/Use here
 * can update the shell binding while the recents list still looks like the
 * previous machine — the human has no clear "where am I" signal.
 *
 * Electron-only — the browser client already IS its daemon.
 */
function EnvironmentBanner(): React.JSX.Element | null {
  const data = useRemoteEnvironments()
  const { disconnect, isPending } = useDisconnectRemoteEnvironment()
  if (isBrowser || data == null) return null

  const active =
    data.activeId != null
      ? (data.environments.find((env) => env.id === data.activeId) ?? null)
      : null

  if (active != null) {
    return (
      <div className="flex w-full max-w-sm items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
        <div className="flex min-w-0 items-start gap-2">
          <Cloud className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-medium">This window → {active.name}</p>
            <p className="truncate font-mono text-2xs text-muted-foreground">{active.url}</p>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              Recent projects and Open project use this remote.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={isPending}
          onClick={() => disconnect()}
        >
          <Unplug className="size-3.5" />
          {isPending ? 'Switching…' : 'This device'}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-sm items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
      <div className="flex min-w-0 items-start gap-2">
        <Laptop className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <p className="text-xs font-medium">This device</p>
          <p className="text-2xs text-muted-foreground">
            Local daemon — recent projects are from this machine.
          </p>
        </div>
      </div>
      {data.environments.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => useSettingsDialogStore.getState().openTo('remotes')}
        >
          Remotes
        </Button>
      )}
    </div>
  )
}

export function Welcome(): React.JSX.Element {
  const openProjectPicker = useProjectSelectionStore((s) => s.openProjectPicker)
  const remote = useRemoteEnvironments()
  const onRemote = !isBrowser && remote != null && remote.activeId != null
  const remoteName =
    onRemote && remote != null
      ? (remote.environments.find((env) => env.id === remote.activeId)?.name ?? 'remote')
      : null

  return (
    <div
      data-testid={TestIds.welcome}
      className="relative flex h-full flex-col items-center justify-center gap-8 px-6"
    >
      {/* Settings must be reachable with no Project open — Remote daemons live there,
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
        <p className="mt-1 text-sm text-muted-foreground">Where agent work becomes trusted work.</p>
      </div>
      <EnvironmentBanner />
      <Button data-testid={TestIds.welcomeOpenRepo} onClick={openProjectPicker}>
        <FolderOpen />
        {onRemote ? `Open project on ${remoteName}` : 'Open project'}
      </Button>
      <HubTree className="w-80" />
    </div>
  )
}
