#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const outputPath = join(
  root,
  'apps/mobile/src/features/terminal/webview/terminal-html.generated.ts',
)
const xtermRoot = join(root, 'apps/desktop/node_modules/@xterm/xterm')
const fitRoot = join(root, 'apps/desktop/node_modules/@xterm/addon-fit')

function read(path) {
  return readFileSync(path, 'utf8')
}

const xterm = read(join(xtermRoot, 'lib/xterm.js'))
const fit = read(join(fitRoot, 'lib/addon-fit.js'))
const css = read(join(xtermRoot, 'css/xterm.css'))

const bridge = String.raw`<script>
(() => {
  const themes = {
    dark: { background: '#16161a', foreground: '#e4e4e7', cursor: '#e4e4e7', selectionBackground: '#3f3f46' },
    light: {
      background: '#ffffff', foreground: '#1f2328', cursor: '#1f2328', selectionBackground: '#b4d4ff',
      black: '#24292e', red: '#cf222e', green: '#116329', yellow: '#7d4e00', blue: '#0969da',
      magenta: '#8250df', cyan: '#1b7c83', white: '#6e7781', brightBlack: '#57606a',
      brightRed: '#a40e26', brightGreen: '#1a7f37', brightYellow: '#633c01', brightBlue: '#218bff',
      brightMagenta: '#a475f9', brightCyan: '#3192aa', brightWhite: '#8c959f'
    }
  }
  const post = (message) => {
    if (window.ReactNativeWebView !== undefined) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message))
    }
  }
  const terminal = new globalThis.Terminal({
    allowProposedApi: true,
    cursorBlink: true,
    fontFamily: 'ui-monospace, Menlo, monospace',
    fontSize: 12,
    lineHeight: 1,
    scrollback: 5000,
    theme: themes[window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light']
  })
  const fit = new globalThis.FitAddon.FitAddon()
  const root = document.getElementById('terminal')
  let fitTimer
  let lastSize = { cols: 0, rows: 0 }
  const reportCursorMode = () => post({ t: 'cursor-mode', application: terminal.modes.applicationCursorKeysMode })
  const fitTerminal = () => {
    try {
      fit.fit()
      if (terminal.cols !== lastSize.cols || terminal.rows !== lastSize.rows) {
        lastSize = { cols: terminal.cols, rows: terminal.rows }
        post({ t: 'resize', cols: terminal.cols, rows: terminal.rows })
      }
      reportCursorMode()
    } catch {}
  }
  const scheduleFit = () => {
    if (fitTimer !== undefined) window.clearTimeout(fitTimer)
    fitTimer = window.setTimeout(() => {
      fitTimer = undefined
      fitTerminal()
    }, 120)
  }
  terminal.loadAddon(fit)
  terminal.open(root)
  const helper = root.querySelector('.xterm-helper-textarea')
  if (helper !== null) {
    helper.setAttribute('autocapitalize', 'off')
    helper.setAttribute('autocorrect', 'off')
    helper.setAttribute('autocomplete', 'off')
    helper.setAttribute('spellcheck', 'false')
  }
  let pointerStart
  root.addEventListener('pointerdown', (event) => {
    pointerStart = { x: event.clientX, y: event.clientY }
  }, { capture: true })
  root.addEventListener('pointermove', (event) => {
    if (pointerStart === undefined) return
    if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 10) {
      terminal.blur()
    }
  }, { capture: true })
  root.addEventListener('pointerup', (event) => {
    if (pointerStart !== undefined && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) <= 10) {
      terminal.focus()
    }
    pointerStart = undefined
  }, { capture: true })
  root.addEventListener('pointercancel', () => {
    pointerStart = undefined
  }, { capture: true })
  terminal.onData((data) => post({ t: 'input', data }))
  terminal.onResize(({ cols, rows }) => {
    if (cols !== lastSize.cols || rows !== lastSize.rows) {
      lastSize = { cols, rows }
      post({ t: 'resize', cols, rows })
    }
  })
  terminal.onWriteParsed(reportCursorMode)
  if (helper !== null) {
    helper.addEventListener('focus', () => post({ t: 'focus', focused: true }))
    helper.addEventListener('blur', () => post({ t: 'focus', focused: false }))
  }
  terminal.registerLinkProvider({
    provideLinks(lineNumber, callback) {
      const line = terminal.buffer.active.getLine(lineNumber - 1)
      const text = line === undefined ? '' : line.translateToString()
      const links = []
      const expression = /https?:\/\/[^\s<>'"]+/g
      let match
      while ((match = expression.exec(text)) !== null) {
        const url = match[0]
        links.push({
          text: url,
          range: {
            start: { x: match.index + 1, y: lineNumber },
            end: { x: match.index + url.length, y: lineNumber }
          },
          activate: () => post({ t: 'link', url })
        })
      }
      callback(links)
    }
  })
  window.__porcelainTerminalWrite = (data) => terminal.write(data, reportCursorMode)
  window.__porcelainTerminalReset = () => {
    terminal.reset()
    lastSize = { cols: 0, rows: 0 }
    scheduleFit()
  }
  window.__porcelainTerminalFit = () => {
    fitTerminal()
    scheduleFit()
  }
  window.__porcelainTerminalFocus = () => terminal.focus()
  window.__porcelainTerminalBlur = () => terminal.blur()
  window.__porcelainTerminalFontSize = (size) => {
    terminal.options.fontSize = size
    scheduleFit()
  }
  window.__porcelainTerminalTheme = (mode) => {
    terminal.options.theme = themes[mode] || themes.dark
  }
  new ResizeObserver(scheduleFit).observe(root)
  window.addEventListener('resize', scheduleFit)
  window.addEventListener('orientationchange', scheduleFit)
  scheduleFit()
  post({ t: 'ready' })
})()
</script>`

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>${css}
html,body,#terminal{width:100%;height:100%;margin:0;overflow:hidden;background:#16161a}
body{touch-action:none;-webkit-user-select:none;user-select:none}
.xterm{height:100%;padding:8px;box-sizing:border-box}
.xterm-viewport{background:transparent!important}
.xterm-helper-textarea{autocapitalize:none;autocorrect:off;autocomplete:off;spellcheck:false}
</style></head><body><div id="terminal"></div><script>${xterm}</script><script>${fit}</script>${bridge}</body></html>`
const generated = `export const TERMINAL_HTML = ${JSON.stringify(html)}\n`

if (process.argv.includes('--check')) {
  const current = read(outputPath)
  if (current !== generated) {
    console.error('terminal-html.generated.ts is stale; run pnpm mobile:terminal:html')
    process.exit(1)
  }
  console.log('terminal-html.generated.ts: up to date')
} else {
  writeFileSync(outputPath, generated)
  console.log(`Wrote ${outputPath}`)
}
