import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { z } from 'zod'
import type { ProviderLimits, ProviderLimitWindow } from '../../../shared/agent-protocol'
import { terminalEnv } from '../../terminal-env'
import type { BinLookup } from './claude-stream'

/**
 * A bridge to the user-installed **codexbar** CLI (github.com/steipete/CodexBar), a menubar
 * app whose CLI prints a provider's subscription usage as JSON. The Claude/Codex drivers try
 * this FIRST for `limits()`: codexbar reads the quota through its own auth sources, so it's
 * more reliable than our native probe AND — crucially for the agent-driver invariant — the
 * provider's OAuth token never enters Porcelain on this path (codexbar holds its own auth).
 *
 * Same spawn discipline as the rest of the drivers: `terminalEnv` scrubs the daemon token /
 * ELECTRON_RUN_AS_NODE, the arg list is an array (no shell), and the binary is resolved from
 * an enumerated set (never a renderer-supplied string). codexbar's stdout carries the user's
 * account email, so it is NEVER logged; every failure degrades to null.
 */

const execFileAsync = promisify(execFile)

// codexbar can be slow to gather usage across providers; cap it so a hung probe can't stall
// the Limits poll. The output is a small JSON blob, so a 1MB buffer is generous.
const CODEXBAR_TIMEOUT_MS = 30_000
const CODEXBAR_MAX_BUFFER = 1_000_000

// --- binary resolution ------------------------------------------------------

/**
 * Resolve the `codexbar` binary the same way the driver CLIs are resolved (a GUI-launched
 * daemon has a minimal PATH): an explicit `PORCELAIN_CODEXBAR_BIN` override, then every dir
 * on PATH, then the well-known install locations. Pure w.r.t. the injected lookup so it's
 * unit-testable without touching the filesystem — the same `BinLookup` shape as the claude one.
 */
export function resolveCodexbarBin(lookup: BinLookup): string | null {
  const { exists, env } = lookup
  const override = env.PORCELAIN_CODEXBAR_BIN
  if (override && override.trim() !== '' && exists(override)) return override
  for (const dir of (env.PATH ?? '').split(':')) {
    if (dir === '') continue
    const candidate = join(dir, 'codexbar')
    if (exists(candidate)) return candidate
  }
  // Homebrew formula, Homebrew-Intel, and the bundled app helper a GUI-PATH daemon won't see.
  for (const candidate of [
    '/opt/homebrew/bin/codexbar',
    '/usr/local/bin/codexbar',
    '/Applications/CodexBar.app/Contents/Helpers/CodexBarCLI',
  ]) {
    if (exists(candidate)) return candidate
  }
  return null
}

// --- usage mapping ----------------------------------------------------------

// One usage window in codexbar's JSON. `windowMinutes` names the window (300 = 5-hour,
// 10080 = weekly), `usedPercent` is 0–100, and `resetsAt` is an OPTIONAL ISO-8601 string
// (present only once the window has usage). Read leniently — the payload carries more fields
// (identity/accountEmail, credits, pace, status) than we map, and any window may be null.
const codexbarWindowSchema = z.object({
  windowMinutes: z.number(),
  usedPercent: z.number(),
  resetsAt: z.string().optional(),
})

// An `extraRateWindows` entry: a window (same shape as the primary/secondary/tertiary slots)
// wrapped with codexbar's own `id` and `title`. These are scoped caps (e.g. "Fable only"), so
// the entry's title is a better label than our windowMinutes-derived one, and its id is the
// stable identity. Parsed leniently per entry, like every other slot.
const codexbarExtraWindowSchema = z.object({
  window: codexbarWindowSchema,
  title: z.string(),
  id: z.string(),
})

const codexbarItemSchema = z
  .object({
    provider: z.string(),
    usage: z
      .object({
        primary: z.unknown().optional(),
        secondary: z.unknown().optional(),
        tertiary: z.unknown().optional(),
        extraRateWindows: z.unknown().optional(),
      })
      .passthrough(),
  })
  .passthrough()

/** Derive a normalized window id + label from codexbar's `windowMinutes`. */
function windowIdentity(windowMinutes: number): { id: string; label: string } {
  if (windowMinutes === 300) return { id: '5h', label: '5-hour' }
  if (windowMinutes === 10080) return { id: 'weekly', label: 'Weekly' }
  const id = `window-${windowMinutes}`
  // An off-catalog window is labeled by whole days when it divides cleanly, else by hours.
  if (windowMinutes % 1440 === 0) return { id, label: `${windowMinutes / 1440}-day` }
  return { id, label: `${Math.round(windowMinutes / 60)}-hour` }
}

/** ISO-8601 → epoch ms, or undefined when absent/unparseable. */
function parseResetsAt(iso: string | undefined): number | undefined {
  if (iso === undefined) return undefined
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? undefined : ms
}

