import { Platform, TextInput } from 'react-native'
import { cn } from '@/lib/utils'

/**
 * The dark fill reads `dark:bg-white/5` where the React Native Reusables registry says
 * `dark:bg-input/30`, and every primitive copied from that registry carries the same
 * substitution (textarea, button, select, checkbox, radio-group, tabs, switch).
 *
 * `--input` is `oklch(1 0 0 / 15%)` — a colour that already carries alpha. On web, `/30`
 * multiplies into it and the field lifts off the background by 4.5% white. react-native-css
 * *replaces* the alpha instead, so the registry class paints a 30% white slab: the "ugly grey
 * box" every dark-mode field showed. Spelling the composite out keeps the two clients looking
 * the same, and survives the day the modifier starts multiplying — a token-relative `/5` would
 * silently become invisible.
 */
function Input({
  className,
  ...props
}: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  return (
    <TextInput
      className={cn(
        'dark:bg-white/5 border-input bg-background text-foreground flex h-10 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5 sm:h-9',
        props.editable === false &&
          cn(
            'opacity-50',
            Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' }),
          ),
        Platform.select({
          web: cn(
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          ),
          native: 'placeholder:text-muted-foreground/50',
        }),
        className,
      )}
      {...props}
    />
  )
}

export { Input }
