import { isBrowser, isLinuxShell } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { EnvironmentSwitcher } from './environment-switcher'
import { UpdateButton } from './update-button'
import { WindowControls } from './window-controls'

/**
 * Native shell titlebar. Browser clients do not render this row: their search and
 * environment identity live in the navigation sidebar, while Electron needs the
 * row for native traffic lights and shell-only environment switching.
 *
 * No border-b: floating tiles seat their own top chrome under this bar.
 */
export function TitleBar(): React.JSX.Element | null {
  if (isBrowser) return null

  return (
    <div className="app-drag relative flex h-12 shrink-0 items-center px-3">
      <div className="min-w-0 flex-1" aria-hidden />
      <div
        className={cn(
          'app-no-drag relative z-10 flex shrink-0 items-center justify-end gap-1.5',
          isLinuxShell ? 'min-w-24 pl-2' : 'min-w-16 pl-2',
        )}
      >
        <UpdateButton />
        <EnvironmentSwitcher />
        {isLinuxShell && <WindowControls />}
      </div>
    </div>
  )
}
