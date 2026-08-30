// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createMcpToolHandlers } from './mcp-handlers'
import type { McpOperations } from './mcp-operations'

const PROJECT = 'project-1'
const WORKTREE = 'worktree-1'
const REPO = process.cwd()

function harness(
  options: {
    trackedCanvas?: boolean
    canvasContent?: string
    worktreeOverride?: {
      layers: { label: string; pattern: string }[] | null
    } | null
  } = {},
) {
  const calls: { name: string; input: unknown }[] = []
  const comments = [
    { id: 'comment-open', path: 'src/a.ts', body: 'why?', resolved: false, createdAt: 1 },
    { id: 'comment-done', path: 'src/b.ts', body: 'done', resolved: true, createdAt: 2 },
  ]
  const canvas = {
    id: 'canvas-1',
    worktreeId: WORKTREE,
    title: 'Canvas',
    kind: 'markdown',
    tracked: options.trackedCanvas ?? false,
  }
  const ops = {
    files: {
      worktreeProfile: async () => ({
        worktreeId: WORKTREE,
        base: { pinnedPaths: ['README.md'], hiddenPaths: ['dist'], layers: [] },
        override: options.worktreeOverride ?? null,
        resolved: { pinnedPaths: ['README.md'], hiddenPaths: ['dist'], layers: [] },
      }),
      setProjectProfile: async (repoPath: string, profile: unknown) =>
        calls.push({ name: 'setProjectProfile', input: { repoPath, profile } }),
      setWorktreeProfile: async (repoPath: string, profile: unknown) =>
        calls.push({ name: 'setWorktreeProfile', input: { repoPath, profile } }),
    },
    projects: {
      listHubInventory: async () => ({
        ok: true,
        value: {
          projects: [
            {
              id: PROJECT,
              name: 'porcelain',
              path: REPO,
              worktrees: [
                { id: WORKTREE, path: REPO, name: 'main', branch: 'main', isPrimary: true },
              ],
            },
          ],
        },
      }),
      listCanvases: async () => ({ ok: true, value: [canvas] }),
      readCanvas: async () => ({
        ok: true,
        value: { record: canvas, content: options.canvasContent ?? '# Canvas' },
      }),
      forgetCanvas: async (input: unknown) => {
        calls.push({ name: 'forgetCanvas', input })
        return { ok: true, value: undefined }
      },
      writeCanvas: async (input: unknown) => {
        calls.push({ name: 'writeCanvas', input })
        const id =
          typeof input === 'object' &&
          input !== null &&
          'id' in input &&
          typeof input.id === 'string'
            ? input.id
            : 'canvas-2'
        return { ok: true, value: { id, title: 'New Canvas' } }
      },
      promoteCanvas: async (input: unknown) => {
        calls.push({ name: 'promoteCanvas', input })
        return { ok: true, value: { bundlePath: `${REPO}/.porcelain/canvases/canvas-2` } }
      },
      promoteOverrides: async (input: unknown) => {
        calls.push({ name: 'promoteOverrides', input })
        return { ok: true, value: {} }
      },
    },
    git: {
      statusGit: async () => ({ ok: true, value: [] }),
      logGit: async () => [{ hash: 'abc123' }],
    },
    review: {
      listReviewComments: async () => ({ ok: true, value: comments }),
      addReviewComment: async (input: unknown) => {
        calls.push({ name: 'addReviewComment', input })
        return { ok: true, value: comments[0] }
      },
      editReviewComment: async (input: unknown) => {
        calls.push({ name: 'editReviewComment', input })
        return { ok: true, value: undefined }
      },
      answerReviewComment: async (input: unknown) => {
        calls.push({ name: 'answerReviewComment', input })
        return { ok: true, value: undefined }
      },
      deleteReviewComment: async (input: unknown) => {
        calls.push({ name: 'deleteReviewComment', input })
        return { ok: true, value: undefined }
      },
      resolveReviewComment: async (input: unknown) => {
        calls.push({ name: 'resolveReviewComment', input })
        return { ok: true, value: undefined }
      },
    },
    actions: {
      listActions: async () => ({
        ok: true,
        value: [{ id: 'action-1', title: 'Test', command: 'pnpm test', trusted: false }],
      }),
      addAction: async (input: unknown) => {
        calls.push({ name: 'addAction', input })
        return { ok: true, value: { id: 'action-2', title: 'New' } }
      },
      updateAction: async (input: unknown) => {
        calls.push({ name: 'updateAction', input })
        return { ok: true, value: undefined }
      },
      deleteAction: async (input: unknown) => {
        calls.push({ name: 'deleteAction', input })
        return { ok: true, value: undefined }
      },
    },
  } as unknown as McpOperations
  return {
    calls,
    tools: createMcpToolHandlers({
      operations: ops,
    }),
  }
}

