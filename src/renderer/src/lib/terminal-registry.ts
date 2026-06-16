import '@xterm/xterm/css/xterm.css'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'

/**
 * The renderer-side home for xterm.js instances. A terminal must outlive its React
 * view: the viewer only mounts the ACTIVE tab, so switching away from (or closing)
 * a terminal tab unmounts its component — but the PTY keeps running (a background
 * dev server) and its scrollback must survive. So each session's `Terminal` lives
 * here in a module-level registry, opened into a detached wrapper element the view
 * merely re-parents on mount; nothing is disposed until the session is truly closed.
 *
 * The dedicated terminal bridge is routed in by `useTerminalChannel` (mounted once in
 * AppShell, like `useAppEvents`): PTY output → `receiveData` writes the matching xterm
 * (buffered until the instance exists, so nothing is lost in the gap between spawn and
 * first mount), and an exit → `receiveExit` writes a dim footer line. Keystrokes and
 * fit-driven resizes flow back out per instance.
 */
interface Instance {
  term: Terminal
  fit: FitAddon
  wrapper: HTMLDivElement
}

const instances = new Map<string, Instance>()
const buffers = new Map<string, string[]>()

/** Route inbound PTY output to its xterm, buffering until the instance is mounted. */
export function receiveData(id: string, data: string): void {
  const instance = instances.get(id)
  if (instance) {
    instance.term.write(data)
    return
  }
  const buffer = buffers.get(id) ?? []
  buffer.push(data)
  buffers.set(id, buffer)
}

/** Write a dim footer line when a session's PTY exits. */
export function receiveExit(id: string, exitCode: number): void {
  const footer = `\r\n\x1b[2m[process exited${exitCode ? ` (${exitCode})` : ''}]\x1b[0m\r\n`
  const instance = instances.get(id)
  if (instance) instance.term.write(footer)
  else buffers.set(id, [...(buffers.get(id) ?? []), footer])
}

function create(id: string): Instance {
  const term = new Terminal({
    fontFamily: '"Geist Mono Variable", ui-monospace, SFMono-Regular, monospace',
    fontSize: 12,
    lineHeight: 1.2,
    cursorBlink: true,
    // Solid graphite, in the spirit of the app's neutral dark surfaces.
    theme: {
      background: '#16161a',
      foreground: '#e4e4e7',
      cursor: '#e4e4e7',
      selectionBackground: '#3f3f46',
    },
    scrollback: 10_000,
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  const wrapper = document.createElement('div')
  wrapper.style.height = '100%'
  wrapper.style.width = '100%'
  term.open(wrapper)
  // Keystrokes and fit-driven resizes flow back to this session's PTY over the bridge.
  term.onData((data) => window.porcelain.terminal.write(id, data))
  term.onResize(({ cols, rows }) => window.porcelain.terminal.resize(id, cols, rows))

  const instance: Instance = { term, fit, wrapper }
  instances.set(id, instance)
  const buffered = buffers.get(id)
  if (buffered) {
    for (const data of buffered) term.write(data)
    buffers.delete(id)
  }
  return instance
}

/** Re-parent the session's terminal into `container`, size it, and focus it. */
export function attachTerminal(id: string, container: HTMLElement): void {
  const instance = instances.get(id) ?? create(id)
  container.appendChild(instance.wrapper)
  // The wrapper now has layout — fit measures it and onResize tells the PTY.
  instance.fit.fit()
  instance.term.focus()
}

/** Detach the terminal from the DOM on unmount WITHOUT disposing it (PTY lives on). */
export function detachTerminal(id: string): void {
  instances.get(id)?.wrapper.remove()
}

export function fitTerminal(id: string): void {
  instances.get(id)?.fit.fit()
}

export function focusTerminal(id: string): void {
  instances.get(id)?.term.focus()
}

/** Tear down the xterm instance for good — the session is closing. */
export function disposeTerminal(id: string): void {
  const instance = instances.get(id)
  if (!instance) return
  instance.term.dispose()
  instance.wrapper.remove()
  instances.delete(id)
  buffers.delete(id)
}
