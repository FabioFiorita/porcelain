import { Kbd } from '@renderer/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'

/** Adds the same keyboard affordance to compact shell controls. */
export function ShortcutTooltip({
  label,
  shortcut,
  children,
}: {
  label: string
  shortcut: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex shrink-0">{children}</span>} />
      <TooltipContent>
        <span>{label}</span>
        <Kbd>{shortcut}</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}