describe('domain MCP entry points', () => {
  it('lists Projects without a context preflight', async () => {
    const { tools } = harness()
    const result = await tools.call('porcelain_project', { op: 'list' })
    expect(result.isError).toBeUndefined()
    expect(result.text).toContain(PROJECT)
    expect((await tools.call('porcelain_legacy', { workspace: REPO })).isError).toBe(true)
  })

  it('lists both open and resolved comments and routes replies/resolve/reopen through comments', async () => {
    const { tools, calls } = harness()
    const all = await tools.call('porcelain_comment', {
      op: 'list',
      workspace: REPO,
      status: 'all',
    })
    expect(JSON.parse(all.text).value).toHaveLength(2)
    await tools.call('porcelain_comment', {
      op: 'reply',
      workspace: REPO,
      id: 'comment-open',
      body: 'fixed',
    })
    await tools.call('porcelain_comment', { op: 'resolve', workspace: REPO, id: 'comment-open' })
    await tools.call('porcelain_comment', { op: 'reopen', workspace: REPO, id: 'comment-open' })
    expect(calls).toEqual(
      expect.arrayContaining([
        {
          name: 'answerReviewComment',
          input: { projectPath: REPO, commentId: 'comment-open', body: 'fixed' },
        },
        {
          name: 'resolveReviewComment',
          input: { projectPath: REPO, commentId: 'comment-open', resolved: true },
        },
        {
          name: 'resolveReviewComment',
          input: { projectPath: REPO, commentId: 'comment-open', resolved: false },
        },
      ]),
    )
  })

  it('records comments created through MCP as agent-authored', async () => {
    const { tools, calls } = harness()
    await tools.call('porcelain_comment', {
      op: 'create',
      workspace: REPO,
      comment: { path: 'src/a.ts', body: 'Agent context' },
    })
    expect(calls).toContainEqual({
      name: 'addReviewComment',
      input: expect.objectContaining({
        projectPath: REPO,
        author: 'agent',
        path: 'src/a.ts',
        body: 'Agent context',
      }),
    })
  })

  it('keeps Actions CRUD-only and never exposes execution or trust', async () => {
    const { tools, calls } = harness()
    const run = await tools.call('porcelain_action', { op: 'run', workspace: REPO, id: 'action-1' })
    expect(run.isError).toBe(true)
    await tools.call('porcelain_action', {
      op: 'create',
      workspace: REPO,
      title: 'Check',
      command: 'pnpm test',
    })
    expect(calls.at(-1)).toEqual({
      name: 'addAction',
      input: expect.objectContaining({ authoredBy: 'agent' }),
    })
  })

  it('reads and promotes a Canvas through the Canvas entry point', async () => {
    const { tools, calls } = harness()
    expect(
      (await tools.call('porcelain_canvas', { op: 'get', workspace: REPO, id: 'canvas-1' })).text,
    ).toContain('# Canvas')
    await tools.call('porcelain_canvas', {
      op: 'create',
      workspace: REPO,
      title: 'Canvas',
      kind: 'markdown',
      files: [{ path: 'index.md', content: '# hi' }],
      tracked: true,
    })
    expect(calls.map((call) => call.name)).toEqual(
      expect.arrayContaining(['writeCanvas', 'promoteCanvas']),
    )
  })

  it('validates and writes a structured Canvas document', async () => {
    const { tools, calls } = harness()
    const document = {
      version: 2,
      template: 'decision',
      title: 'Architecture decision',
      summary: 'Choose the owning layer.',
      options: [
        { id: 'client', name: 'Client', summary: 'The client owns presentation.' },
        { id: 'daemon', name: 'Daemon', summary: 'The daemon owns presentation.' },
      ],
      criteria: [{ id: 'ownership', label: 'Ownership' }],
      assessments: [],
      recommendation: {
        optionId: 'client',
        summary: 'Use the client.',
        rationale: ['Presentation belongs to clients.'],
        confidence: 'high',
      },
    }
    const result = await tools.call('porcelain_canvas', {
      op: 'create',
      workspace: REPO,
      document,
    })

    expect(result.isError).toBeUndefined()
    expect(calls).toContainEqual({
      name: 'writeCanvas',
      input: expect.objectContaining({
        title: 'Architecture decision',
        kind: 'structured',
        entryFile: 'canvas.json',
        source: expect.objectContaining({ kind: 'structured', document: expect.any(String) }),
      }),
    })
  })

  it('returns actionable feedback for an invalid structured Canvas document', async () => {
    const { tools, calls } = harness()
    const result = await tools.call('porcelain_canvas', {
      op: 'create',
      workspace: REPO,
      document: {
        version: 1,
        title: 'Old document',
        tabs: [],
      },
    })

    expect(result.isError).toBe(true)
    expect(result.text).toContain('template')
    expect(calls.some((call) => call.name === 'writeCanvas')).toBe(false)
  })

  it('keeps Review as a v2 semantic History template and rejects removed Plan', async () => {
    const { tools, calls } = harness()
    const review = await tools.call('porcelain_canvas', {
      op: 'create',
      workspace: REPO,
      template: 'review',
      templateData: {
        title: 'Decision Canvas review',
        why: 'The product needs a bounded decision explanation.',
        how: 'Version 2 renders semantic templates.',
        layers: [{ label: 'Contract', pattern: 'packages/contracts/.*' }],
        files: [{ path: 'packages/contracts/src/projects/structured-canvas.contract.ts' }],
      },
    })
    const plan = await tools.call('porcelain_canvas', {
      op: 'create',
      workspace: REPO,
      template: 'plan',
      templateData: { title: 'Old Plan' },
    })
    expect(review.isError).toBeUndefined()
    expect(plan.isError).toBe(true)
    expect(review.text).toContain('"history": "bound"')
    expect(plan.text).toContain('template must be decision or review')
    expect(calls).toContainEqual(
      expect.objectContaining({
        name: 'writeCanvas',
        input: expect.objectContaining({ template: 'review' }),
      }),
    )
  })

  it('creates and updates a semantic Decision through porcelain_canvas', async () => {
    const { tools, calls } = harness()
    const templateData = {
      title: 'Canvas contract direction',
      summary: 'Choose the next structured Canvas contract.',
      context: 'One semantic contract is accepted.',
      options: [
        { id: 'semantic', name: 'Semantic', summary: 'Porcelain owns presentation.' },
        { id: 'html', name: 'HTML', summary: 'The author owns presentation.' },
        { id: 'markdown', name: 'Markdown', summary: 'Use prose only.' },
      ],
      criteria: [{ id: 'responsive', label: 'Responsive layout' }],
      assessments: [
        {
          optionId: 'semantic',
          criterionId: 'responsive',
          rating: 'strong',
          note: 'The client can adapt the same meaning.',
        },
      ],
      recommendation: {
        optionId: 'semantic',
        summary: 'Adopt semantic documents.',
        rationale: ['Presentation stays product-owned.'],
        confidence: 'high',
        assumptions: ['Clients consume the current contract.'],
        changeConditions: ['Clients cannot share the contract.'],
      },
    }
    const created = await tools.call('porcelain_canvas', {
      op: 'create',
      workspace: REPO,
      template: 'decision',
      templateData,
    })
    const updated = await tools.call('porcelain_canvas', {
      op: 'update',
      workspace: REPO,
      id: 'canvas-1',
      template: 'decision',
      templateData: {
        ...templateData,
        decision: {
          optionId: 'semantic',
          summary: 'Semantic version 2 is accepted.',
          rationale: ['It keeps one authoring path.'],
        },
      },
    })

    expect(created.isError).toBeUndefined()
    expect(updated.isError).toBeUndefined()
    const writes = calls.filter((call) => call.name === 'writeCanvas')
    expect(writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          input: expect.objectContaining({
            title: 'Canvas contract direction',
            kind: 'structured',
            template: 'decision',
          }),
        }),
        expect.objectContaining({ input: expect.objectContaining({ id: 'canvas-1' }) }),
      ]),
    )
    const firstWrite = writes[0]
    if (firstWrite === undefined) throw new Error('expected a Decision write')
    const source = (firstWrite.input as { source: { document: string } }).source
    expect(JSON.parse(source.document)).toMatchObject({ version: 2, template: 'decision' })
  })

  it('replaces an existing tracked Canvas on update and reads the new content', async () => {
    const { tools, calls } = harness({ trackedCanvas: true, canvasContent: '# Updated' })
    await tools.call('porcelain_canvas', {
      op: 'update',
      workspace: REPO,
      id: 'canvas-1',
      title: 'Updated Canvas',
      kind: 'markdown',
      files: [{ path: 'index.md', content: '# Updated' }],
    })
    expect(calls).toContainEqual({
      name: 'promoteCanvas',
      input: { projectId: PROJECT, canvasId: 'canvas-1', path: REPO, replace: true },
    })
    expect(
      (await tools.call('porcelain_canvas', { op: 'get', workspace: REPO, id: 'canvas-1' })).text,
    ).toContain('# Updated')
  })

  it('promotes only portable project profile fields', async () => {
    const { tools, calls } = harness()
    await tools.call('porcelain_profile', { op: 'promote', workspace: REPO, level: 'project' })
    expect(calls).toContainEqual({
      name: 'promoteOverrides',
      input: { projectId: PROJECT, path: REPO, hiddenPaths: ['dist'], pinnedPaths: ['README.md'] },
    })
  })

  it('keeps review layers out of the persistent profile surface', async () => {
    const { tools, calls } = harness()
    const profile = await tools.call('porcelain_profile', {
      op: 'get',
      workspace: REPO,
      level: 'project',
    })
    expect(JSON.parse(profile.text).value).toEqual({
      pinnedPaths: ['README.md'],
      hiddenPaths: ['dist'],
    })
    expect(
      (
        await tools.call('porcelain_profile', {
          op: 'set',
          workspace: REPO,
          level: 'worktree',
          profile: { layers: [{ label: 'Service', pattern: 'services/' }] },
        })
      ).isError,
    ).toBe(true)
    expect(calls.some((call) => call.name === 'setWorktreeProfile')).toBe(false)
  })
})
