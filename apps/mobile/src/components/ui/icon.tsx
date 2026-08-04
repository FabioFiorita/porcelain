import type { LucideIcon, LucideProps } from 'lucide-react-native'
import * as React from 'react'
import { useColorScheme } from 'react-native'
import { TextClassContext } from '@/components/ui/text'
import { cn } from '@/lib/utils'

type IconProps = LucideProps & {
  as: LucideIcon
  className?: string
} & React.RefAttributes<LucideIcon>

/**
 * Semantic text color tokens we map onto Lucide's `color` prop.
 * Do not wrap Lucide in NativeWind `styled()` — className→style on Svg leaves Path
 * hosts unregistered and shows "Unimplemented component: RNSVGPath".
 */
const COLOR_TOKEN_RE =
  /\btext-(foreground|muted-foreground|primary|primary-foreground|accent-foreground|destructive|secondary-foreground|card-foreground|popover-foreground)\b/

/** Hex approximations of Porcelain tokens — SVG stroke needs concrete colors, not className. */
const FALLBACK: Record<'light' | 'dark', Record<string, string>> = {
  light: {
    foreground: '#171A1C',
    'muted-foreground': '#687076',
    primary: '#0A84FF',
    'primary-foreground': '#F5F7FA',
    'accent-foreground': '#171A1C',
    destructive: '#E5484D',
    'secondary-foreground': '#171A1C',
    'card-foreground': '#171A1C',
    'popover-foreground': '#171A1C',
  },
  dark: {
    foreground: '#F5F7FA',
    'muted-foreground': '#A7B0BB',
    primary: '#0A84FF',
    'primary-foreground': '#F5F7FA',
    'accent-foreground': '#F5F7FA',
    destructive: '#FF6369',
    'secondary-foreground': '#F5F7FA',
    'card-foreground': '#F5F7FA',
    'popover-foreground': '#F5F7FA',
  },
}

function tokenFromClassName(className: string | undefined): string {
  if (!className) return 'foreground'
  const match = COLOR_TOKEN_RE.exec(className)
  return match?.[1] ?? 'foreground'
}

/**
 * Lucide icon with NativeWind-friendly color classes.
 * Prefer `className="text-muted-foreground"` (or TextClassContext); optional `color` wins.
 */
function Icon({ as: IconComponent, className, size = 14, color, ...props }: IconProps) {
  const textClass = React.useContext(TextClassContext)
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light'
  const mergedClassName = cn('text-foreground', textClass, className)
  const token = tokenFromClassName(mergedClassName)
  const resolvedColor =
    typeof color === 'string' && color.length > 0
      ? color
      : (FALLBACK[scheme][token] ?? FALLBACK[scheme].foreground)

  return (
    <IconComponent
      accessibilityElementsHidden
      importantForAccessibility="no"
      color={resolvedColor}
      size={size}
      {...props}
    />
  )
}

export { Icon }
