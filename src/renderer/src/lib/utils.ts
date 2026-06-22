import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Our custom sub-xs font-size tokens (main.css @theme: text-4xs … text-sm-minus)
// share the `text-` prefix with color utilities. Plain tailwind-merge reads the
// hyphenated ones (text-sm-minus, text-xs-minus, text-xs-plus, text-2xs-plus) as
// color names and DROPS them when an element also carries a text-color — e.g.
// cn('… text-sm-minus', 'text-foreground') would silently lose the size. Register
// the whole custom scale as font sizes so both classes survive the merge.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['4xs', '3xs', '2xs', '2xs-plus', 'xs-minus', 'xs-plus', 'sm-minus'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
