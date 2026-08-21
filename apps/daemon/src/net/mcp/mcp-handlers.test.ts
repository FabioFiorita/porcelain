// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createMcpToolHandlers } from './mcp-handlers'
import type { McpOperations } from './mcp-operations'

const PROJECT = 'project-1'
const WORKTREE = 'worktree-1'
const REPO = process.cwd()

function harness(options: { trackedCanvas?: boolean; canvasContent?: string } = {}) {
  const calls: { name: string; input: unknown }[] = []
  const comments = [
    { id: 'comment-open', path: 'src/a.ts', body: 'why?', resolved: false, createdAt: 1 },
    { id: 'comment-done', path: 'src/b.ts', body: 'done', resolved: true, createdAt: 2 },
  ]
  const tasks = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      shortId: 'T-1',
      title: 'Ship',
      status: 'todo',
      notes: 'note',
      tags: [],
      links: [],
      pathRefs: [],
      references: { projectId: PROJECT, worktreeId: WORKTREE },
      attachments: [],
      updatedAt: new Date(0).toISOString(),
    },
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
        override: null,
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
      findCanvasByTemplate: async () => ({ ok: true, value: null }),
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
    tasks: {
      listTasks: async () => ({ ok: true, value: tasks }),
      createTask: async (input: unknown) => {
        calls.push({ name: 'createTask', input })
        return { ok: true, value: tasks[0] }
      },
      updateTask: async (input: unknown) => {
        calls.push({ name: 'updateTask', input })
        return { ok: true, value: tasks[0] }
      },
      deleteTask: async (input: unknown) => {
        calls.push({ name: 'deleteTask', input })
        return { ok: true, value: input as { taskId: string } }
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
      attachmentPath: (path) => `${REPO}/attachments/${path}`,
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

  it('supports Task list/get/create/update/delete without context', async () => {
    const { tools, calls } = harness()
    expect((await tools.call('porcelain_task', { op: 'get', id: 'T-1' })).text).toContain('Ship')
    await tools.call('porcelain_task', {
      op: 'create',
      title: 'New',
      status: 'doing',
    })
    await tools.call('porcelain_task', { op: 'update', id: 'T-1', status: 'done' })
    await tools.call('porcelain_task', { op: 'delete', id: 'T-1' })
    expect(calls.map((call) => call.name)).toEqual(
      expect.arrayContaining(['createTask', 'updateTask', 'deleteTask']),
    )
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
})
