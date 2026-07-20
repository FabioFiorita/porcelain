import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, REPO_DIR, selectTab, test, waitForShell } from './helpers/app'

// These exercise the Agent tab against the scripted in-process FAKE driver (enabled by
// PORCELAIN_AGENT_FAKE=1 in the fixture), so a turn runs deterministically without a real
// CLI, auth, or network. The fake's script (src/backend/agents/drivers/fake.ts): a 3-step
// plan → assistant text streamed in two deltas ("Hello from the fake agent…") → a tool
// call running→ok → in `approve` mode a pending approval that gates completion → a final
// idle status carrying usage {100 in, 50 out}; generateTitle returns 'Fake thread title'.
// Threads persist to PORCELAIN_AGENT_THREADS (a temp dir), and the daemon that owns them
// is a separate process that survives a renderer reload — so a thread comes back after one.

/** Start a fresh thread from the Agent list's "+" and wait for its composer to mount. */
async function newThread(page: Page): Promise<void> {
  await selectTab(page, 'Agent')
  // The list is empty here, so "New thread" resolves to the "+" header action alone (a
  // thread row would also carry that accessible name once one exists).
  await page.getByRole('button', { name: 'New thread', exact: true }).click()
  await page.getByRole('textbox', { name: 'Message the agent' }).waitFor()
}

test('streams a turn into the timeline + Quick Access, and persists across reload', async ({
  page,
}) => {
  await waitForShell(page)
  await newThread(page)

  const composer = page.getByRole('textbox', { name: 'Message the agent' })
  await composer.fill('Ship the feature')
  await composer.press('Enter')

  // The user turn renders as a bubble, and the assistant text streams in. Scope to the
  // viewer (role=main) isn't enough on its own: the new thread's provisional title is the
  // first message text, so until the auto-title reconciles, the viewer's own TAB (also under
  // role=main — see tab-bar.tsx) reads "Ship the feature" too, colliding with the timeline
  // bubble. Wait for the retitle to land first, which makes the bubble match unique.
  const timeline = page.getByRole('main')
  // Session companion also shows the title — use first() (tab + session strip).
  await expect(timeline.getByText('Fake thread title', { exact: true }).first()).toBeVisible()
  await expect(timeline.getByText('Ship the feature', { exact: true }).first()).toBeVisible()
  await expect(timeline.getByText('Hello from the fake agent')).toBeVisible()

  // The plan card sits in the timeline (its "N/M done" counter is unique to it — "Plan"
  // alone also labels the composer toggle + the Quick Access group), and the tool call lands.
  // The tool item is the ONE button titled "Run tests" — a bare text match is ambiguous
  // (the plan checklist renders the same step text, and both live under role=main; the
  // v0.21.0/0.21.1 release runs died on exactly that strict-mode violation).
  await expect(page.getByText('1/3 done')).toBeVisible()
  await expect(timeline.getByRole('button', { name: 'Run tests' })).toBeVisible()

  // Quick Access mirrors the session: the plan checklist with its own progress counter…
  await expect(page.getByText('1 of 3 done')).toBeVisible()
  // …and, once the turn ends, the Usage group last-turn line from the final idle status
  // ({100 in, 50 out}). Prefer the "Last turn …" phrasing — the timeline footer and the
  // session strip also carry token counts, and a bare "100 in · 50 out" is no longer unique
  // (strict mode would fail on the multi-match, the same class of bug that killed v0.21.x).
  await expect(page.getByText('Last turn 100 in · 50 out')).toBeVisible()
  // Session strip + Session companion both say Idle — take the first.
  await expect(page.getByText('Idle', { exact: true }).first()).toBeVisible()

  // Turn is idle again: the composer shows Send (not Stop).
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()

  // The one-shot LLM auto-title fires after the first turn succeeds → 'Fake thread title'.
  await expect(page.getByText('Fake thread title').first()).toBeVisible()

  // Reload the renderer only — the daemon (a separate process) keeps the thread alive and
  // durable, so it must reappear and its timeline must replay without resending anything.
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  await waitForShell(page)
  await selectTab(page, 'Agent')

  // Thread row is title + meta (provider · model · …) — name is no longer exact-only.
  const row = page.getByRole('button', { name: /Fake thread title/ }).first()
  await expect(row).toBeVisible()
  await row.click()

  const replay = page.getByRole('main')
  await expect(replay.getByText('Hello from the fake agent')).toBeVisible()
  await expect(replay.getByText('Ship the feature', { exact: true })).toBeVisible()
})

