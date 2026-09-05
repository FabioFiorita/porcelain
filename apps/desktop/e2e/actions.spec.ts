import { request } from 'node:http'
import { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } from '@porcelain/contracts'
import { porcelainMcpChannel } from '../../../packages/shared/src/mcp-channel'
import { expect, expectTerminalText, loc, test, waitForShell } from './helpers/app'

async function localMcpPost(
  home: string,
  options: { headers: Record<string, string>; data: unknown },
) {
  return new Promise<{
    status: () => number
    text: () => Promise<string>
    json: () => Promise<unknown>
  }>((resolve, reject) => {
    const req = request(
      {
        socketPath: porcelainMcpChannel(home),
        path: '/mcp',
        method: 'POST',
        headers: options.headers,
      },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          body += chunk
        })
        res.on('error', reject)
        res.on('end', () =>
          resolve({
            status: () => res.statusCode ?? 0,
            text: async () => body,
            json: async () => JSON.parse(body),
          }),
        )
      },
    )
    req.setTimeout(10000, () => req.destroy(new Error('Local MCP request timed out')))
    req.on('error', reject)
    req.end(JSON.stringify(options.data))
  })
}

const COMMAND = 'echo porcelain-e2e-actions'

/**
 * Actions are Project-scoped and the daemon only mints a Project id once a
 * repo is opened — poll the live inventory so the test uses the daemon's canonical
 * Environment and Worktree identity, including its realpath-normalized path.
 */
async function waitForProjectAndWorktree(page: import('@playwright/test').Page): Promise<{
  environmentId: string
  projectId: string
  worktreeId: string
  worktreePath: string
}> {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const parsed = await page.evaluate(
        async ({ protocolHeader, protocolVersion }) => {
          const token = localStorage.getItem('porcelain-client-token') ?? ''
          const response = await fetch(`${location.origin}/trpc/hubInventory`, {
            headers: {
              authorization: `Bearer ${token}`,
              [protocolHeader]: protocolVersion,
            },
          })
          if (!response.ok) throw new Error(`hubInventory returned ${response.status}`)
          return response.json()
        },
        {
          protocolHeader: PROTOCOL_VERSION_HEADER,
          protocolVersion: String(PROTOCOL_VERSION),
        },
      )
      const inventory = (
        parsed as {
          result: {
            data: {
              environment: { id: string }
              projects: { id: string; worktrees: { id: string; path: string }[] }[]
            }
          }
        }
      ).result.data
      const project = inventory.projects[0]
      const worktree = project?.worktrees[0]
      if (project !== undefined && worktree !== undefined) {
        return {
          environmentId: inventory.environment.id,
          projectId: project.id,
          worktreeId: worktree.id,
          worktreePath: worktree.path,
        }
      }
    } catch {
      // The daemon has not rebuilt the seeded Project yet — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('hubInventory never gained a Project + Worktree')
}

/**
 * Create the action through the same agent-facing MCP procedure production uses.
 * Directly planting `actions.json` bypasses the daemon's `actions.changed` notification and
 * leaves an already-mounted Actions query showing its cached empty result.
 */
