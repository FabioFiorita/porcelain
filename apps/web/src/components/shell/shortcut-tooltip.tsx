import { Shortcut } from '@renderer/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'

/** Adds the same keyboard affordance to compact shell controls. */
export function ShortcutTooltip({
  label,
  tokens,
  children,
}: {
  label: string
  tokens: readonly string[]
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex shrink-0">{children}</span>} />
      <TooltipContent>
        <span>{label}</span>
        <Shortcut tokens={tokens} />
      </TooltipContent>
    </Tooltip>
  )
}
