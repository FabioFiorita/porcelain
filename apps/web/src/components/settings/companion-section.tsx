import { PluginSection } from './plugin-section'

export function CompanionSection(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        The Porcelain plugin helps agents work with Canvases, comments, profiles, Actions, and
        remote setup while they continue running in their native harness.
      </p>
      <PluginSection />
    </div>
  )
}
