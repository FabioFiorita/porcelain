import { terminalAdapterFor } from '@renderer/features/terminal'
import {
  attachTerminalFiles,
  chooseTerminalFiles,
  PASTE_FILE_TOO_LARGE_MESSAGE,
} from '@renderer/lib/terminal-file-attach'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useTerminalInputStore } from '@renderer/stores/terminal-input'
import type { GhosttyTheme } from '@renderer/terminal/ghostty/core'
import { GhosttyTerminalSurface } from '@renderer/terminal/ghostty/surface'
import { runUserAction, settleBackground } from '@shared/background'
import { toast } from 'sonner'
import { isBrowser, isCoarseTouch, isE2E } from './platform'
import type { TerminalClipboardContents } from './terminal-clipboard'
import {
  type ArrowDirection,
  controlByte,
  terminalArrowBytes,
  terminalEditBytes,
} from './terminal-keys'
import { Osc52StreamFilter } from './terminal-osc52'
import { attachTouchScroll } from './terminal-touch-scroll'
import { resolveTheme, subscribeResolvedTheme } from './theme'
import { shellTrpcClient } from './trpc'
import { copyText } from './utils'
/** Palette values stay CSS-facing for the viewer and existing product tests. */
export const TERMINAL_THEMES = {
  dark: {
    background: '#16161a',
    foreground: '#e4e4e7',
    cursor: '#e4e4e7',
    selectionBackground: '#3f3f46',
  },
  light: {
    background: '#ffffff',
    foreground: '#1f2328',
    cursor: '#1f2328',
    selectionBackground: '#b4d4ff',
    black: '#24292e',
    red: '#cf222e',
    green: '#116329',
    yellow: '#7d4e00',
    blue: '#0969da',
    magenta: '#8250df',
    cyan: '#1b7c83',
    white: '#6e7781',
    brightBlack: '#57606a',
    brightRed: '#a40e26',
    brightGreen: '#1a7f37',
    brightYellow: '#633c01',
    brightBlue: '#218bff',
    brightMagenta: '#a475f9',
    brightCyan: '#3192aa',
    brightWhite: '#8c959f',
  },
} as const

type TerminalMode = keyof typeof TERMINAL_THEMES

function color(value: string): { r: number; g: number; b: number } {
  const parsed = Number.parseInt(value.slice(1), 16)
  return { r: parsed >> 16, g: (parsed >> 8) & 0xff, b: parsed & 0xff }
}

function ghosttyTheme(mode: TerminalMode): GhosttyTheme {
  const theme = TERMINAL_THEMES[mode]
  return {
    background: color(theme.background),
    foreground: color(theme.foreground),
    cursor: color(theme.cursor),
    selectionBackground: theme.selectionBackground,
  }
}

function currentTerminalMode(): TerminalMode {
  return resolveTheme(usePreferencesStore.getState().theme)
}

