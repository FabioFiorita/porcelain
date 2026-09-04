import { type ChildProcess, execFileSync } from 'node:child_process'
import { readFile, rm, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { Page } from '@playwright/test'
import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import {
  E2E_ADMIN_TOKEN,
  expect,
  loc,
  openSettings,
  REPO_DIR,
  seedIsolatedState,
  spawnDaemon,
  TestIds,
  test,
  waitForShell,
} from './helpers/app'
import { createFixtureRepo } from './helpers/fixture-repo'

const REMOTE_REPO_DIR = join(dirname(REPO_DIR), 'porcelain-e2e-actions-remote')
const MCP_ENTRY = join(
  __dirname,
  '..',
  '..',
  '..',
  'plugins',
  'porcelain',
  'bin',
  'porcelain-mcp.mjs',
)
const SHARED_ORIGIN = 'https://example.test/porcelain-actions.git'
const TITLE = 'Remote owner proof'
const PROOF_FILE = 'action-owner-proof.txt'
const COMMAND = `node -e "require('fs').writeFileSync('${PROOF_FILE}', process.cwd())"`

type Inventory = {
  environment: { id: string; name: string }
  projects: Array<{
    id: string
    worktrees: Array<{ id: string; path: string }>
  }>
}

async function daemonCall<T>(port: number, procedure: string, input: unknown): Promise<T> {
  const response = await fetch(`http://127.0.0.1:${port}/trpc/${procedure}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${E2E_ADMIN_TOKEN}`,
      'content-type': 'application/json',
      [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION),
    },
    body: JSON.stringify(input),
  })
  if (!response.ok)
    throw new Error(`${procedure} failed: ${response.status} ${await response.text()}`)
  const body = (await response.json()) as { result?: { data?: { json?: T } | T } }
  const data = body.result?.data
  return (typeof data === 'object' && data !== null && 'json' in data ? data.json : data) as T
}

async function daemonQuery<T>(port: number, procedure: string): Promise<T> {
  const response = await fetch(`http://127.0.0.1:${port}/trpc/${procedure}`, {
    headers: {
      authorization: `Bearer ${E2E_ADMIN_TOKEN}`,
      [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION),
    },
  })
  if (!response.ok) throw new Error(`${procedure} failed: ${response.status}`)
  const body = (await response.json()) as { result?: { data?: T } }
  return body.result?.data as T
}

async function mintPairingLink(port: number): Promise<string> {
  const origin = `http://127.0.0.1:${port}`
  const result = await daemonCall<{ url: string }>(port, 'issuePairingLink', {
    label: 'E2E Actions Environment',
    baseUrl: origin,
  })
  return result.url
}

function createAgentAction(
  seed: { udBase: string; env: Record<string, string> },
  workspace: string,
): void {
  const request = {
    jsonrpc: '2.0',
    id: 'e2e-remote-action-create',
    method: 'tools/call',
    params: {
      _meta: {
        'io.modelcontextprotocol/protocolVersion': '2026-07-28',
        'io.modelcontextprotocol/clientCapabilities': {},
      },
      name: 'porcelain_action',
      arguments: { workspace, op: 'create', title: TITLE, command: COMMAND },
    },
  }
  const response = execFileSync(process.execPath, [MCP_ENTRY], {
    cwd: process.cwd(),
    env: { ...process.env, ...seed.env, PORCELAIN_HOME: seed.udBase },
    input: `${JSON.stringify(request)}\n`,
    encoding: 'utf8',
  })
  const envelope = JSON.parse(response) as { error?: unknown; result?: unknown }
  expect(envelope.error).toBeUndefined()
  expect(response).toContain(TITLE)
}

