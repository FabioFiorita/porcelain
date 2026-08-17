import { expect, loc, test, waitForShell } from './helpers/app'

/**
 * The whole promise of a daemon-owned development server, proved against a real daemon: it
 * keeps running while the client goes away. A reload throws the entire renderer — every store,
 * every socket, every attached stream — and the server has to still be there afterwards,
 * because the record that owns it never lived in the browser.
 */

// Prints its own URL and then stays up. Single-quoted so nothing inside needs shell escaping.
const SERVER_COMMAND =
  'node -e \'require("http").createServer(function(q,s){s.end("ok")}).listen(0,"127.0.0.1",function(){console.log("http://127.0.0.1:"+this.address().port+"/")})\''

async function startServer(page: Parameters<typeof waitForShell>[0], label: string) {
  await loc.devServerLabelInput(page).fill(label)
  await loc.devServerCommandInput(page).fill(SERVER_COMMAND)
  await loc.devServerSubmit(page).click()
  const row = loc.devServerRows(page).first()
  await expect(row).toBeVisible({ timeout: 30_000 })
  const testId = await row.getAttribute('data-testid')
  if (testId === null) throw new Error('expected the started server row to carry its test id')
  return testId.replace('dev-server-', '')
}

// Servers chrome left the Glance and then the terminal strip — start/stop is Actions now.
test.skip('a development server outlives a reload and only an explicit Stop ends it', async ({
  page,
}) => {
  await waitForShell(page)
  await expect(loc.viewerEmpty(page)).toBeVisible()
  await loc.toggleTerminalPanel(page).click()
  await expect(loc.devServers(page)).toBeVisible()

  const id = await startServer(page, 'probe')

  // It reports the URL it printed, so the human can open it without reading the terminal.
  await expect(loc.devServerUrl(page, id)).toContainText('http://127.0.0.1:', { timeout: 30_000 })
  const url = await loc.devServerUrl(page, id).textContent()
  await expect(loc.devServerRow(page, id)).toHaveAttribute('data-status', 'running')

  // Throw the client away entirely. The daemon kept the process and the record.
  await page.reload()
  await waitForShell(page)
  await expect(loc.devServerRow(page, id)).toHaveAttribute('data-status', 'running', {
    timeout: 30_000,
  })
  await expect(loc.devServerUrl(page, id)).toHaveText(url ?? '')

  // Switch to another Worktree of the same Project and back. The other Worktree shows an
  // empty Servers list — a record belongs to one checkout, never to "the current repo".
  const originalTestId = await loc.hubWorktrees(page).first().getAttribute('data-testid')
  const projectId = (await loc.hubProjects(page).first().getAttribute('data-testid'))?.replace(
    'hub-project-',
    '',
  )
  expect(projectId).toBeTruthy()
  expect(originalTestId).toBeTruthy()
  if (projectId === undefined || projectId === '' || originalTestId === null) return

  await loc.hubCreateWorktree(page, projectId).click()
  await loc.hubCreateWorktreeBranch(page).fill('dev-servers-probe')
  await loc.hubCreateWorktreeSubmit(page).click()
  await expect(loc.hubWorktrees(page)).toHaveCount(2)

  const testIds = await loc
    .hubWorktrees(page)
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute('data-testid'))
        .filter((id): id is string => id !== null),
    )
  const otherTestId = testIds.find((candidate) => candidate !== originalTestId)
  expect(otherTestId).toBeTruthy()
  if (otherTestId === undefined) return

  await page.getByTestId(otherTestId).click()
  // A positive marker, not an absence: an empty list assertion would pass while the roster
  // was merely still loading, and this is the assertion that proves per-Worktree ownership.
  await expect(loc.devServersEmpty(page)).toBeVisible({ timeout: 30_000 })
  await expect(loc.devServerRow(page, id)).toBeHidden()

  await page.getByTestId(originalTestId).click()
  await expect(loc.devServerRow(page, id)).toHaveAttribute('data-status', 'running', {
    timeout: 30_000,
  })
  await expect(loc.devServerRows(page)).toHaveCount(1)

  // Only an explicit press ends it — and then the finished record is still readable.
  await loc.devServerStop(page, id).click()
  await expect(loc.devServerRow(page, id)).toHaveAttribute('data-status', 'stopped', {
    timeout: 30_000,
  })

  await loc.devServerDismiss(page, id).click()
  await expect(loc.devServerRows(page)).toHaveCount(0)
})
