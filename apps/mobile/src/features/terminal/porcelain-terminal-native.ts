import { requireNativeView, requireOptionalNativeModule } from 'expo'
import type { ComponentType } from 'react'
import type { NativeSyntheticEvent, ViewProps } from 'react-native'

const NATIVE_TERMINAL_SURFACE = 'PorcelainTerminalSurface'

type ExpoViewConfig = {
  readonly expo?: {
    getViewConfig?: (moduleName: string, viewName?: string) => unknown
  }
}

type TerminalInputEvent = {
  readonly data: string
}

type TerminalResizeEvent = {
  readonly cols: number
  readonly rows: number
}

type TerminalScrollEvent = {
  readonly lines: number
}

type TerminalKeyEvent = {
  readonly key: 'down' | 'left' | 'right' | 'up'
}

export type PorcelainTerminalNativeProps = ViewProps & {
  readonly appearanceScheme: 'dark' | 'light'
  readonly autoFocus?: boolean
  readonly backgroundColor: string
  readonly focusRequest?: number
  readonly scrollLines?: number
  readonly scrollRequest?: number
  readonly fontSize: number
  readonly foregroundColor: string
  readonly initialBuffer: string
  readonly mutedForegroundColor: string
  readonly terminalKey: string
  readonly themeConfig: string
  readonly onInput?: (event: NativeSyntheticEvent<TerminalInputEvent>) => void
  readonly onResize?: (event: NativeSyntheticEvent<TerminalResizeEvent>) => void
  readonly onScroll?: (event: NativeSyntheticEvent<TerminalScrollEvent>) => void
  readonly onKey?: (event: NativeSyntheticEvent<TerminalKeyEvent>) => void
}

type NativeTerminalConstants = {
  readonly hardwareKeyRevision?: number
}

let cachedSurface: ComponentType<PorcelainTerminalNativeProps> | undefined
let resolutionFailed = false

function hasViewConfig(): boolean {
  const expo = (globalThis as typeof globalThis & ExpoViewConfig).expo
  return expo?.getViewConfig?.(NATIVE_TERMINAL_SURFACE) != null
}

/** Returns null on an OTA bundle installed into a binary that predates the module. */
export function resolvePorcelainTerminalNativeView(): ComponentType<PorcelainTerminalNativeProps> | null {
  if (cachedSurface !== undefined) return cachedSurface
  if (resolutionFailed || !hasViewConfig()) return null

  try {
    cachedSurface = requireNativeView<PorcelainTerminalNativeProps>(NATIVE_TERMINAL_SURFACE)
    return cachedSurface
  } catch {
    resolutionFailed = true
    return null
  }
}

/** Lets diagnostics identify an installed binary with stale hardware-key support. */
export function nativeTerminalHardwareKeyRevision(): number | null {
  try {
    const module = requireOptionalNativeModule<NativeTerminalConstants>(NATIVE_TERMINAL_SURFACE)
    return module?.hardwareKeyRevision ?? null
  } catch {
    return null
  }
}
