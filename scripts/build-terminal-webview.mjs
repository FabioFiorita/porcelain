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
/**
 * The same Nerd Font the renderer loads (`apps/web/src/lib/terminal-registry.ts`), subset to the
 * ranges a shell prompt actually draws from. Without it a Powerlevel10k or Starship prompt renders
 * its icons as blank cells — the glyph is missing but the terminal grid still spends the column, so
 * a path arrives wearing four spaces of phantom indent.
 *
 * Committed rather than generated: subsetting needs fonttools, and a build that works everywhere
 * beats one that needs a Python toolchain. Regenerate from the vendored TTF beside it with
 *   pyftsubset SymbolsNerdFontMono-Regular.ttf \
 *     --unicodes="U+E0A0-E0D4,U+F300-F372,U+F000-F2FF,U+F400-F533" \
 *     --flavor=woff2 --output-file=SymbolsNerdFontMono-Subset.woff2
 * — powerline separators, distro logos, Font Awesome (where p10k's defaults live) and octicons.
 * The full face is 2.4 MB; this is 165 KB, and it rides in the bundle as base64.
 */
const symbolsFont = join(root, 'apps/web/src/assets/fonts/SymbolsNerdFontMono-Subset.woff2')

function read(path) {
  return readFileSync(path, 'utf8')
}

const xterm = read(join(xtermRoot, 'lib/xterm.js'))
const fit = read(join(fitRoot, 'lib/addon-fit.js'))
const css = read(join(xtermRoot, 'css/xterm.css'))
const symbols = readFileSync(symbolsFont).toString('base64')

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
    // Symbols second, as in the renderer: text comes from the system mono, and the subset only
    // carries private-use codepoints, so the browser falls through to it per glyph.
    fontFamily: 'ui-monospace, "Symbols Nerd Font Mono", Menlo, monospace',
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
    const theme = themes[mode] || themes.dark
    terminal.options.theme = theme
    // The page behind the canvas has to move too. xterm only paints its own rows, so a
    // hardcoded body background frames a light terminal in black the moment the appearance flips.
    document.documentElement.style.background = theme.background
    document.body.style.background = theme.background
  }
  new ResizeObserver(scheduleFit).observe(root)
  window.addEventListener('resize', scheduleFit)
  window.addEventListener('orientationchange', scheduleFit)
  scheduleFit()
  post({ t: 'ready' })
})()
</script>`

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>${css}
@font-face{font-family:"Symbols Nerd Font Mono";src:url(data:font/woff2;base64,${symbols}) format("woff2");font-display:block}
html,body,#terminal{width:100%;height:100%;margin:0;overflow:hidden;background:#ffffff}
@media (prefers-color-scheme: dark){html,body,#terminal{background:#16161a}}
body{touch-action:none;-webkit-user-select:none;user-select:none}
.xterm{height:100%;padding:8px;box-sizing:border-box}
.xterm-viewport{background:transparent!important}
.xterm-helper-textarea{autocapitalize:none;autocorrect:off;autocomplete:off;spellcheck:false}
</style></head><body><div id="terminal"></div><script>${xterm}</script><script>${fit}</script>${bridge}</body></html>`
const generated = `export const TERMINAL_HTML = ${JSON.stringify(html)}\n`

if (process.argv.includes('--check')) {
  const current = read(outputPath)
  if (current !== generated) {
    console.error(
      'terminal-html.generated.ts is stale; run node scripts/build-terminal-webview.mjs',
    )
    process.exit(1)
  }
  console.log('terminal-html.generated.ts: up to date')
} else {
  writeFileSync(outputPath, generated)
  console.log(`Wrote ${outputPath}`)
}