async function createAgentAction(home: string, repoDir: string): Promise<string> {
  const response = await localMcpPost(home, {
    headers: {
      'content-type': 'application/json',
      'mcp-method': 'tools/call',
      'mcp-name': 'porcelain_action',
      'mcp-protocol-version': '2026-07-28',
    },
    data: {
      jsonrpc: '2.0',
      id: 'e2e-action-create',
      method: 'tools/call',
      params: {
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientCapabilities': {},
        },
        name: 'porcelain_action',
        arguments: {
          workspace: repoDir,
          op: 'create',
          title: 'Echo hello',
          command: COMMAND,
        },
      },
    },
  })
  expect(response.status()).toBe(200)
  const created = (await response.json()) as {
    result?: { isError?: boolean; content?: { text?: string }[] }
  }
  expect(created.result?.isError).not.toBe(true)
  const createdText = created.result?.content?.[0]?.text
  if (createdText === undefined) throw new Error('Action creation returned no content')
  expect(JSON.parse(createdText)).toMatchObject({
    value: { title: 'Echo hello', command: COMMAND },
  })

  const contextResponse = await localMcpPost(home, {
    headers: {
      'content-type': 'application/json',
      'mcp-method': 'tools/call',
      'mcp-name': 'porcelain_action',
      'mcp-protocol-version': '2026-07-28',
    },
    data: {
      jsonrpc: '2.0',
      id: 'e2e-action-list',
      method: 'tools/call',
      params: {
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientCapabilities': {},
        },
        name: 'porcelain_action',
        arguments: { workspace: repoDir, op: 'list' },
      },
    },
  })
  expect(contextResponse.status()).toBe(200)
  const contextBody = (await contextResponse.json()) as {
    result?: { content?: Array<{ text?: string }> }
  }
  const contextText = contextBody.result?.content?.[0]?.text
  if (contextText === undefined) throw new Error('porcelain_action returned no content')
  const parsed = JSON.parse(contextText) as { value?: Array<{ id: string; title: string }> }
  const action = parsed.value?.find((candidate) => candidate.title === 'Echo hello')
  if (action === undefined) throw new Error('porcelain_action did not return Echo hello')
  return action.id
}

/**
 * Ask this daemon to authorize a run directly, with the page's own session credential.
 * The menu can only offer targets the Hub knows, so a target from another checkout has
 * to be posted at the wire to prove the daemon — not the client — is what refuses it.
 */
async function authorizeRun(
  page: import('@playwright/test').Page,
  actionId: string,
  target: { environmentId: string; projectId: string; worktreeId: string; path: string },
): Promise<{ status: number; body: string }> {
  return page.evaluate(
    async ({ actionId, input, protocolHeader, protocolVersion }) => {
      const token = localStorage.getItem('porcelain-client-token') ?? ''
      const response = await fetch(`${location.origin}/trpc/prepareActionRun`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          [protocolHeader]: protocolVersion,
        },
        body: JSON.stringify({ actionId, target: input }),
      })
      return { status: response.status, body: await response.text() }
    },
    {
      input: target,
      actionId,
      protocolHeader: PROTOCOL_VERSION_HEADER,
      protocolVersion: String(PROTOCOL_VERSION),
    },
  )
}

test('Actions: the Hub menu lists a Project roster, runs it in the selected Worktree, and refuses a foreign target', async ({
  page,
  repoDir,
  seeded,
}) => {
  await waitForShell(page)
  const { environmentId, projectId, worktreeId, worktreePath } =
    await waitForProjectAndWorktree(page)
  await loc.hubWorktree(page, worktreeId).click()

  // 1. Listing: the agent-curated roster shows up in the top-corner menu, unreviewed —
  //    an action written by an agent is not something this machine has agreed to run.
  await loc.actionsMenu(page).click()
  // Mount and resolve the empty list before the agent writes. This proves the subsequent
  // MCP mutation reaches the already-live query through the daemon's change notification.
  await expect(loc.actionsEmpty(page)).toBeVisible()
  const actionId = await createAgentAction(seeded.udBase, repoDir)
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
  const foreign = await authorizeRun(page, actionId, {
    environmentId,
    projectId,
    worktreeId,
    path: `${repoDir}-somewhere-else`,
  })
  expect(foreign.status).toBeGreaterThanOrEqual(400)
  expect(foreign.body).toContain('actions.target-invalid')

  // The same request against a real Worktree of that Project is authorized.
  const allowed = await authorizeRun(page, actionId, {
    environmentId,
    projectId,
    worktreeId,
    path: worktreePath,
  })
  expect(allowed.status, allowed.body).toBe(200)
  expect(allowed.body).toContain(COMMAND)
})
