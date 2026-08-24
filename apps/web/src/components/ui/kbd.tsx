import { kbdParts } from "@renderer/lib/keyboard"
import { cn } from "@renderer/lib/utils"

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "pointer-events-none inline-flex h-[18px] w-fit min-w-[18px] items-center justify-center rounded-md border border-border/50 bg-muted/80 px-1 font-sans text-[11px] leading-none font-medium text-muted-foreground select-none in-data-[slot=input-group]:bg-input in-data-[slot=tooltip-content]:border-transparent in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background dark:in-data-[slot=tooltip-content]:bg-background/10 [&_svg:not([class*='size-'])]:size-3",
        className
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-0.5", className)}
      {...props}
    />
  )
}

/** One compact keycap per token — the Linear-style shortcut, not a single concatenated chip. */
function Shortcut({
  tokens,
  className,
}: {
  tokens: readonly string[]
  className?: string
}) {
  return (
    <KbdGroup className={className}>
      {kbdParts(...tokens).map((part, index) => (
        <Kbd key={`${part}-${index}`}>{part}</Kbd>
      ))}
    </KbdGroup>
  )
}

export { Kbd, KbdGroup, Shortcut }
