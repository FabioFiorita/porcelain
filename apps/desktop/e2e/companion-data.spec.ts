import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { expect, loc, openSettings, REPO_DIR, TestIds, test, waitForShell } from './helpers/app'

const run = promisify(execFile)

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Porcelain E2E',
  GIT_AUTHOR_EMAIL: 'e2e@porcelain.test',
  GIT_COMMITTER_NAME: 'Porcelain E2E',
  GIT_COMMITTER_EMAIL: 'e2e@porcelain.test',
}

const ACTIONS = '.porcelain/actions.json'
const gitignorePath = join(REPO_DIR, '.porcelain', '.gitignore')

async function git(...args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd: REPO_DIR, env: { ...process.env, ...GIT_ENV } })
  return stdout
}

async function trackedActions(): Promise<string[]> {
  return (await git('ls-files', '--', ACTIONS)).split('\n').filter((line) => line !== '')
}

/**
 * Settings › Data — what git carries. Split out of Settings › Companion, which
 * had grown two jobs: this one (a property of the repo, so every client needs
 * it) and the agent-skill installer (this machine only, so it stays shell-only).
 *
 * These assert through to disk on purpose. The toggle's whole contract is that
 * it rewrites `.porcelain/.gitignore` AND untracks — a DOM-only test would pass
 * against a toggle that changed nothing, which is exactly the failure the daemon
 * comment warns about.
 */
test('Data flips a channel to Local, and git actually stops carrying it', async ({ page }) => {
  await waitForShell(page)

  // The fixture commits before any companion exists, so nothing under
  // `.porcelain/` is tracked yet. Write one channel and force-add it (the daemon
  // excludes the companion on first write) to reach the state the tracked-count
  // line describes.
  await mkdir(join(REPO_DIR, '.porcelain'), { recursive: true })
  await writeFile(
    join(REPO_DIR, ACTIONS),
    JSON.stringify([{ id: 'a1', title: 'Verify', command: 'pnpm verify', where: 'primary' }]),
  )
  await git('add', '-f', '--', ACTIONS)
  await git('commit', '-m', 'chore: share saved actions')
  expect(await trackedActions()).toEqual([ACTIONS])

  await openSettings(page)
  await loc.settingsDialog(page).getByRole('button', { name: 'Data', exact: true }).click()
  await expect(loc.settingsHeading(page)).toHaveText('Data')

  // The count is a consequence, not a label. `Local (1)` read as "1 local item";
  // it counts the opposite — files git tracks, which Local would untrack.
  const state = page.getByTestId(TestIds.companionDispositionState('actions'))
  await expect(state).toHaveText('In git · 1 file tracked — Local stages its removal.')
  await expect(page.getByTestId(TestIds.companionDisposition('actions', 'local'))).toHaveText(
    'Local',
  )

  await page.getByTestId(TestIds.companionDisposition('actions', 'local')).click()

  await expect(page.getByTestId(TestIds.companionUntracked)).toContainText('still on disk')
  await expect(state).toHaveText('Ignored — stays in this clone.')
  expect(await readFile(gitignorePath, 'utf8')).toContain('/actions.json')
  expect(await trackedActions()).toEqual([])
  // "Local" must never mean deleted — the file is what the app reads from.
  expect(await readFile(join(REPO_DIR, ACTIONS), 'utf8')).not.toBe('')

  // Back to Shared: the ignore line goes, but staging stays the human's act, so
  // the row must not claim teammates can see it yet.
  await page.getByTestId(TestIds.companionDisposition('actions', 'shared')).click()
  await expect(state).toHaveText('Shared — nothing committed yet; stage it to reach teammates.')
  expect(await readFile(gitignorePath, 'utf8')).not.toContain('/actions.json')
})

test('Companion is the skill alone, and hides in the browser client', async ({ page, appMode }) => {
  await waitForShell(page)
  await openSettings(page)
  const dialog = loc.settingsDialog(page)
  const companion = dialog.getByRole('button', { name: 'Companion', exact: true })

  if (appMode === 'browser') {
    // No shell router in the browser, so the skill installer has nothing to run.
    await expect(companion).toHaveCount(0)
    return
  }

  await companion.click()
  await expect(loc.settingsHeading(page)).toHaveText('Companion')
  // What git carries moved out; only the skill install commands remain.
  await expect(page.getByTestId(TestIds.companionDispositions)).toHaveCount(0)
  await expect(dialog.getByText('npx skills add', { exact: false })).toBeVisible()
})
