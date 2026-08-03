import { type AppearanceScheme, type InkColor, ink } from '@/theme/colors'

/**
 * What a path looks like in a list. The extension table mirrors the renderer's
 * `viewer/file-icon.tsx` one-for-one — a `.ts` file has to read blue on the phone and blue in the
 * sidebar, or the two clients are telling different stories about the same repo.
 *
 * Symbol names are string literals for the same reason `changes/lib/status.ts` keeps them: this
 * module stays clear of `@expo/ui`'s dependency graph and can be unit tested. They still have to be
 * real SF Symbols — the canvas draws nothing for a name iOS does not know.
 */

export type FileSymbol = { name: string; tint: string }

type IconSpec = { symbol: string; ink: InkColor }

const CODE = 'chevron.left.forwardslash.chevron.right'
const BRACES = 'curlybraces'
const CONFIG = 'gearshape'
const STYLE = 'paintbrush'
const PROSE = 'text.alignleft'
const PLAIN = 'doc.plaintext'
const DATA = 'cylinder'
const SHELL = 'terminal'
const IMAGE = 'photo'
const TYPEFACE = 'textformat'
const LOCKED = 'lock.doc'
const TEST = 'testtube.2'
const FILE = 'doc'

const BY_EXTENSION: Record<string, IconSpec | undefined> = {
  bash: { ink: 'green', symbol: SHELL },
  c: { ink: 'indigo', symbol: CODE },
  cjs: { ink: 'yellow', symbol: CODE },
  cpp: { ink: 'indigo', symbol: CODE },
  css: { ink: 'pink', symbol: STYLE },
  cts: { ink: 'blue', symbol: CODE },
  gif: { ink: 'violet', symbol: IMAGE },
  go: { ink: 'cyan', symbol: CODE },
  h: { ink: 'indigo', symbol: CODE },
  html: { ink: 'orange', symbol: CODE },
  ico: { ink: 'violet', symbol: IMAGE },
  ini: { ink: 'teal', symbol: CONFIG },
  java: { ink: 'red', symbol: CODE },
  jpeg: { ink: 'violet', symbol: IMAGE },
  jpg: { ink: 'violet', symbol: IMAGE },
  js: { ink: 'yellow', symbol: CODE },
  json: { ink: 'amber', symbol: BRACES },
  jsonc: { ink: 'amber', symbol: BRACES },
  jsx: { ink: 'yellow', symbol: CODE },
  kt: { ink: 'purple', symbol: CODE },
  less: { ink: 'pink', symbol: STYLE },
  lock: { ink: 'muted', symbol: LOCKED },
  md: { ink: 'sky', symbol: PROSE },
  mdx: { ink: 'sky', symbol: PROSE },
  mjs: { ink: 'yellow', symbol: CODE },
  mts: { ink: 'blue', symbol: CODE },
  otf: { ink: 'muted', symbol: TYPEFACE },
  png: { ink: 'violet', symbol: IMAGE },
  py: { ink: 'emerald', symbol: CODE },
  rb: { ink: 'red', symbol: CODE },
  rs: { ink: 'orange', symbol: CODE },
  scss: { ink: 'pink', symbol: STYLE },
  sh: { ink: 'green', symbol: SHELL },
  sql: { ink: 'violet', symbol: DATA },
  svelte: { ink: 'orange', symbol: CODE },
  svg: { ink: 'violet', symbol: IMAGE },
  swift: { ink: 'orange', symbol: CODE },
  toml: { ink: 'teal', symbol: CONFIG },
  ts: { ink: 'blue', symbol: CODE },
  tsx: { ink: 'blue', symbol: CODE },
  ttf: { ink: 'muted', symbol: TYPEFACE },
  txt: { ink: 'muted', symbol: PLAIN },
  vue: { ink: 'emerald', symbol: CODE },
  webp: { ink: 'violet', symbol: IMAGE },
  woff: { ink: 'muted', symbol: TYPEFACE },
  woff2: { ink: 'muted', symbol: TYPEFACE },
  yaml: { ink: 'teal', symbol: CONFIG },
  yml: { ink: 'teal', symbol: CONFIG },
  zsh: { ink: 'green', symbol: SHELL },
}

const TEST_PATTERN = /\.(test|spec)\.[a-z]+$/

function specFor(name: string): IconSpec {
  if (TEST_PATTERN.test(name)) return { ink: 'emerald', symbol: TEST }
  const extension = name.split('.').at(-1)?.toLowerCase() ?? ''
  return BY_EXTENSION[extension] ?? { ink: 'muted', symbol: FILE }
}

export function fileSymbol(name: string, scheme: AppearanceScheme): FileSymbol {
  const spec = specFor(name)
  return { name: spec.symbol, tint: ink(spec.ink, scheme) }
}

export function folderSymbol(open: boolean, scheme: AppearanceScheme): FileSymbol {
  return { name: open ? 'folder.fill' : 'folder', tint: ink('sky', scheme) }
}

/** The disclosure triangle, in its own slot ahead of the folder glyph. */
export function disclosureSymbol(open: boolean, scheme: AppearanceScheme): FileSymbol {
  return { name: open ? 'chevron.down' : 'chevron.right', tint: ink('muted', scheme) }
}