test('starts a thread in a fresh worktree and switches to it', async ({ page }) => {
  await waitForShell(page)
  await selectTab(page, 'Agent')

  // Open the "+" split-button dropdown and pick the worktree entry.
  await page.getByRole('button', { name: 'Choose provider for new thread' }).click()
  await page.getByRole('menuitem', { name: 'New thread in worktree…' }).click()

  // Name the branch and confirm — git makes the worktree, a thread is created bound to it,
  // and the window switches to the new worktree in place (no new-window dependency).
  await page.getByRole('textbox', { name: 'Branch name' }).fill('e2e-wt')
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  // Footer branch + worktree chip + session strip all mention e2e-wt.
  await expect(page.getByRole('button', { name: 'e2e-wt', exact: true }).first()).toBeVisible()
  await expect(page.getByText(/e2e-wt/).first()).toBeVisible()
})

// Flaky under browser e2e after worktree-chip U20 (branch+worktree both named): inbox
// probe timing + dual "main" buttons. Covered by unit tests on worktree-inbox + switcher;
// re-enable once native e2e isolation is re-baselined on the runner.
test.skip('surfaces a sibling worktree in the Review inbox and switches to it on click', async ({
  page,
}) => {
  await waitForShell(page)
  await selectTab(page, 'Agent')
  await page.getByRole('button', { name: 'Choose provider for new thread' }).click()
  await page.getByRole('menuitem', { name: 'New thread in worktree…' }).click()
  await page.getByRole('textbox', { name: 'Branch name' }).fill('e2e-inbox')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('button', { name: /Worktrees: e2e-inbox/ })).toBeVisible()
  await writeFile(join(`${REPO_DIR}-worktrees`, 'e2e-inbox', 'inbox-change.txt'), 'edited\n')
  await page.getByRole('button', { name: /Worktrees:/ }).click()
  await page.getByRole('menuitem').filter({ hasText: 'main' }).first().click()
  await expect(page.getByRole('button', { name: /Worktrees: main/ })).toBeVisible()
  await selectTab(page, 'Review')
  await expect(page.getByText('Review inbox')).toBeVisible()
  await page.getByRole('button', { name: /e2e-inbox/ }).click()
  await expect(page.getByRole('button', { name: /Worktrees: e2e-inbox/ })).toBeVisible()
})

test('gates a turn on an approval and completes on Accept', async ({ page }) => {
  await waitForShell(page)
  await newThread(page)

  // Flip the thread's permission posture to "Ask to approve" through the composer's mode
  // menu (the chip shows the current MODE_LABEL — 'Full access' by default). Wait for the
  // chip to reflect the new mode before sending, so the daemon has persisted mode=approve
  // (the roster refetch is what proves the write landed) and the fake gates on approval.
  await page.getByRole('button', { name: 'Full access' }).click()
  await page.getByRole('menuitemradio', { name: 'Ask to approve' }).click()
  // Dismiss the menu — its modal backdrop otherwise lingers and intercepts the later
  // Accept click — and confirm the mode chip now reads the new posture (the roster refetch
  // that flips the chip is also what proves the daemon persisted mode=approve).
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menuitemradio', { name: 'Ask to approve' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Ask to approve' })).toBeVisible()

  const composer = page.getByRole('textbox', { name: 'Message the agent' })
  await composer.fill('Delete the build dir')
  await composer.press('Enter')

  // The approval card appears and gates the turn. Accept (exact, so it doesn't catch
  // "Accept for session"); the card flips to accepted and the turn finishes.
  const accept = page.getByRole('button', { name: 'Accept', exact: true })
  await expect(accept).toBeVisible()
  await accept.click()

  await expect(page.getByText('Accepted')).toBeVisible()
  // Turn is idle again — the composer's Send button is back (no Stop).
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()
})
