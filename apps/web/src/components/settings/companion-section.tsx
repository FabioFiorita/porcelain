import { PluginSection } from './plugin-section'

/**
 * Settings → Companion: the `porcelain` agent plugin your agents read.
 *
 * The commands are copy-paste into the agent's own plugin manager. They are
 * the same on the browser client and in Electron: the plugin lives in the
 * product repository, not in a shell-only installer.
 */
export function CompanionSection(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Installs the Porcelain plugin, which teaches your agents the Review Canvas, comments,
        daemon-owned Actions, and how this project's companion data is shared.
      </p>
      <PluginSection />
    </div>
  )
}
