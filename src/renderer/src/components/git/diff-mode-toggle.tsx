import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { usePreferencesStore } from '@renderer/stores/preferences'

export function DiffModeToggle(): React.JSX.Element {
  const diffMode = usePreferencesStore((s) => s.diffMode)
  const setDiffMode = usePreferencesStore((s) => s.setDiffMode)

  return (
    <ToggleGroup
      value={[diffMode]}
      onValueChange={(value: string[]) => {
        const mode = value[0]
        if (mode === 'unified' || mode === 'split') setDiffMode(mode)
      }}
    >
      <ToggleGroupItem value="unified" size="sm">
        Unified
      </ToggleGroupItem>
      <ToggleGroupItem value="split" size="sm">
        Split
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