async function registerOnWindowDaemon(page: Page, repoPath: string): Promise<void> {
  const error = await page.evaluate(
    async ([path, header, version]) => {
      const daemon = window.porcelain?.daemon
      if (daemon === undefined) return 'missing preload daemon'
      const response = await fetch(`${daemon.url}/trpc/openRepoPath`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${daemon.token}`,
          'content-type': 'application/json',
          [header]: version,
        },
        body: JSON.stringify(path),
      })
      return response.ok ? null : await response.text()
    },
    [repoPath, PROTOCOL_VERSION_HEADER, String(PROTOCOL_VERSION)] as const,
  )
  if (error !== null) throw new Error(error)
}

test('Actions can explicitly trust and run on a sibling Environment without changing review selection', async ({
  page,
  app,
}) => {
  test.setTimeout(180_000)
  if (app === null) throw new Error('this spec is Electron-only')

  await createFixtureRepo(REMOTE_REPO_DIR)
  execFileSync('git', ['remote', 'add', 'origin', SHARED_ORIGIN], { cwd: REPO_DIR })
  execFileSync('git', ['remote', 'add', 'origin', SHARED_ORIGIN], { cwd: REMOTE_REPO_DIR })
  const remoteSeed = await seedIsolatedState(REMOTE_REPO_DIR, true)
  let remote: { child: ChildProcess; port: number } | null = null
  try {
    remote = await spawnDaemon(remoteSeed)
    const remotePort = remote.port
    await daemonCall(remotePort, 'openRepoPath', REMOTE_REPO_DIR)
    createAgentAction(remoteSeed, REMOTE_REPO_DIR)

    await waitForShell(page)
    await registerOnWindowDaemon(page, REPO_DIR)
    const pairingLink = await mintPairingLink(remotePort)
    await openSettings(page)
    await page.getByTestId(TestIds.settingsSection('remotes')).first().click()
    await page.getByRole('button', { name: 'Pair an environment group' }).click()
    await page.getByPlaceholder('Connection link').fill(pairingLink)
    await page.getByRole('button', { name: 'Pair environment' }).click()
    await loc.settingsDialog(page).getByRole('button', { name: 'Close' }).click()
    await page.reload()
    await waitForShell(page)
    await expect(loc.hubProjects(page)).toHaveCount(2)

    const localRow = loc.hubWorktrees(page).filter({ hasText: basename(REPO_DIR) })
    await localRow.click()
    await expect(localRow).toHaveAttribute('aria-current', 'page')
    const remoteInventory = await daemonQuery<Inventory>(remotePort, 'hubInventory')
    const remoteProject = remoteInventory.projects[0]
    const remoteWorktree = remoteProject?.worktrees[0]
    if (remoteProject === undefined || remoteWorktree === undefined) {
      throw new Error('remote inventory has no Project Worktree')
    }

    await loc.actionsMenu(page).click()
    const remoteGroup = page.getByTestId(TestIds.actionsEnvironment(remoteInventory.environment.id))
    const remoteRun = remoteGroup.getByTestId(TestIds.actionRun(TITLE))
    await expect(remoteRun).toBeVisible()

    const trustRequest = page.waitForRequest(
      (request) =>
        request.url().startsWith(`http://127.0.0.1:${remotePort}`) &&
        request.url().includes('trustActions'),
    )
    await remoteRun.click()
    await expect(loc.actionTrustDialog(page)).toContainText(remoteInventory.environment.name)
    await loc.actionTrustConfirm(page).click()
    expect((await trustRequest).postData()).toContain(remoteProject.id)

    const picker = page.getByTestId(TestIds.actionsTargetPicker)
    await expect(picker).toContainText(`On ${remoteInventory.environment.name}`)
    const prepareRequest = page.waitForRequest(
      (request) =>
        request.url().startsWith(`http://127.0.0.1:${remotePort}`) &&
        request.url().includes('prepareActionRun'),
    )
    await picker.getByTestId(TestIds.actionsTargetOption(remoteWorktree.id)).click()
    type PreparedBody = {
      actionId?: string
      target?: {
        environmentId?: string
        projectId?: string
        worktreeId?: string
        path?: string
      }
    }
    const preparedEnvelope = (await prepareRequest).postDataJSON() as
      | PreparedBody
      | Record<'0', PreparedBody>
    const preparedBody = '0' in preparedEnvelope ? preparedEnvelope['0'] : preparedEnvelope
    expect(preparedBody).toMatchObject({
      target: {
        environmentId: remoteInventory.environment.id,
        projectId: remoteProject.id,
        worktreeId: remoteWorktree.id,
        path: remoteWorktree.path,
      },
    })
    const remoteProof = join(REMOTE_REPO_DIR, PROOF_FILE)
    const localProof = join(REPO_DIR, PROOF_FILE)
    await expect
      .poll(
        () =>
          readFile(remoteProof, 'utf8').catch((error: unknown) =>
            (error as NodeJS.ErrnoException).code === 'ENOENT' ? null : Promise.reject(error),
          ),
        { timeout: 30_000 },
      )
      .toBe(REMOTE_REPO_DIR)
    await expect
      .poll(() =>
        stat(localProof)
          .then(() => true)
          .catch(() => false),
      )
      .toBe(false)

    await expect(localRow).toHaveAttribute('aria-current', 'page')
  } finally {
    if (remote !== null) {
      const exited = new Promise<void>((resolve) => remote?.child.once('exit', () => resolve()))
      remote.child.kill('SIGTERM')
      await exited
    }
    await rm(remoteSeed.udBase, { recursive: true, force: true })
    await rm(remoteSeed.userData, { recursive: true, force: true })
    await rm(REMOTE_REPO_DIR, { recursive: true, force: true })
  }
})
