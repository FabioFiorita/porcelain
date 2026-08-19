import { readFile } from 'node:fs/promises'
import { tasksIndexPath } from '@shared/tasks-porcelain'
import { expect, test, waitForShell } from './helpers/app'
import { TestIds } from './helpers/test-ids'

/**
 * Menu-bar quick add, end to end in the real shell: the app-menu twin of the tray click
 * opens the popover window, the popover creates the Task through the daemon, and the
 * daemon's own `tasks.json` is what proves it landed.
 *
 * Electron-only. The tray, the popover window, and the `closeQuickAdd` shell procedure
 * all live in the main process, which the browser project does not run at all. The MENU
 * item (not `tray.on('click')`) is the trigger here because a Tray is not reachable from
 * Playwright's main-process evaluate — and on Linux the tray has no click event to fire.
 */

interface StoredTask {
  title: string
  notes?: string
  references: { projectId?: string }
}

async function waitForStoredTask(homeDir: string, title: string): Promise<StoredTask> {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const raw = await readFile(tasksIndexPath(homeDir), 'utf8')
      const tasks = (JSON.parse(raw) as { value: { tasks: StoredTask[] } }).value.tasks
      const match = tasks.find((task) => task.title === title)
      if (match !== undefined) return match
    } catch {
      // The index does not exist until the first Task is written.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`daemon never stored a Task titled ${title}`)
}

test('the quick-add popover files a Task on this device and dismisses itself', async ({
  app,
  page,
  seeded,
}) => {
  test.skip(app === null, 'the tray popover is a main-process surface (electron project only)')
  if (app === null) return
  await waitForShell(page)

  // Subscribe BEFORE the trigger: the popover window can open before `waitForEvent`
  // would have attached.
  const opened = app.waitForEvent('window')
  await app.evaluate(({ Menu }) => {
    Menu.getApplicationMenu()?.getMenuItemById('quick-add-task')?.click()
  })
  const popover = await opened
  await popover.waitForLoadState('domcontentloaded')
  await popover.getByTestId(TestIds.quickAdd).waitFor()

  await popover.getByTestId(TestIds.quickAddTitle).fill('Quick add from the menu bar')
  await popover.getByTestId(TestIds.quickAddNotes).fill('Filed without opening the app')
  await popover.getByTestId(TestIds.quickAddSubmit).click()
  await expect(popover.getByTestId(TestIds.quickAddConfirmation)).toBeVisible()

  const stored = await waitForStoredTask(seeded.udBase, 'Quick add from the menu bar')
  expect(stored.notes).toBe('Filed without opening the app')
  // Unreferenced: the popover never guesses a project it cannot show.
  expect(stored.references).toEqual({})

  // The confirmation is followed by self-dismissal — the window is destroyed, not hidden.
  await expect.poll(() => app.windows().length, { timeout: 10_000 }).toBe(1)
})
