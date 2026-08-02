import type { EnvironmentIcon } from '@/lib/daemon/environment'

export type EnvironmentIconSymbol = 'desktopcomputer' | 'terminal' | 'laptopcomputer'

type EnvironmentIconOption = {
  id: EnvironmentIcon
  label: string
  systemImage: EnvironmentIconSymbol
}

export const ENVIRONMENT_ICON_OPTIONS: readonly EnvironmentIconOption[] = [
  { id: 'desktop', label: 'Desktop', systemImage: 'desktopcomputer' },
  { id: 'terminal', label: 'Terminal', systemImage: 'terminal' },
  { id: 'notebook', label: 'Notebook', systemImage: 'laptopcomputer' },
]

const SYSTEM_IMAGES: Record<EnvironmentIcon, EnvironmentIconSymbol> = {
  desktop: 'desktopcomputer',
  notebook: 'laptopcomputer',
  terminal: 'terminal',
}

export function environmentIconSymbol(icon: EnvironmentIcon): EnvironmentIconSymbol {
  return SYSTEM_IMAGES[icon]
}
