import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@renderer/lib/utils"

// Glaze surfaces (plans/005-glaze-design-system.md): every floating panel,
// chip, and hover treatment derives from these variants so the material stays
// uniform app-wide. Attach to shadcn parts via Base UI's `render` prop, e.g.
// <TabsList render={<Surface tone="glass" />} …>.
const surfaceVariants = cva("", {
  variants: {
    tone: {
      tile: "glaze-tile",
      raised: "glaze-tile [--tile-fill:var(--surface-2)]",
      glass:
        "rounded-full border border-sidebar-border bg-sidebar-accent/40 shadow-lg backdrop-blur-xl",
      chip: "rounded-md bg-muted/80 px-2 py-0.5 text-[10px]",
    },
    motion: {
      none: "",
      hover:
        "transition-colors duration-(--dur-fast) ease-(--ease-glaze) hover:bg-(--hover-fill)",
    },
  },
  defaultVariants: {
    tone: "tile",
    motion: "none",
  },
})

function Surface({
  className,
  tone = "tile",
  motion = "none",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof surfaceVariants>) {
  return (
    <div
      data-slot="surface"
      className={cn(surfaceVariants({ tone, motion, className }))}
      {...props}
    />
  )
}

export { Surface, surfaceVariants }
