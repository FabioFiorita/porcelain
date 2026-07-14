import { execFile } from 'node:child_process'
import { accessSync, constants, existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { TimelineItem } from '../../../shared/agent-protocol'
import {
  assistantItem,
  capItems,
  pathsEqual,
  previewText,
  reasoningItem,
  toolItem,
  truncateOutput,
  userItem,
} from '../session-import'
import type { ExternalSessionInfo, ImportSessionResult } from '../types'

const execFileAsync = promisify(execFile)

/**
 * List + import OpenCode sessions for a repo.
 *
 * List: scan `~/.local/share/opencode/storage/session/<projectId>/ses_*.json` (lightweight
 * session meta with `directory` + `title`). Avoids `node:sqlite` so vitest/vite can
 * transform this module without bundling Node builtins.
 *
 * Import: `opencode export <id>` (JSON on stdout) → map messages/parts to timeline.
 * Resume handle is the bare session id string (matches opencode.ts).
 */

function dataHome(home = homedir()): string {
  return process.env.XDG_DATA_HOME && process.env.XDG_DATA_HOME !== ''
    ? process.env.XDG_DATA_HOME
    : join(home, '.local', 'share')
}

export function opencodeSessionStorageRoot(home = homedir()): string {
  return join(dataHome(home), 'opencode', 'storage', 'session')
}

function resolveOpencodeBin(env: NodeJS.ProcessEnv = process.env): string | null {
  const override = env.PORCELAIN_OPENCODE_BIN
  if (override && override !== '') {
    try {
      accessSync(override, constants.X_OK)
      return override
    } catch {
      // fall through
    }
  }
  for (const dir of (env.PATH ?? '').split(':')) {
    if (dir === '') continue
    const candidate = join(dir, 'opencode')
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      // next
    }
  }
  for (const candidate of [
    join(homedir(), '.opencode', 'bin', 'opencode'),
    '/opt/homebrew/bin/opencode',
    '/usr/local/bin/opencode',
  ]) {
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      // next
    }
  }
  return null
}

export async function listOpencodeSessions(
  repoPath: string,
  limit = 30,
  home = homedir(),
): Promise<ExternalSessionInfo[]> {
  const root = opencodeSessionStorageRoot(home)
  if (!existsSync(root)) return []
  let projectDirs: string[]
  try {
    projectDirs = await readdir(root)
  } catch {
    return []
  }
  const out: ExternalSessionInfo[] = []
  for (const project of projectDirs) {
    const dir = join(root, project)
    let files: string[]
    try {
      files = await readdir(dir)
    } catch {
      continue
    }
    for (const file of files) {
      if (!file.startsWith('ses_') || !file.endsWith('.json')) continue
      const path = join(dir, file)
      try {
        const raw = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
        const directory = typeof raw.directory === 'string' ? raw.directory : ''
        if (!pathsEqual(repoPath, directory)) continue
        const id = typeof raw.id === 'string' ? raw.id : file.replace(/\.json$/, '')
        const titleRaw = typeof raw.title === 'string' ? raw.title : 'OpenCode session'
        const title =
          titleRaw.trim() === '' || /^New session/i.test(titleRaw) ? 'OpenCode session' : titleRaw
        const time = raw.time as Record<string, unknown> | undefined
        let updatedAt =
          typeof time?.updated === 'number'
            ? time.updated
            : typeof time?.created === 'number'
              ? time.created
              : 0
        if (!updatedAt) updatedAt = (await stat(path)).mtimeMs
        let model: string | undefined
        const modelField = raw.model
        if (modelField && typeof modelField === 'object') {
          const idField = (modelField as { id?: unknown }).id
          if (typeof idField === 'string') model = idField
        }
        out.push({
          provider: 'opencode',
          externalId: id,
          title,
          updatedAt,
          ...(model ? { model } : {}),
        })
      } catch {
        // skip corrupt
      }
    }
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt)
  return out.slice(0, limit)
}

export async function importOpencodeSession(
  repoPath: string,
  externalId: string,
  home = homedir(),
): Promise<ImportSessionResult | null> {
  // Confirm the session belongs to this repo via the meta file when present.
  const listed = await listOpencodeSessions(repoPath, 200, home)
  const meta = listed.find((s) => s.externalId === externalId)
  // If we can't list it for this repo, still try export — the export itself carries directory.
  const bin = resolveOpencodeBin(process.env)
  if (bin === null) return null

  let stdout: string
  try {
    const result = await execFileAsync(bin, ['export', externalId], {
      maxBuffer: 32 * 1024 * 1024,
      timeout: 30_000,
      env: process.env,
    })
    stdout = result.stdout
  } catch {
    return null
  }

  const exported = parseOpencodeExport(stdout)
  if (exported === null) return null
  if (!pathsEqual(repoPath, exported.directory)) return null

  const items = capItems(mapOpencodeExportMessages(exported.messages))
  return {
    title: exported.title || meta?.title || 'OpenCode session',
    ...(exported.model ? { model: exported.model } : meta?.model ? { model: meta.model } : {}),
    sessionState: externalId,
    items,
  }
}