/** Renderer-side half of the external navigation boundary for browser clients. */
function terminalExternalUrl(text: string): string | null {
  try {
    const url = new URL(text)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

interface Instance {
  readonly id: string
  readonly wrapper: HTMLDivElement
  readonly osc52: Osc52StreamFilter
  readonly selectionListeners: Set<() => void>
  readonly pasteQueue: string[]
  surface: GhosttyTerminalSurface | null
  creating: Promise<GhosttyTerminalSurface> | null
  initialReplay: string | null
  output: string[]
  outputUnits: number
  disposed: boolean
  disposeTouchScroll?: () => void
}

const instances = new Map<string, Instance>()
const seeded = new Set<string>()

/**
 * Chunks buffered while a terminal has data but no Ghostty surface (the bottom panel
 * shows one tab at a time, and a closed panel still receives the live stream). A
 * verbose process in an unmounted terminal would otherwise grow renderer memory for
 * the session's lifetime. Oldest chunks drop first — what a scrollback window would
 * have shown anyway. One PTY write is bounded by MAX_TERMINAL_WRITE_CODE_UNITS on
 * the daemon, so a single chunk can exceed this only trivially and never accumulates.
 */
const MAX_PENDING_OUTPUT_CODE_UNITS = 1024 * 1024

/** Push `visible` into `buffer`, then drop oldest chunks until the tracked unit
 *  count fits `maxUnits`. Always keeps at least the newest chunk. Pure so the
 *  eviction order is testable without a mounted surface. Returns the new count. */
export function pushCappedOutput(
  buffer: string[],
  units: number,
  visible: string,
  maxUnits: number,
): number {
  buffer.push(visible)
  units += visible.length
  while (units > maxUnits && buffer.length > 1) {
    units -= buffer.shift()?.length ?? 0
  }
  return units
}

function appendPendingOutput(instance: Instance, visible: string): void {
  instance.outputUnits = pushCappedOutput(
    instance.output,
    instance.outputUnits,
    visible,
    MAX_PENDING_OUTPUT_CODE_UNITS,
  )
}

function recordFor(id: string): Instance {
  const existing = instances.get(id)
  if (existing) return existing
  const wrapper = document.createElement('div')
  wrapper.className = 'porcelain-ghostty-terminal relative h-full w-full overflow-hidden'
  const instance: Instance = {
    id,
    wrapper,
    osc52: new Osc52StreamFilter(),
    selectionListeners: new Set(),
    pasteQueue: [],
    surface: null,
    creating: null,
    initialReplay: null,
    output: [],
    outputUnits: 0,
    disposed: false,
  }
  instances.set(id, instance)
  return instance
}

function notifySelection(instance: Instance): void {
  for (const listener of instance.selectionListeners) listener()
}

function focusAfterCreate(instance: Instance): void {
  if (!isCoarseTouch() && instance.wrapper.isConnected) instance.surface?.focus()
}

function ensureSurface(instance: Instance): Promise<GhosttyTerminalSurface> | null {
  if (instance.disposed) return null
  if (instance.surface) return Promise.resolve(instance.surface)
  if (instance.creating) return instance.creating
  if (!instance.wrapper.isConnected) return null

  instance.wrapper.replaceChildren()
  instance.creating = GhosttyTerminalSurface.create(instance.wrapper, {
    theme: ghosttyTheme(currentTerminalMode()),
    onData: (data) => terminalAdapterFor(instance.id).writeTerminal(instance.id, data),
    onResize: (cols, rows) =>
      terminalAdapterFor(instance.id).resizeTerminal(instance.id, cols, rows),
    onSelectionChange: () => notifySelection(instance),
    onCopy: (text) => {
      copyTerminalText(instance.id, text).catch(() => toast.error('Could not copy the selection'))
    },
    onPaste: (event) => {
      pasteBrowserClipboardEvent(
        instance.id,
        event.clipboardData?.getData('text/plain') ?? '',
      ).catch(() => {
        toast.error('Could not paste from the clipboard', {
          description: 'Try copying text again.',
        })
      })
    },
    beforeKey: (event) => beforeTerminalKey(instance, event),
    // Browser clients validate the scheme here; Electron repeats the allowlist
    // in its window-open handler before handing a URL to the OS.
    onLinkActivate: (text) => {
      const url = terminalExternalUrl(text)
      if (url !== null) window.open(url, '_blank', 'noopener,noreferrer')
    },
  })
    .then((surface) => {
      if (instance.disposed) {
        surface.dispose()
        throw new Error('terminal was disposed while renderer initialized')
      }
      instance.surface = surface
      instance.creating = null
      const replay = instance.initialReplay
      instance.initialReplay = null
      if (replay !== null) surface.resetAndWrite(replay)
      else for (const data of instance.output) surface.write(data)
      instance.output = []
      instance.outputUnits = 0
      for (const text of instance.pasteQueue.splice(0)) surface.paste(text)
      if (isCoarseTouch()) {
        instance.disposeTouchScroll = attachTouchScroll(
          (lines) => surface.scrollTouch(lines),
          () => Math.max(1, instance.wrapper.clientHeight / Math.max(1, surface.rows)),
          instance.wrapper,
        )
      }
      focusAfterCreate(instance)
      return surface
    })
    .catch((error: unknown) => {
      instance.creating = null
      if (!instance.disposed) {
        instance.wrapper.textContent =
          'Terminal renderer could not start. Reopen this terminal to retry.'
        console.error('[terminal] Ghostty renderer initialization failed', error)
      }
      throw error
    })
  // Callers retain their own interaction path; failures are visible in the host and
  // retry on the next attach without producing unhandled promise rejections.
  settleBackground(instance.creating, 'fallback')
  return instance.creating
}

function beforeTerminalKey(instance: Instance, event: KeyboardEvent): boolean {
  const id = instance.id
  const modifier = event.metaKey || event.ctrlKey
  const key = event.key.toLowerCase()
  const input = useTerminalInputStore.getState()
  if (event.type !== 'keydown') return true
  if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key) && input.pendingCtrlId === id) {
    input.clearCtrl()
    const data = controlByte(event.key)
    if (data !== null) {
      event.preventDefault()
      terminalAdapterFor(id).writeTerminal(id, data)
      return false
    }
  }
  if (
    modifier &&
    !event.altKey &&
    !event.shiftKey &&
    key === 'c' &&
    instance.surface?.hasSelection()
  ) {
    event.preventDefault()
    copyTerminalSelection(id).catch(() => toast.error('Could not copy the selection'))
    return false
  }
  if (!isBrowser && modifier && key === 'v') {
    event.preventDefault()
    runUserAction(
      () => pasteTerminalClipboard(id),
      () => {
        toast.error('Could not paste from the clipboard')
      },
    )
    return false
  }
  if (event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && key === 'k') {
    event.preventDefault()
    instance.surface?.clearViewport()
    return false
  }
  const edit = terminalEditBytes(event)
  if (edit !== null) {
    event.preventDefault()
    terminalAdapterFor(id).writeTerminal(id, edit)
    return false
  }
  return true
}

