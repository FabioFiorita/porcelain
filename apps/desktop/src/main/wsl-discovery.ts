import { execFile } from 'node:child_process'
import type { WslDistribution, WslReadinessIssue } from '@porcelain/contracts'

type CommandResult = Buffer | string
export type WslRunner = (args: readonly string[]) => Promise<CommandResult>

const PROBE_SCRIPT = `
node_path="$(command -v node 2>/dev/null || true)"
git_path="$(command -v git 2>/dev/null || true)"
npx_path="$(command -v npx 2>/dev/null || true)"
case "$node_path" in /mnt/*) node_version=;; *) node_version="$(node --version 2>/dev/null || true)";; esac
case "$git_path" in /mnt/*) git_version=;; *) git_version="$(git --version 2>/dev/null || true)";; esac
case "$npx_path" in ''|/mnt/*) npx_ready=no;; *) npx_ready=yes;; esac
printf 'node=%s\\ngit=%s\\nnpx=%s\\n' "$node_version" "$git_version" "$npx_ready"
`.trim()

function defaultRunner(args: readonly string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(
      'wsl.exe',
      [...args],
      { encoding: 'buffer', maxBuffer: 1024 * 1024, timeout: 15_000, windowsHide: true },
      (error, stdout) => {
        if (error !== null) reject(error)
        else resolve(stdout)
      },
    )
  })
}

/** wsl.exe writes UTF-16LE on some Windows builds and UTF-8 on others. */
export function decodeWslOutput(output: CommandResult): string {
  if (typeof output === 'string') return output.replaceAll('\0', '').replace(/^\uFEFF/, '')
  const sample = output.subarray(0, Math.min(output.length, 200))
  const zeroes = sample.reduce((count, byte) => count + (byte === 0 ? 1 : 0), 0)
  return output.toString(zeroes > sample.length / 5 ? 'utf16le' : 'utf8').replace(/^\uFEFF/, '')
}

export type ListedWslDistribution = Pick<WslDistribution, 'name' | 'version' | 'isDefault'>

/** Parse the column-aligned `wsl.exe --list --verbose` output without depending on its locale. */
export function parseWslDistributionList(output: CommandResult): ListedWslDistribution[] {
  const distributions: ListedWslDistribution[] = []
  for (const line of decodeWslOutput(output).split(/\r?\n/)) {
    const match = /^\s*(\*)?\s*(.+?)\s{2,}.+?\s{2,}([12])\s*$/.exec(line)
    if (match === null) continue
    const name = match[2]?.trim() ?? ''
    if (name === '' || /^docker-desktop(?:-data)?$/i.test(name)) continue
    distributions.push({ name, version: Number(match[3]) as 1 | 2, isDefault: match[1] === '*' })
  }
  return distributions
}

function probeFields(output: CommandResult): Map<string, string> {
  return new Map(
    decodeWslOutput(output)
      .split(/\r?\n/)
      .map((line) => line.split('=', 2) as [string, string])
      .filter(([key]) => key !== ''),
  )
}

function nodeMajor(version: string | null): number | null {
  const match = /^v?(\d+)/.exec(version ?? '')
  return match === null ? null : Number(match[1])
}

async function probeDistribution(
  listed: ListedWslDistribution,
  run: WslRunner,
): Promise<WslDistribution> {
  const issues: WslReadinessIssue[] = []
  if (listed.version !== 2) issues.push('unsupported-version')

  let fields: Map<string, string>
  try {
    fields = probeFields(
      await run(['--distribution', listed.name, '--exec', 'sh', '-lc', PROBE_SCRIPT]),
    )
  } catch {
    return {
      ...listed,
      nodeVersion: null,
      gitVersion: null,
      ready: false,
      issues: [...issues, 'probe-failed'],
      managedState: 'available',
      environmentId: null,
      managementError: null,
    }
  }

  const nodeVersion = fields.get('node') || null
  const gitVersion = fields.get('git') || null
  const major = nodeMajor(nodeVersion)
  if (major === null) issues.push('node-missing')
  else if (major < 22) issues.push('node-too-old')
  if (fields.get('npx') !== 'yes') issues.push('npx-missing')
  if (gitVersion === null) issues.push('git-missing')

  return {
    ...listed,
    nodeVersion,
    gitVersion,
    ready: issues.length === 0,
    issues,
    managedState: 'available',
    environmentId: null,
    managementError: null,
  }
}

/** Discover user WSL distributions. Discovery never registers a UNC path with the local daemon. */
export async function discoverWslDistributions(
  options: { platform?: NodeJS.Platform; run?: WslRunner } = {},
): Promise<WslDistribution[]> {
  if ((options.platform ?? process.platform) !== 'win32') return []
  const run = options.run ?? defaultRunner
  let listed: ListedWslDistribution[]
  try {
    listed = parseWslDistributionList(await run(['--list', '--verbose']))
  } catch {
    return []
  }
  return Promise.all(listed.map((distribution) => probeDistribution(distribution, run)))
}
