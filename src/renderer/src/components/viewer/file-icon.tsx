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
  ts: { icon: FileCode, className: 'text-blue-400' },
  tsx: { icon: FileCode, className: 'text-blue-400' },
  mts: { icon: FileCode, className: 'text-blue-400' },
  cts: { icon: FileCode, className: 'text-blue-400' },
  js: { icon: FileCode, className: 'text-yellow-400' },
  jsx: { icon: FileCode, className: 'text-yellow-400' },
  mjs: { icon: FileCode, className: 'text-yellow-400' },
  cjs: { icon: FileCode, className: 'text-yellow-400' },
  py: { icon: FileCode, className: 'text-emerald-400' },
  rb: { icon: FileCode, className: 'text-red-400' },
  go: { icon: FileCode, className: 'text-cyan-400' },
  rs: { icon: FileCode, className: 'text-orange-400' },
  swift: { icon: FileCode, className: 'text-orange-400' },
  c: { icon: FileCode, className: 'text-indigo-400' },
  h: { icon: FileCode, className: 'text-indigo-400' },
  cpp: { icon: FileCode, className: 'text-indigo-400' },
  java: { icon: FileCode, className: 'text-red-400' },
  kt: { icon: FileCode, className: 'text-purple-400' },
  html: { icon: FileCode, className: 'text-orange-400' },
  vue: { icon: FileCode, className: 'text-emerald-400' },
  svelte: { icon: FileCode, className: 'text-orange-400' },
  json: { icon: Braces, className: 'text-amber-400' },
  jsonc: { icon: Braces, className: 'text-amber-400' },
  yml: { icon: Settings, className: 'text-teal-400' },
  yaml: { icon: Settings, className: 'text-teal-400' },
  toml: { icon: Settings, className: 'text-teal-400' },
  ini: { icon: Settings, className: 'text-teal-400' },
  css: { icon: Paintbrush, className: 'text-pink-400' },
  scss: { icon: Paintbrush, className: 'text-pink-400' },
  less: { icon: Paintbrush, className: 'text-pink-400' },
  md: { icon: FileText, className: 'text-sky-400' },
  mdx: { icon: FileText, className: 'text-sky-400' },
  txt: { icon: FileText, className: 'text-muted-foreground' },
  sql: { icon: Database, className: 'text-violet-400' },
  sh: { icon: SquareTerminal, className: 'text-green-400' },
  zsh: { icon: SquareTerminal, className: 'text-green-400' },
  bash: { icon: SquareTerminal, className: 'text-green-400' },
  png: { icon: FileImage, className: 'text-violet-400' },
  jpg: { icon: FileImage, className: 'text-violet-400' },
  jpeg: { icon: FileImage, className: 'text-violet-400' },
  gif: { icon: FileImage, className: 'text-violet-400' },
  webp: { icon: FileImage, className: 'text-violet-400' },
  svg: { icon: FileImage, className: 'text-violet-400' },
  ico: { icon: FileImage, className: 'text-violet-400' },
  ttf: { icon: FileType, className: 'text-muted-foreground' },
  otf: { icon: FileType, className: 'text-muted-foreground' },
  woff: { icon: FileType, className: 'text-muted-foreground' },
  woff2: { icon: FileType, className: 'text-muted-foreground' },
  lock: { icon: FileLock2, className: 'text-muted-foreground' },
}

const TEST_PATTERN = /\.(test|spec)\.[a-z]+$/

function specFor(name: string): IconSpec {
  if (TEST_PATTERN.test(name)) return { icon: FlaskConical, className: 'text-emerald-400' }
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
  return <Icon className={cn('text-sky-400/80', className)} />
}