/** Route inbound PTY data through the persistent Ghostty surface or its early buffer. */
export function receiveData(id: string, data: string): void {
  seeded.add(id)
  const instance = recordFor(id)
  const visible = instance.osc52.process(data, (text) => {
    // OSC52 auto-copy is program-driven, not a user action: settle, don't toast.
    settleBackground(copyText(text), 'clipboard')
  })
  if (visible === '') return
  if (instance.surface) instance.surface.write(visible)
  else appendPendingOutput(instance, visible)
}

/** Reset a fresh renderer from daemon replay. Replay is intentionally OSC52-silent. */
export function receiveScrollback(id: string, scrollback: string): void {
  if (seeded.has(id)) return
  seeded.add(id)
  const instance = recordFor(id)
  instance.osc52.reset()
  const visible = instance.osc52.process(scrollback)
  if (instance.surface) instance.surface.resetAndWrite(visible)
  else instance.initialReplay = visible
}

export function receiveExit(id: string, exitCode: number): void {
  const footer = `\r\n\x1b[2m[process exited${exitCode ? ` (${exitCode})` : ''}]\x1b[0m\r\n`
  receiveData(id, footer)
}

export function attachTerminal(id: string, container: HTMLElement): void {
  const instance = recordFor(id)
  if (instance.disposed) return
  container.appendChild(instance.wrapper)
  const surface = ensureSurface(instance)
  // Creation failure already rendered its message in the wrapper (see ensureSurface).
  if (surface)
    settleBackground(
      surface.then((ready) => {
        if (instance.wrapper.parentElement !== container || instance.disposed) return
        ready.resizeToMount()
        focusAfterCreate(instance)
      }),
      'fallback',
    )
}

export function detachTerminal(id: string, container: HTMLElement): void {
  const wrapper = instances.get(id)?.wrapper
  if (wrapper?.parentElement === container) wrapper.remove()
}

export function fitTerminal(id: string): void {
  instances.get(id)?.surface?.resizeToMount()
}

export function focusTerminal(id: string): void {
  instances.get(id)?.surface?.focus()
}

export function blurTerminal(id: string): void {
  instances.get(id)?.surface?.blur()
}

export function isTerminalFocused(id: string): boolean {
  return instances.get(id)?.surface?.isFocused() ?? false
}

export function clearTerminalSelection(id: string): void {
  instances.get(id)?.surface?.clearSelection()
}

export function terminalSelectionText(id: string): string {
  return instances.get(id)?.surface?.getSelection() ?? ''
}

async function copyTerminalText(id: string, text: string): Promise<void> {
  if (text === '') return
  if (isBrowser) await copyText(text)
  else await shellTrpcClient.writeTerminalClipboardText.mutate(text)
  clearTerminalSelection(id)
}

export async function copyTerminalSelection(id: string): Promise<void> {
  await copyTerminalText(id, terminalSelectionText(id))
}

export function selectAllTerminal(id: string): void {
  instances.get(id)?.surface?.selectAll()
}

export function clearTerminalViewport(id: string): void {
  instances.get(id)?.surface?.clearViewport()
}

