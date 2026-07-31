import { spawnSync } from 'node:child_process'
import { lstatSync, readFileSync, readlinkSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
let failures = 0

function report(status, label, detail) {
  console.log(`${status.padEnd(4)} ${label.padEnd(22)} ${detail}`)
  if (status === 'FAIL') failures++
}

function command(name, args = []) {
  return spawnSync(name, args, { cwd: root, encoding: 'utf8' })
}

function symlinkDetail(path, target) {
  try {
    const stat = lstatSync(join(root, path))
    if (!stat.isSymbolicLink()) return { ok: false, detail: 'not a symlink' }
    const actual = readlinkSync(join(root, path))
    return { ok: actual === target, detail: actual }
  } catch {
    return { ok: false, detail: 'missing' }
  }
}

function checkSymlink(path, target) {
  const result = symlinkDetail(path, target)
  report(result.ok ? 'PASS' : 'FAIL', path, result.detail)
}

console.log('Porcelain agent foundation doctor\n')

const sync = command(process.execPath, ['scripts/sync-agent-foundations.mjs'])
report(sync.status === 0 ? 'PASS' : 'FAIL', 'shared adapters', (sync.stdout || sync.stderr).trim())

checkSymlink('CLAUDE.md', 'AGENTS.md')
checkSymlink('.claude/agents/invariant-reviewer.md', '../../.agents/agents/invariant-reviewer.md')
checkSymlink('.claude/hooks/git-guard.sh', '../../.agents/hooks/git-guard.sh')

const hooksPath = command('git', ['config', '--get', 'core.hooksPath'])
report(
  hooksPath.status === 0 && hooksPath.stdout.trim() === 'githooks' ? 'PASS' : 'FAIL',
  'tracked commit hook',
  hooksPath.stdout.trim() || 'core.hooksPath is unset',
)

const branch = command('git', ['branch', '--show-current']).stdout.trim()
if (branch === 'main') {
  report('PASS', 'worktree policy', 'primary main checkout (commits allowed)')
} else if (branch.startsWith('work/')) {
  const configPath = join(root, '.porcelain-worktree.json')
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    const valid =
      config.version === 1 &&
      branch === config.branch &&
      branch === `work/${config.slug}` &&
      Number.isInteger(config.port) &&
      config.port >= 43200 &&
      config.port <= 43999
    report(
      valid ? 'PASS' : 'FAIL',
      'worktree policy',
      valid ? `${branch} · port ${config.port}` : `${configPath} does not match ${branch}`,
    )
  } catch {
    report('FAIL', 'worktree policy', `${branch} has no readable managed profile`)
  }
} else {
  report('FAIL', 'worktree policy', `unmanaged branch ${branch || '(detached)'}`)
}

const claude = command('sh', ['-c', 'command -v claude'])
report(
  claude.status === 0 ? 'PASS' : 'WARN',
  'Claude Code',
  claude.stdout.trim() || 'not installed',
)

const codex = command('sh', ['-c', 'command -v codex'])
report(
  codex.status === 0 ? 'PASS' : 'WARN',
  'Codex',
  codex.stdout.trim() || 'not installed; adapter remains checked',
)

const grok = command('sh', ['-c', 'command -v grok'])
if (grok.status !== 0) {
  report('WARN', 'Grok Build', 'not installed; Claude-compatible adapter remains checked')
} else {
  const inspect = command('grok', ['inspect', '--json'])
  if (inspect.status !== 0) {
    report('FAIL', 'Grok Build', inspect.stderr.trim() || 'grok inspect failed')
  } else {
    const discovery = JSON.parse(inspect.stdout)
    const trusted = discovery.projectTrusted === true
    const hasGuard = discovery.hooks?.some(
      (hook) =>
        hook.event === 'pre_tool_use' && hook.target?.includes('.claude/hooks/git-guard.sh'),
    )
    const hasReviewer = discovery.agents?.some((agent) => agent.name === 'invariant-reviewer')
    const projectInstruction = discovery.projectInstructions?.find(
      (entry) =>
        entry.scope === 'project' &&
        (entry.path?.endsWith('/AGENTS.md') || entry.path?.endsWith('/CLAUDE.md')),
    )
    report(
      trusted ? 'PASS' : 'FAIL',
      'Grok project trust',
      trusted ? 'trusted' : 'run /hooks-trust',
    )
    report(hasGuard ? 'PASS' : 'FAIL', 'Grok Git guard', hasGuard ? 'discovered' : 'not discovered')
    report(
      hasReviewer ? 'PASS' : 'FAIL',
      'Grok reviewer',
      hasReviewer ? 'discovered' : 'not discovered',
    )
    report(
      projectInstruction ? 'PASS' : 'FAIL',
      'Grok instructions',
      projectInstruction?.path ?? 'project instructions not discovered',
    )
  }
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
report(
  packageJson.scripts?.verify?.includes('lint') ? 'PASS' : 'FAIL',
  'verification gate',
  packageJson.scripts?.verify ?? 'missing',
)

console.log('')
if (failures > 0) {
  console.error(`agents:doctor · ${failures} required check(s) failed`)
  process.exitCode = 1
} else {
  console.log('agents:doctor · ready')
}