/**
 * Map codexbar's JSON into the normalized `ProviderLimits`. Accepts a single object or an
 * array; picks the first item whose `provider` equals the requested one, then maps its
 * `usage.primary`/`secondary`/`tertiary` windows (a null/unparseable slot is skipped), then any
 * `usage.extraRateWindows` (scoped caps labeled by their own title, keyed by their own id;
 * an entry colliding with an already-mapped id is skipped).
 * Returns null when nothing matches or no window survives — so the Limits group hides.
 */
export function mapCodexbarUsage(json: unknown, provider: string): ProviderLimits | null {
  const items = Array.isArray(json) ? json : [json]
  for (const raw of items) {
    const item = codexbarItemSchema.safeParse(raw)
    if (!item.success || item.data.provider !== provider) continue
    const windows: ProviderLimitWindow[] = []
    for (const slot of [
      item.data.usage.primary,
      item.data.usage.secondary,
      item.data.usage.tertiary,
    ]) {
      const window = codexbarWindowSchema.safeParse(slot)
      if (!window.success) continue
      const { id, label } = windowIdentity(window.data.windowMinutes)
      const resetsAt = parseResetsAt(window.data.resetsAt)
      windows.push({
        id,
        label,
        usedPercent: window.data.usedPercent,
        ...(resetsAt !== undefined ? { resetsAt } : {}),
      })
    }
    const extras = Array.isArray(item.data.usage.extraRateWindows)
      ? item.data.usage.extraRateWindows
      : []
    for (const rawExtra of extras) {
      const extra = codexbarExtraWindowSchema.safeParse(rawExtra)
      if (!extra.success) continue
      if (windows.some((w) => w.id === extra.data.id)) continue
      const resetsAt = parseResetsAt(extra.data.window.resetsAt)
      windows.push({
        id: extra.data.id,
        label: extra.data.title,
        usedPercent: extra.data.window.usedPercent,
        ...(resetsAt !== undefined ? { resetsAt } : {}),
      })
    }
    // The requested provider matched — this is THE item, so we're done either way.
    return windows.length > 0 ? { windows } : null
  }
  return null
}

// --- probe ------------------------------------------------------------------

/** One codexbar spawn for one codexbar provider id; every failure degrades to null quietly. */
async function probeCodexbar(
  bin: string,
  codexbarId: string,
  sourceCli: boolean,
): Promise<ProviderLimits | null> {
  try {
    const { stdout } = await execFileAsync(
      bin,
      [
        '--provider',
        codexbarId,
        ...(sourceCli ? ['--source', 'cli'] : []),
        '--format',
        'json',
        '--no-color',
      ],
      {
        env: terminalEnv(process.env),
        timeout: CODEXBAR_TIMEOUT_MS,
        maxBuffer: CODEXBAR_MAX_BUFFER,
      },
    )
    return mapCodexbarUsage(JSON.parse(stdout), codexbarId)
  } catch {
    return null
  }
}

/**
 * Run `codexbar --provider <p> [--source cli] --format json --no-color` and map its usage.
 * EVERY failure (spawn error, non-zero exit, timeout, unparseable JSON) returns null quietly.
 * NEVER logs stdout/stderr — codexbar's output carries the user's account email.
 *
 * `--source cli` for claude/codex is deliberate: without it codexbar's default `auto` prefers
 * claude.ai web cookies, which can belong to a DIFFERENT account than the CLI the agent threads
 * actually spend against (observed here returning a zeroed personal web session while the CLI
 * account was really at 47%/50%). Porcelain drives the provider CLIs, so the CLI account's quota
 * is the semantically right one — for Codex too.
 *
 * OpenCode maps to TWO codexbar ids: `opencodego` first (observed returning the real
 * subscription/zen usage for this account), then `opencode` as a fallback (observed failing
 * upstream with an HTTP 500 today, kept in case codexbar fixes it). NO `--source cli` for
 * either — codexbar rejects it for opencode ("Source 'cli' is not supported"), so its auto
 * source picks; note `mapCodexbarUsage` matches against the codexbar id actually queried.
 */
export async function codexbarLimits(
  provider: 'claude' | 'codex' | 'opencode',
  bin: string,
): Promise<ProviderLimits | null> {
  const attempts =
    provider === 'opencode'
      ? [
          { codexbarId: 'opencodego', sourceCli: false },
          { codexbarId: 'opencode', sourceCli: false },
        ]
      : [{ codexbarId: provider, sourceCli: true }]
  for (const { codexbarId, sourceCli } of attempts) {
    const limits = await probeCodexbar(bin, codexbarId, sourceCli)
    if (limits !== null) return limits
  }
  return null
}
