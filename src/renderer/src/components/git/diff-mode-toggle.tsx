import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { useIsMobile } from '@renderer/hooks/use-mobile'
import { usePreferencesStore } from '@renderer/stores/preferences'

export function DiffModeToggle(): React.JSX.Element | null {
  const diffMode = usePreferencesStore((s) => s.diffMode)
  const setDiffMode = usePreferencesStore((s) => s.setDiffMode)
  // Split view needs ~two code panes side by side — unreadable on a phone.
  // Hide the control; DiffView already falls back via the same hook.
  const isMobile = useIsMobile()
  if (isMobile) return null

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
