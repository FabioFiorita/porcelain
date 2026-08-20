import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import { projectActionsPath } from '@shared/project-store'
import { expect, expectTerminalText, loc, test, waitForShell } from './helpers/app'

const COMMAND = 'echo porcelain-e2e-actions'

/**
 * Actions are Project-scoped (ADR 0002) and the daemon only mints a Project id once a
 * repo is opened — poll the same hub-inventory.json the daemon writes rather than
 * guessing an id ahead of the boot that creates it.
 */
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

/** Exactly what `porcelain actions create` writes: the Project store, never the checkout. */
async function seedAction(homeDir: string, projectId: string): Promise<void> {
  const path = projectActionsPath(homeDir, projectId)
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(
    path,
    `${JSON.stringify(
      {
        version: 1,
        actions: [
          { id: 'e2e-echo', title: 'Echo hello', command: COMMAND, order: 1, createdAt: 1 },
        ],
      },
      null,
      2,
    )}\n`,
  )
}

/**
 * Ask this daemon to authorize a run directly, with the page's own session credential.
 * The menu can only offer targets the Hub knows, so a target from another checkout has
 * to be posted at the wire to prove the daemon — not the client — is what refuses it.
 */
async function authorizeRun(
  page: import('@playwright/test').Page,
  target: { environmentId: string; projectId: string; worktreeId: string; path: string },
): Promise<{ status: number; body: string }> {
  return page.evaluate(
    async ({ input, protocolHeader, protocolVersion }) => {
      const token = localStorage.getItem('porcelain-client-token') ?? ''
      const response = await fetch(`${location.origin}/trpc/prepareActionRun`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          [protocolHeader]: protocolVersion,
        },
        body: JSON.stringify({ actionId: 'e2e-echo', target: input }),
      })
      return { status: response.status, body: await response.text() }
    },
    {
      input: target,
      protocolHeader: PROTOCOL_VERSION_HEADER,
      protocolVersion: String(PROTOCOL_VERSION),
    },
  )
}

test('Actions: the Hub menu lists a Project roster, runs it in the selected Worktree, and refuses a foreign target', async ({
  page,
  seeded,
  repoDir,
}) => {
  await waitForShell(page)
  const { projectId, worktreeId } = await waitForProjectAndWorktree(seeded.udBase)
  await seedAction(seeded.udBase, projectId)

  // 1. Listing: the agent-curated roster shows up in the top-corner menu, unreviewed —
  //    an action written by an agent is not something this machine has agreed to run.
  await loc.actionsMenu(page).click()
  await expect(loc.actionRun(page, 'Echo hello')).toBeVisible()
  await expect(loc.actionRun(page, 'Echo hello')).toContainText(COMMAND)
  await expect(loc.actionUnreviewed(page, 'Echo hello')).toBeVisible()

  // 2. Trust boundary + execution: one click lands on the accept step, and accepting
  //    runs it in the Worktree the Hub has selected — on the Terminals surface, which the
  //    run opens, since that is the only place a shell is shown.
  await loc.actionRun(page, 'Echo hello').click()
  await expect(loc.actionTrustDialog(page)).toBeVisible()
  await loc.actionTrustConfirm(page).click()
  await expectTerminalText(page, 0, COMMAND)

  // The command lands in the target checkout, not in some other copy of the repo.
  await page.keyboard.type('pwd\n')
  await expectTerminalText(page, 0, repoDir)

  // 3. Ambiguity is refused at the daemon, not smoothed over: a well-formed request whose
  //    path is not one of this Project's checkouts comes back as actions.target-invalid.
  const foreign = await authorizeRun(page, {
    environmentId: 'env-e2e',
    projectId,
    worktreeId,
    path: `${repoDir}-somewhere-else`,
  })
  expect(foreign.status).toBeGreaterThanOrEqual(400)
  expect(foreign.body).toContain('actions.target-invalid')

  // The same request against a real Worktree of that Project is authorized.
  const allowed = await authorizeRun(page, {
    environmentId: 'env-e2e',
    projectId,
    worktreeId,
    path: repoDir,
  })
  expect(allowed.status).toBe(200)
  expect(allowed.body).toContain(COMMAND)
})
