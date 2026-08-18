import { PluginSection } from './plugin-section'

/**
 * Settings → Companion: the `porcelain` agent plugin your agents read.
 *
 * What git carries moved to Settings → Data. That half was a property of the
 * repo; this half installs files into an agent home on THIS machine, which is
 * why the tab is shell-only — a browser client has no shell router to run it.
 */
export function CompanionSection(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Installs the Porcelain plugin, which teaches your agents the Review Canvas, daemon-owned
        Tasks and Actions, and how this project's companion data is shared.
      </p>
      <PluginSection />
    </div>
  )
}