export function subscribeTerminalSelection(id: string, cb: () => void): (() => void) | null {
  const instance = instances.get(id)
  if (!instance?.surface) return null
  instance.selectionListeners.add(cb)
  return () => instance.selectionListeners.delete(cb)
}

export function getTerminalSelectionAnchor(
  id: string,
): { left: number; top: number; text: string } | null {
  const instance = instances.get(id)
  const surface = instance?.surface
  if (!instance || !surface) return null
  const text = surface.getSelection()
  const end = surface.getSelectionEndClientRect()
  const host = instance.wrapper.parentElement
  if (text === '' || !end || !host) return null
  const hostRect = host.getBoundingClientRect()
  const chipW = 88
  const chipH = 36
  return {
    left: Math.max(4, Math.min(end.right - hostRect.left - chipW, host.clientWidth - chipW - 4)),
    top: Math.max(
      4,
      Math.min(end.bottom - hostRect.top - chipH - 4, host.clientHeight - chipH - 4),
    ),
    text,
  }
}

export function sendTerminalInput(id: string, data: string): void {
  terminalAdapterFor(id).writeTerminal(id, data)
  instances.get(id)?.surface?.scrollToBottom()
}

export { attachTerminalFiles, chooseTerminalFiles, PASTE_FILE_TOO_LARGE_MESSAGE }

async function pasteTerminalContents(
  id: string,
  contents: TerminalClipboardContents,
): Promise<void> {
  if (contents.text === '') {
    toast.error('Nothing to paste')
    return
  }
  const instance = recordFor(id)
  if (instance.surface) instance.surface.paste(contents.text)
  else instance.pasteQueue.push(contents.text)
}

async function pasteBrowserClipboardEvent(id: string, text: string): Promise<void> {
  await pasteTerminalContents(id, { text })
}

async function readBrowserClipboard(): Promise<TerminalClipboardContents> {
  if (navigator.clipboard?.read !== undefined) {
    const items = await navigator.clipboard.read()
    let text = ''
    for (const item of items) {
      if (text === '' && item.types.includes('text/plain'))
        text = await (await item.getType('text/plain')).text()
    }
    return { text }
  }
  if (navigator.clipboard?.readText !== undefined)
    return { text: await navigator.clipboard.readText() }
  throw new Error('Clipboard API unavailable')
}

export async function pasteTerminalClipboard(id: string): Promise<void> {
  try {
    await pasteTerminalContents(
      id,
      isBrowser
        ? await readBrowserClipboard()
        : await shellTrpcClient.readTerminalClipboard.mutate(),
    )
  } catch {
    toast.error('Cannot read the clipboard', {
      description: 'Paste in this browser requires clipboard permission.',
    })
  }
}

export function sendTerminalArrow(id: string, direction: ArrowDirection): void {
  const instance = instances.get(id)
  sendTerminalInput(
    id,
    terminalArrowBytes(direction, instance?.surface?.applicationCursorKeys() ?? false),
  )
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    for (const instance of instances.values()) instance.surface?.resizeToMount()
  })
}

if (typeof window !== 'undefined' && window.visualViewport) {
  let pending: ReturnType<typeof setTimeout> | undefined
  window.visualViewport.addEventListener('resize', () => {
    if (pending !== undefined) clearTimeout(pending)
    pending = setTimeout(() => {
      for (const instance of instances.values()) instance.surface?.resizeToMount()
    }, 100)
  })
}

subscribeResolvedTheme((mode) => {
  for (const instance of instances.values()) instance.surface?.setTheme(ghosttyTheme(mode))
})

if (isE2E) {
  window.__porcelainTerminalText = (index: number): string => {
    const surface = [...instances.values()][index]?.surface
    return surface?.textContentForTesting() ?? ''
  }
  window.__porcelainSetTerminalFontSize = (size: number): void => {
    for (const instance of instances.values()) {
      const resized = instance.surface?.setFont({ size })
      // E2E-only hook: a surface that cannot re-font keeps its current one.
      if (resized) settleBackground(resized, 'fallback')
    }
  }
}

export function disposeTerminal(id: string): void {
  const instance = instances.get(id)
  if (!instance) return
  instance.disposed = true
  instance.disposeTouchScroll?.()
  instance.surface?.dispose()
  instance.wrapper.remove()
  instance.osc52.reset()
  instances.delete(id)
  seeded.delete(id)
}
