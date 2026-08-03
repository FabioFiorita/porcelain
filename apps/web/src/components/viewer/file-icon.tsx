import { cn } from '@renderer/lib/utils'
import {
  Braces,
  Database,
  File,
  FileCode,
  FileImage,
  FileLock2,
  FileText,
  FileType,
  FlaskConical,
  Folder,
  FolderOpen,
  Paintbrush,
  Settings,
  SquareTerminal,
} from 'lucide-react'

interface IconSpec {
  icon: typeof File
  className: string
}

const BY_EXTENSION: Record<string, IconSpec | undefined> = {
  ts: { icon: FileCode, className: 'text-ink-blue' },
  tsx: { icon: FileCode, className: 'text-ink-blue' },
  mts: { icon: FileCode, className: 'text-ink-blue' },
  cts: { icon: FileCode, className: 'text-ink-blue' },
  js: { icon: FileCode, className: 'text-ink-yellow' },
  jsx: { icon: FileCode, className: 'text-ink-yellow' },
  mjs: { icon: FileCode, className: 'text-ink-yellow' },
  cjs: { icon: FileCode, className: 'text-ink-yellow' },
  py: { icon: FileCode, className: 'text-ink-emerald' },
  rb: { icon: FileCode, className: 'text-ink-red' },
  go: { icon: FileCode, className: 'text-ink-cyan' },
  rs: { icon: FileCode, className: 'text-ink-orange' },
  swift: { icon: FileCode, className: 'text-ink-orange' },
  c: { icon: FileCode, className: 'text-ink-indigo' },
  h: { icon: FileCode, className: 'text-ink-indigo' },
  cpp: { icon: FileCode, className: 'text-ink-indigo' },
  java: { icon: FileCode, className: 'text-ink-red' },
  kt: { icon: FileCode, className: 'text-ink-purple' },
  html: { icon: FileCode, className: 'text-ink-orange' },
  vue: { icon: FileCode, className: 'text-ink-emerald' },
  svelte: { icon: FileCode, className: 'text-ink-orange' },
  json: { icon: Braces, className: 'text-ink-amber' },
  jsonc: { icon: Braces, className: 'text-ink-amber' },
  yml: { icon: Settings, className: 'text-ink-teal' },
  yaml: { icon: Settings, className: 'text-ink-teal' },
  toml: { icon: Settings, className: 'text-ink-teal' },
  ini: { icon: Settings, className: 'text-ink-teal' },
  css: { icon: Paintbrush, className: 'text-ink-pink' },
  scss: { icon: Paintbrush, className: 'text-ink-pink' },
  less: { icon: Paintbrush, className: 'text-ink-pink' },
  md: { icon: FileText, className: 'text-ink-sky' },
  mdx: { icon: FileText, className: 'text-ink-sky' },
  txt: { icon: FileText, className: 'text-muted-foreground' },
  sql: { icon: Database, className: 'text-ink-violet' },
  sh: { icon: SquareTerminal, className: 'text-ink-green' },
  zsh: { icon: SquareTerminal, className: 'text-ink-green' },
  bash: { icon: SquareTerminal, className: 'text-ink-green' },
  png: { icon: FileImage, className: 'text-ink-violet' },
  jpg: { icon: FileImage, className: 'text-ink-violet' },
  jpeg: { icon: FileImage, className: 'text-ink-violet' },
  gif: { icon: FileImage, className: 'text-ink-violet' },
  webp: { icon: FileImage, className: 'text-ink-violet' },
  svg: { icon: FileImage, className: 'text-ink-violet' },
  ico: { icon: FileImage, className: 'text-ink-violet' },
  ttf: { icon: FileType, className: 'text-muted-foreground' },
  otf: { icon: FileType, className: 'text-muted-foreground' },
  woff: { icon: FileType, className: 'text-muted-foreground' },
  woff2: { icon: FileType, className: 'text-muted-foreground' },
  lock: { icon: FileLock2, className: 'text-muted-foreground' },
}

const TEST_PATTERN = /\.(test|spec)\.[a-z]+$/

function specFor(name: string): IconSpec {
  if (TEST_PATTERN.test(name)) return { icon: FlaskConical, className: 'text-ink-emerald' }
  const ext = name.split('.').at(-1)?.toLowerCase() ?? ''
  return BY_EXTENSION[ext] ?? { icon: File, className: 'text-muted-foreground' }
}

export function FileTypeIcon({
  name,
  className,
}: {
  name: string
  className?: string
}): React.JSX.Element {
  const spec = specFor(name)
  return <spec.icon className={cn(spec.className, className)} />
}

export function FolderIcon({
  open,
  className,
}: {
  open?: boolean
  className?: string
}): React.JSX.Element {
  const Icon = open ? FolderOpen : Folder
  return <Icon className={cn('text-ink-sky/80', className)} />
}
