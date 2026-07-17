// The compact control scale for card- and row-level actions. Applied to any button
// that acts on a card or list row (Quick Access commit/commands, settings rows) so
// every such control sits on one height, and no control outweighs a row label.
export const compactButtonClass = 'h-7 text-xs'

// The compact scale for inputs on cards/rows: shrinks the vendored Input from its
// default h-9 to h-8 and drops to text-xs, so a field never visually outweighs the
// label it serves. Compose with font-mono where the field holds a regex/command
// (cn(compactInputClass, 'font-mono')).
export const compactInputClass = 'h-8 text-xs'

// Row actions further mute their label until hover — secondary to the row's name.
export const rowActionClass = `${compactButtonClass} px-2.5 text-muted-foreground hover:text-foreground`

// The section-header recipe for a cmdk CommandGroup heading (matches the worktree
// popover's DropdownMenuLabel: small, bold, uppercase, tracked). Applied to any
// CommandGroup's className so command-palette sections read as one voice.
export const commandGroupHeadingClass =
  '**:[[cmdk-group-heading]]:text-2xs **:[[cmdk-group-heading]]:font-bold **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-[0.08em]'