interface OpencodeExport {
  directory: string
  title: string
  model?: string
  messages: Array<{
    info: Record<string, unknown>
    parts: Array<Record<string, unknown>>
  }>
}

/** Strip the "Exporting session: …" banner and parse the JSON body. */
export function parseOpencodeExport(stdout: string): OpencodeExport | null {
  const start = stdout.indexOf('{')
  if (start < 0) return null
  try {
    const raw = JSON.parse(stdout.slice(start)) as {
      info?: Record<string, unknown>
      messages?: Array<{ info?: Record<string, unknown>; parts?: Array<Record<string, unknown>> }>
    }
    const info = raw.info ?? {}
    const directory = typeof info.directory === 'string' ? info.directory : ''
    const title =
      typeof info.title === 'string' &&
      info.title.trim() !== '' &&
      !/^New session/i.test(info.title)
        ? info.title
        : 'OpenCode session'
    let model: string | undefined
    const modelField = info.model
    if (modelField && typeof modelField === 'object') {
      const id = (modelField as { id?: unknown }).id
      if (typeof id === 'string') model = id
    }
    const messages = (raw.messages ?? []).map((m) => ({
      info: m.info ?? {},
      parts: m.parts ?? [],
    }))
    return { directory, title, model, messages }
  } catch {
    return null
  }
}

export function mapOpencodeExportMessages(
  messages: Array<{ info: Record<string, unknown>; parts: Array<Record<string, unknown>> }>,
): TimelineItem[] {
  const items: TimelineItem[] = []
  let n = 0
  const nextId = (prefix: string): string => {
    n += 1
    return `import-opencode-${prefix}-${n}`
  }

  for (const msg of messages) {
    const role = msg.info.role
    if (role === 'user') {
      for (const part of msg.parts) {
        if (part.type === 'text' && typeof part.text === 'string' && part.text.trim() !== '') {
          items.push(userItem(nextId('user'), part.text.trim()))
        }
      }
      continue
    }
    if (role === 'assistant') {
      for (const part of msg.parts) {
        if (part.type === 'text' && typeof part.text === 'string' && part.text.trim() !== '') {
          items.push(assistantItem(nextId('asst'), part.text.trim()))
        } else if (
          part.type === 'reasoning' &&
          typeof part.text === 'string' &&
          part.text.trim() !== ''
        ) {
          items.push(reasoningItem(nextId('reason'), part.text.trim()))
        } else if (part.type === 'tool') {
          const name = typeof part.tool === 'string' ? part.tool : 'tool'
          const callId =
            (typeof part.callID === 'string' && part.callID) ||
            (typeof part.id === 'string' && part.id) ||
            nextId('tool')
          const state = (part.state ?? {}) as Record<string, unknown>
          const statusRaw = state.status
          const status: 'ok' | 'error' =
            statusRaw === 'error' || statusRaw === 'failed' ? 'error' : 'ok'
          let detail: string | undefined
          const input = state.input
          if (input && typeof input === 'object') {
            const first = Object.values(input as Record<string, unknown>).find(
              (v) => typeof v === 'string',
            )
            if (typeof first === 'string') detail = previewText(first, 60)
          }
          let output: string | undefined
          if (typeof state.output === 'string') output = state.output
          else if (typeof state.error === 'string') output = state.error
          items.push(
            toolItem(callId, name, status, detail, output ? truncateOutput(output) : undefined),
          )
        }
      }
    }
  }
  return items
}

/** Pure mapper used by tests (same shape as export messages). */
export function mapOpencodeMessages(
  messages: Array<{ id: string; data: string }>,
  partsByMessage: Map<string, Array<Record<string, unknown>>>,
): TimelineItem[] {
  return mapOpencodeExportMessages(
    messages.map((m) => {
      let info: Record<string, unknown> = {}
      try {
        info = JSON.parse(m.data) as Record<string, unknown>
      } catch {
        info = {}
      }
      return { info, parts: partsByMessage.get(m.id) ?? [] }
    }),
  )
}
