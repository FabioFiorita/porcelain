import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { tasksIndexPath } from '@shared/tasks-porcelain'
import { expect, loc, test, waitForShell } from './helpers/app'

/**
 * Daemon-backed proof for the Tasks table.
 *
 * Writes go to this daemon's `$PORCELAIN_HOME/tasks/tasks.json`. The assertions read that
 * file rather than trusting the UI's own optimism.
 */

interface StoredTask {
  id: string
  shortId: string
  title: string
  status: string
  tags: string[]
  references: { projectId?: string; worktreeId?: string }
  pathRefs: { path: string; kind: string }[]
  attachments: { id: string; name: string; storedPath: string; byteSize: number; mime: string }[]
  links: { url: string; label: string }[]
  createdAt: string
  updatedAt: string
}

async function readStoredTasks(homeDir: string): Promise<StoredTask[]> {
  const raw = await readFile(tasksIndexPath(homeDir), 'utf8')
  return (JSON.parse(raw) as { value: { tasks: StoredTask[] } }).value.tasks
}

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

async function createFromComposer(
  page: Parameters<typeof loc.tasksNew>[0],
  title: string,
  attachmentPath?: string,
): Promise<void> {
  await loc.tasksOpen(page).click()
  await loc.tasksNew(page).click()
  await expect(loc.tasksDialog(page)).toBeVisible()
  await loc.tasksComposerTitle(page).fill(title)
  if (attachmentPath !== undefined) {
    await loc.tasksComposerAttach(page).setInputFiles(attachmentPath)
  }
  await loc.tasksComposerSubmit(page).click()
}

test('the composer creates a Task with a copied picture', async ({ page, seeded }) => {
  await waitForShell(page)

  const attachmentDir = await mkdtemp(join(tmpdir(), 'porcelain-e2e-attach-'))
  const attachmentPath = join(attachmentDir, 'shot.png')
  await writeFile(attachmentPath, 'the screenshot\n')

  await createFromComposer(page, 'Chase the flaky worktree probe', attachmentPath)

  const stored = await waitForStoredTasks(seeded.udBase, (tasks) => tasks.length === 1)
  const task = stored[0]
  if (task === undefined) throw new Error('expected exactly one stored Task')

  expect(task.title).toBe('Chase the flaky worktree probe')
  expect(task.shortId).toBe('T-1')
  expect(task.status).toBe('todo')
  expect(task.attachments).toHaveLength(1)
  const attachment = task.attachments[0]
  if (attachment === undefined) throw new Error('expected one copied attachment')
  expect(attachment.name).toBe('shot.png')
  expect(attachment.storedPath.startsWith('/')).toBe(false)
  expect(attachment.storedPath).toContain(task.id)
  const copied = await readFile(
    join(seeded.udBase, 'tasks', 'attachments', attachment.storedPath),
    'utf8',
  )
  expect(copied).toBe('the screenshot\n')

  await expect(loc.tasksRow(page, task.id)).toBeVisible()
  await expect(loc.tasksRow(page, task.id)).toContainText('Chase the flaky worktree probe')
  await expect(loc.tasksRow(page, task.id)).toContainText('T-1')
})

test('a row edit and a delete route to the Environment daemon that owns the row', async ({
  page,
  seeded,
}) => {
  await waitForShell(page)
  await createFromComposer(page, 'Rehearse the release')
  const created = await waitForStoredTasks(seeded.udBase, (tasks) => tasks.length === 1)
  const taskId = created[0]?.id
  if (taskId === undefined) throw new Error('expected a created Task')
  expect(created[0]?.status).toBe('todo')

  await loc.tasksRowStatus(page, taskId).click()
  await page.getByRole('option', { name: 'Done' }).click()
  const updated = await waitForStoredTasks(seeded.udBase, (tasks) => tasks[0]?.status === 'done')
  expect(updated[0]?.id).toBe(taskId)

  await loc.tasksRowDelete(page, taskId).click()
  await page.getByTestId('tasks-delete-confirm').click()
  await waitForStoredTasks(seeded.udBase, (tasks) => tasks.length === 0)
  await expect(loc.tasksRow(page, taskId)).toHaveCount(0)
  await expect(loc.tasksEmpty(page)).toBeVisible()
})

test('columns are configurable and Title cannot be hidden', async ({ page, seeded }) => {
  await waitForShell(page)
  await createFromComposer(page, 'Keep the columns honest')
  await waitForStoredTasks(seeded.udBase, (tasks) => tasks.length === 1)

  const table = loc.tasksTable(page)
  await expect(table).toBeVisible()
  await expect(table).toContainText('ID')
  await expect(table).toContainText('Keep the columns honest')

  await loc.tasksColumnsMenu(page).click()
  await expect(loc.tasksColumnToggle(page, 'title')).toBeDisabled()
  await loc.tasksColumnToggle(page, 'project').click()
  await page.keyboard.press('Escape')

  await expect(table).not.toContainText('Project')
  await expect(table).toContainText('Keep the columns honest')
})
