# Renderer composition rules

Each rule is a thing a reviewer will send back. Grouped by what you are writing.

## Styling

- `className` carries **layout only**. Never override a component's colours or typography.
- No `space-x-*` / `space-y-*`. Use `flex gap-*`, or `flex flex-col gap-*` for a vertical stack.
- `size-10`, not `w-10 h-10`, whenever width and height match.
- `truncate`, not `overflow-hidden text-ellipsis whitespace-nowrap`.
- No manual `dark:` colour overrides — the semantic tokens (`bg-background`,
  `text-muted-foreground`, `border-border`) already carry both themes.
- Conditional classes go through `cn()` from `@renderer/lib/utils`, not template-literal ternaries.
- No manual `z-index` on Dialog, Sheet, Popover, Tooltip or Drawer. They own their stacking, and a
  hand-set `z-*` is how one ends up behind another.

## Forms

- Layout is `FieldGroup` + `Field`. Never a raw `div` with `space-y-*` or `grid gap-*`.
- Inside `InputGroup`, use `InputGroupInput` / `InputGroupTextarea` — never a bare `Input` or
  `Textarea`. A button inside an input is `InputGroup` + `InputGroupAddon`.
- 2–7 mutually exclusive choices are a `ToggleGroup`, not a loop of `Button` with manual active
  state.
- Related checkboxes or radios group under `FieldSet` + `FieldLegend`, not a `div` and a heading.
- Validation is `data-invalid` on the `Field` plus `aria-invalid` on the control. Disabled is
  `data-disabled` on the `Field` plus `disabled` on the control. Both halves, every time.

## Structure

- An item always sits inside its group: `SelectItem` → `SelectGroup`, `DropdownMenuItem` →
  `DropdownMenuGroup`, `CommandItem` → `CommandGroup`.
- Custom triggers use **`render`** — this project is on Base UI. `asChild` is the Radix spelling and
  does nothing here.
- `Dialog`, `Sheet` and `Drawer` each require their `*Title` for accessibility. Hide it with
  `className="sr-only"` when the design has no visible heading, but do not omit it.
- Use the full `Card` composition — `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` /
  `CardFooter`. Don't pour everything into `CardContent`.
- `Button` has no `isPending` or `isLoading`. Compose `Spinner` + `data-icon` + `disabled`.
- `TabsTrigger` belongs inside `TabsList`, never directly under `Tabs`.
- `Avatar` always carries an `AvatarFallback` for when the image fails.

## Reach for the component, not markup

A styled `div` is almost always a component that already exists:

| Instead of | Use |
|---|---|
| A custom callout box | `Alert` |
| Custom empty-state markup | `Empty` |
| A hand-rolled toast | `toast()` from `sonner` |
| `<hr>` or `<div className="border-t">` | `Separator` |
| A custom `animate-pulse` div | `Skeleton` |
| A styled `<span>` label | `Badge` |

## Icons

- Icons inside a `Button` carry `data-icon="inline-start"` or `data-icon="inline-end"`.
- No sizing classes on an icon inside a component — the component sizes it via CSS. No `size-4`, no
  `w-4 h-4`.
- Pass an icon as the component object (`icon={CheckIcon}`), never a string key to look up.
