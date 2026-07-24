import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, loc, REPO_DIR, selectTab, test, waitForShell } from './helpers/app'

// These exercise the Agent tab against the scripted in-process FAKE driver
// (PORCELAIN_AGENT_FAKE=1). Locators are data-testid-only — no getByText for
// chrome that also appears in the tab bar / session companion.

/** Start a fresh thread from the Agent list's "+" and wait for its composer. */
async function newThread(page: Page): Promise<void> {
  await selectTab(page, 'Agent')
  await loc.agentNewThread(page).click()
  await loc.agentComposer(page).waitFor()
}

test('streams a turn into the timeline + Quick Access, and persists across reload', async ({
  page,
}) => {
  await waitForShell(page)
  await newThread(page)

  const composer = loc.agentComposer(page)
  await composer.fill('Ship the feature')
  await composer.press('Enter')

  // Wait for auto-title + stream to finish via stable seams.
  await expect(loc.agentPlan(page)).toBeVisible()
  await expect(loc.agentPlanProgress(page)).toHaveAttribute('data-done', '1')
  await expect(loc.agentPlanProgress(page)).toHaveAttribute('data-total', '3')
  await expect(loc.agentTool(page, 'Run tests')).toBeVisible()
  await expect(loc.agentAssistantMessage(page)).toContainText('Hello from the fake agent')
  await expect(loc.agentUserBubble(page)).toContainText('Ship the feature')

  await expect(loc.agentUsageLastTurn(page)).toBeVisible()
  await expect(loc.agentSessionStatus(page)).toHaveAttribute('data-status', 'idle')
  await expect(loc.agentSend(page)).toBeVisible()

  // Idle threads stay under Active (no Recent segment; idle status is Session companion).
  await expect(loc.agentThreadByTitle(page, 'Fake thread title')).toBeVisible()

  // Reload the renderer only — the daemon keeps the thread.
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await waitForShell(page)
  await selectTab(page, 'Agent')

  const row = loc.agentThreadByTitle(page, 'Fake thread title')
  await expect(row).toBeVisible()
  await row.click()

  await expect(loc.agentAssistantMessage(page)).toContainText('Hello from the fake agent')
  await expect(loc.agentUserBubble(page)).toContainText('Ship the feature')
})

test('starts a thread in a fresh worktree and switches to it', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Agent')

  await loc.agentProviderMenu(page).click()
  await loc.agentWorktreeMenuItem(page).click()
  await loc.agentWorktreeBranch(page).fill('e2e-wt')
  await loc.agentWorktreeCreate(page).click()

  // Footer worktree chip lands on the new branch.
  await expect(loc.worktreeSwitcher(page)).toHaveAttribute('data-branch', 'e2e-wt', {
    timeout: 30_000,
  })
  await expect(loc.branchSwitcher(page)).toHaveAttribute('data-branch', 'e2e-wt')
})

test('surfaces a sibling worktree in the Review inbox and switches to it on click', async ({
  page,
}) => {
  await waitForShell(page)
  await selectTab(page, 'Agent')
  await loc.agentProviderMenu(page).click()
  await loc.agentWorktreeMenuItem(page).click()
  await loc.agentWorktreeBranch(page).fill('e2e-inbox')
  await loc.agentWorktreeCreate(page).click()
  await expect(loc.worktreeSwitcher(page)).toHaveAttribute('data-branch', 'e2e-inbox', {
    timeout: 30_000,
  })

  // Dirty the worktree so the inbox has a changed-file signal.
  await writeFile(join(`${REPO_DIR}-worktrees`, 'e2e-inbox', 'inbox-change.txt'), 'edited\n')

  // Switch back to main via the worktree menu.
  await loc.worktreeSwitcher(page).click()
  await loc.worktreeMenuItem(page, 'main').click()
  await expect(loc.worktreeSwitcher(page)).toHaveAttribute('data-branch', 'main', {
    timeout: 30_000,
  })

  await selectTab(page, 'Review')
  await expect(loc.reviewInbox(page)).toBeVisible({ timeout: 30_000 })
  await loc.reviewInboxRow(page, 'e2e-inbox').click()
  await expect(loc.worktreeSwitcher(page)).toHaveAttribute('data-branch', 'e2e-inbox', {
    timeout: 30_000,
  })
})

test('gates a turn on an approval and completes on Accept', async ({ page }) => {
  await waitForShell(page)
  await newThread(page)

  // Flip permission posture via the mode chip (default full → approve).
  await loc.agentModeChip(page).click()
  await loc.agentModeOption(page, 'approve').click()
  await page.keyboard.press('Escape')
  await expect(loc.agentModeOption(page, 'approve')).toBeHidden()
  await expect(loc.agentModeChip(page)).toHaveAttribute('data-mode', 'approve')

  const composer = loc.agentComposer(page)
  await composer.fill('Delete the build dir')
  await composer.press('Enter')

  const accept = loc.agentApprovalAccept(page)
  await expect(accept).toBeVisible()
  await accept.click()

  await expect(loc.agentApprovalStatus(page)).toHaveAttribute('data-status', 'accepted')
  await expect(loc.agentSend(page)).toBeVisible()
})
