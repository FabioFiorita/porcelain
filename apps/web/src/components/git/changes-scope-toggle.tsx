import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { usePreferencesStore } from '@renderer/stores/preferences'

export function ChangesScopeToggle(): React.JSX.Element {
  const changesScope = usePreferencesStore((s) => s.changesScope)
  const setChangesScope = usePreferencesStore((s) => s.setChangesScope)
  return (
    <ToggleGroup
      value={[changesScope]}
      onValueChange={(value: string[]) => {
        const scope = value[0]
        if (scope === 'working' || scope === 'branch') setChangesScope(scope)
      }}
      className="w-full"
    >
      <ToggleGroupItem value="working" size="sm" className="min-w-0 flex-1">
        Working
      </ToggleGroupItem>
      <ToggleGroupItem value="branch" size="sm" className="min-w-0 flex-1">
        Branch
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
