/**
 * Explicit light/dark CSS variable maps for VariableContextProvider.
 * Hex (not oklch): react-native-css runtime var injection does not parse oklch
 * strings, so runtime-provided oklch values paint as black.
 * Values track packages/ui/src/tokens.css light/dark palettes.
 */
export const LIGHT_THEME_VARS: Record<string, string> = {
  background: '#FFFFFF',
  foreground: '#0A0A0A',
  card: '#FFFFFF',
  'card-foreground': '#0A0A0A',
  popover: '#FFFFFF',
  'popover-foreground': '#0A0A0A',
  primary: '#171717',
  'primary-foreground': '#FAFAFA',
  secondary: '#F5F5F5',
  'secondary-foreground': '#171717',
  muted: '#F5F5F5',
  'muted-foreground': '#737373',
  accent: '#F5F5F5',
  'accent-foreground': '#171717',
  destructive: '#E7000B',
  border: '#E5E5E5',
  input: '#E5E5E5',
  ring: '#A1A1A1',
  sidebar: '#FAFAFA',
  'sidebar-foreground': '#0A0A0A',
  'sidebar-primary': '#171717',
  'sidebar-primary-foreground': '#FAFAFA',
  'sidebar-accent': '#F5F5F5',
  'sidebar-accent-foreground': '#171717',
  'sidebar-border': '#E5E5E5',
  'sidebar-ring': '#A1A1A1',
  success: '#009966',
  warning: '#E17100',
  info: '#0084D1',
}

export const DARK_THEME_VARS: Record<string, string> = {
  background: '#0A0A0A',
  foreground: '#FAFAFA',
  card: '#171717',
  'card-foreground': '#FAFAFA',
  popover: '#171717',
  'popover-foreground': '#FAFAFA',
  primary: '#E5E5E5',
  'primary-foreground': '#171717',
  secondary: '#262626',
  'secondary-foreground': '#FAFAFA',
  muted: '#262626',
  'muted-foreground': '#A1A1A1',
  accent: '#262626',
  'accent-foreground': '#FAFAFA',
  destructive: '#FF6467',
  border: 'rgba(255,255,255,0.10)',
  input: 'rgba(255,255,255,0.15)',
  ring: '#737373',
  sidebar: '#171717',
  'sidebar-foreground': '#FAFAFA',
  'sidebar-primary': '#E5E5E5',
  'sidebar-primary-foreground': '#171717',
  'sidebar-accent': '#262626',
  'sidebar-accent-foreground': '#FAFAFA',
  'sidebar-border': 'rgba(255,255,255,0.10)',
  'sidebar-ring': '#737373',
  success: '#00BC7D',
  warning: '#FE9A00',
  info: '#00A6F4',
}

/** The token map for a resolved scheme, for the native call sites that need hex, not classes. */
export function themeVarsFor(scheme: 'light' | 'dark'): Record<string, string> {
  return scheme === 'dark' ? DARK_THEME_VARS : LIGHT_THEME_VARS
}
