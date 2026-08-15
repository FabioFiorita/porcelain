import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { canvasIndexPath } from '@shared/canvas-porcelain'
import { expect, loc, openSurface, TestIds, test, waitForShell } from './helpers/app'
import { PNG_1PX, runFixtureCli } from './helpers/review-fixture'

/**
 * #27's last acceptance criterion: a disposable fixture proves that data migrated out of a
 * legacy repo-local `.porcelain/` is VISIBLE through the new Canvas, Tasks, and Actions
 * surfaces — not merely present in a file the unit tests read back.
 *
 * The migration runs through the built CLI against this test's isolated `$PORCELAIN_HOME`,
 * so what the browser then renders came out of the same command a human would type.
 */

const CARD_ID = '11111111-1111-4111-8111-111111111111'
const ACTION_TITLE = 'Echo migrated'

async function waitForProjectAndWorktree(
  homeDir: string,
): Promise<{ projectId: string; worktreeId: string }> {
  const inventoryPath = join(homeDir, 'hub-inventory.json')
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const parsed = JSON.parse(await readFile(inventoryPath, 'utf8')) as {
        value: { projects: { id: string; worktrees: { id: string }[] }[] }
      }
      const project = parsed.value.projects[0]
      const worktree = project?.worktrees[0]
      if (project !== undefined && worktree !== undefined) {
        return { projectId: project.id, worktreeId: worktree.id }
      }
    } catch {
      // hub-inventory.json not written yet — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('hub-inventory.json never gained a Project + Worktree')
}

/** The repo-local companion exactly as the retiring model wrote it. */
async function seedLegacyCompanion(repoDir: string): Promise<void> {
  const companion = join(repoDir, '.porcelain')
  const review = join(companion, 'active-review')
  await mkdir(join(review, 'evidence', 'assets'), { recursive: true })
  await mkdir(join(review, 'evidence', 'results'), { recursive: true })
  await mkdir(join(review, 'intent'), { recursive: true })

  await writeFile(
    join(review, 'review.json'),
    JSON.stringify({
      name: 'Legacy review',
      thesis: 'The old companion carried this story.',
      files: [{ path: 'src/pages/Home.tsx', source: 'changed', note: 'the entry point' }],
      sections: [
        {
          title: 'How it was built',
          prose: 'One store, two readers.',
          html: '<html><body><p id="legacy-html">legacy walkthrough</p></body></html>',
          anchors: [],
        },
      ],
    }),
  )
  await writeFile(join(review, 'intent', 'why.md'), '# Why\n\nBecause the loop must close.\n')
  await writeFile(join(review, 'evidence', 'results', 'index.md'), '# Results\n\nAll green.\n')
  await writeFile(join(review, 'evidence', 'assets', 'shot.png'), PNG_1PX)
  await writeFile(
    join(review, 'evidence', 'meta.json'),
    JSON.stringify({
      title: 'Legacy evidence',
      repoPath: repoDir,
      updatedAt: '2026-08-15T00:00:00.000Z',
      checks: [{ label: 'legacy proof', status: 'pass' }],
    }),
  )

  await writeFile(
    join(companion, 'board.json'),
    JSON.stringify({
      version: 1,
      cards: [
        {
          id: CARD_ID,
          title: 'Migrated board card',
          status: 'doing',
          order: 0,
          createdAt: 1_700_000_000_000,
        },
      ],
    }),
  )
  await writeFile(
    join(companion, 'actions.json'),
    JSON.stringify({
      version: 1,
      actions: [
        {
          id: 'legacy-echo',
          title: ACTION_TITLE,
          command: 'echo porcelain-e2e-migration',
          order: 0,
          createdAt: 1,
        },
      ],
    }),
  )
}

test.setTimeout(120_000)

test('a migrated companion is visible as a Canvas, a Task, and an Action', async ({
  page,
  repoDir,
  seeded,
}) => {
  await waitForShell(page)
  const { projectId, worktreeId } = await waitForProjectAndWorktree(seeded.udBase)

  await seedLegacyCompanion(repoDir)
  await runFixtureCli(['migrate', 'apply', '--repo', repoDir], seeded.env, repoDir)

  // The Canvas id is minted by the migration, so read it back from the index the
  // daemon serves rather than guessing one the run did not choose.
  const index = JSON.parse(await readFile(canvasIndexPath(seeded.udBase, projectId), 'utf8')) as {
    value: { canvases: { id: string; title: string; kind: string; template?: string }[] }
  }
  const canvas = index.value.canvases[0]
  expect(canvas).toMatchObject({ title: 'Legacy review', kind: 'html', template: 'review' })

  // A fresh load: the surfaces below must read the migrated data through the
  // daemon, exactly as they would on a machine that migrated yesterday.
  await page.reload()
  await waitForShell(page)
  await loc.hubWorktree(page, worktreeId).click()

  // Canvas: the migrated Review, with its evidence image inlined into the sandbox.
  await openSurface(page, 'Canvas')
  await loc.canvasListItem(page, canvas?.id ?? '').click()
  const frame = page.frameLocator(`[data-testid="${TestIds.canvasIframe}"]`)
  await expect(frame.locator('#intent')).toContainText('The old companion carried this story.')
  await expect(frame.locator('#legacy-html')).toBeVisible()
  await expect(frame.locator('#evidence img')).toHaveAttribute('src', /^data:image\/png;base64,/)

  // Tasks: the Board card, keeping its id and its column.
  await openSurface(page, 'Tasks')
  await loc.tasksOpen(page).click()
  await expect(loc.tasksRow(page, CARD_ID)).toContainText('Migrated board card')
  await expect(loc.tasksRowStatus(page, CARD_ID)).toHaveValue('doing')

  // Actions: the repo-local action, now offered from the Project store.
  await loc.actionsMenu(page).click()
  await expect(loc.actionRun(page, ACTION_TITLE)).toBeVisible()
  // Migrated Actions arrive unreviewed: trust records are never carried over.
  await expect(loc.actionUnreviewed(page, ACTION_TITLE)).toBeVisible()
})
