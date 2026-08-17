import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { tasksIndexPath } from '@shared/tasks-porcelain'
import { expect, loc, selectTab, test, waitForShell } from './helpers/app'

/**
 * Daemon-backed proof for the Tasks table (issue #23).
 *
 * The browser lane serves exactly one Environment — the daemon this page came from — which is
 * the whole point of proving mutation ROUTING here: every write in this spec has to reach that
 * daemon's own `$PORCELAIN_HOME/tasks/tasks.json`, and the assertions read that file rather
 * than trusting the UI's own optimism.
 *
 * Cross-Environment AGGREGATION and offline omission are deliberately NOT proven here: they
 * live in the Electron shell's `environmentTasks` fan-out, which the browser harness has no
 * shell router for. Those are covered at their owning boundary by
 * `apps/desktop/src/main/shell-tasks.test.ts`.
 */

interface StoredTask {
  id: string
  title: string
  status: string
  tags: string[]
  references: { projectId?: string; worktreeId?: string }
  attachments: { id: string; name: string; storedPath: string; byteSize: number; mime: string }[]
  links: { url: string; label: string }[]
  createdAt: string
  updatedAt: string
}

/** Read the daemon's own Tasks document — the authority the UI is claiming to have written. */
async function readStoredTasks(homeDir: string): Promise<StoredTask[]> {
  const raw = await readFile(tasksIndexPath(homeDir), 'utf8')
  return (JSON.parse(raw) as { value: { tasks: StoredTask[] } }).value.tasks
}

/** Poll until the daemon's document satisfies `predicate`, then return it. */
async function waitForStoredTasks(
  homeDir: string,
  predicate: (tasks: StoredTask[]) => boolean,
): Promise<StoredTask[]> {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const tasks = await readStoredTasks(homeDir)
      if (predicate(tasks)) return tasks
    } catch {
      // tasks.json is not written until the first create — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('the daemon Tasks document never reached the expected state')
}

test('Quick Add creates a Task with references, a link, and a copied attachment', async ({
  page,
  seeded,
}) => {
  await waitForShell(page)
  // A Worktree is selected on boot, so Quick Add's references default from the Hub selection —
  // which is what makes the Project/Worktree columns meaningful without a second control.
  await expect(loc.viewerEmpty(page)).toBeVisible()

  const attachmentDir = await mkdtemp(join(tmpdir(), 'porcelain-e2e-attach-'))
  const attachmentPath = join(attachmentDir, 'trace.log')
  await writeFile(attachmentPath, 'the failing run\n')

  await selectTab(page, 'Tasks')
  await expect(loc.tasksView(page)).toBeVisible()
  await expect(loc.tasksQuickAdd(page)).toBeVisible()

  await loc.tasksQuickAddTitle(page).fill('Chase the flaky worktree probe')
  await loc.tasksQuickAddStatus(page).selectOption('doing')
  await loc.tasksQuickAddTags(page).fill('git, flaky')
  await loc.tasksQuickAddLinkUrl(page).fill('https://example.invalid/run/1')
  await loc.tasksQuickAddLinkLabel(page).fill('Failing run')
  await loc.tasksQuickAddAttachment(page).fill(attachmentPath)
  await loc.tasksQuickAddSubmit(page).click()

  const stored = await waitForStoredTasks(seeded.udBase, (tasks) => tasks.length === 1)
  const task = stored[0]
  if (task === undefined) throw new Error('expected exactly one stored Task')

  expect(task.title).toBe('Chase the flaky worktree probe')
  expect(task.status).toBe('doing')
  expect(task.tags).toEqual(['git', 'flaky'])
  expect(task.links).toEqual([{ url: 'https://example.invalid/run/1', label: 'Failing run' }])
  // References came from the Hub selection, not from anything the person typed.
  expect(task.references.projectId).toBeTruthy()
  expect(task.references.worktreeId).toBeTruthy()
  // The daemon COPIED the file: a stored path relative to its own attachment root, and the
  // real bytes under it — not a pointer back at the caller's temp directory.
  expect(task.attachments).toHaveLength(1)
  const attachment = task.attachments[0]
  if (attachment === undefined) throw new Error('expected one copied attachment')
  expect(attachment.name).toBe('trace.log')
  expect(attachment.storedPath.startsWith('/')).toBe(false)
  expect(attachment.storedPath).toContain(task.id)
  const copied = await readFile(
    join(seeded.udBase, 'tasks', 'attachments', attachment.storedPath),
    'utf8',
  )
  expect(copied).toBe('the failing run\n')

  // And the table shows it without opening any per-repository Board.
  await expect(loc.tasksRow(page, task.id)).toBeVisible()
  await expect(loc.tasksRow(page, task.id)).toContainText('Chase the flaky worktree probe')
  await expect(loc.tasksRow(page, task.id)).toContainText('trace.log')
  await expect(loc.tasksRow(page, task.id)).toContainText('Failing run')
  await expect(loc.tasksRow(page, task.id)).toContainText('flaky')
})

test('a row edit and a delete route to the Environment daemon that owns the row', async ({
  page,
  seeded,
}) => {
  await waitForShell(page)
  await selectTab(page, 'Tasks')
  await loc.tasksOpen(page).click()
  await expect(loc.tasksQuickAdd(page)).toBeVisible()
  await expect(loc.tasksEmpty(page)).toBeVisible()

  await loc.tasksQuickAddTitle(page).fill('Rehearse the release')
  await loc.tasksQuickAddSubmit(page).click()
  const created = await waitForStoredTasks(seeded.udBase, (tasks) => tasks.length === 1)
  const taskId = created[0]?.id
  if (taskId === undefined) throw new Error('expected a created Task')
  expect(created[0]?.status).toBe('todo')

  await loc.tasksRowStatus(page, taskId).selectOption('done')
  const updated = await waitForStoredTasks(seeded.udBase, (tasks) => tasks[0]?.status === 'done')
  expect(updated[0]?.id).toBe(taskId)

  await loc.tasksRowDelete(page, taskId).click()
  await waitForStoredTasks(seeded.udBase, (tasks) => tasks.length === 0)
  await expect(loc.tasksRow(page, taskId)).toHaveCount(0)
  await expect(loc.tasksEmpty(page)).toBeVisible()
})

test('columns are configurable and Title cannot be hidden', async ({ page, seeded }) => {
  await waitForShell(page)
  await selectTab(page, 'Tasks')
  await loc.tasksOpen(page).click()
  await loc.tasksQuickAddTitle(page).fill('Keep the columns honest')
  await loc.tasksQuickAddTags(page).fill('ratchet')
  await loc.tasksQuickAddSubmit(page).click()
  await waitForStoredTasks(seeded.udBase, (tasks) => tasks.length === 1)

  const table = loc.tasksTable(page)
  await expect(table).toBeVisible()
  await expect(table).toContainText('Tags')
  await expect(table).toContainText('ratchet')

  await loc.tasksColumnsMenu(page).click()
  // Title is the one column the table cannot lose — a row without it is a puzzle.
  await expect(loc.tasksColumnToggle(page, 'title')).toBeDisabled()
  await loc.tasksColumnToggle(page, 'tags').click()
  await page.keyboard.press('Escape')

  await expect(table).not.toContainText('Tags')
  await expect(table).not.toContainText('ratchet')
  // The Task itself is untouched: this is presentation, not data.
  await expect(table).toContainText('Keep the columns honest')
  const stored = await readStoredTasks(seeded.udBase)
  expect(stored[0]?.tags).toEqual(['ratchet'])
})
