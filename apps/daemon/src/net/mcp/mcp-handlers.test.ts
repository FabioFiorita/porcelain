// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createMcpToolHandlers } from './mcp-handlers'
import type { McpOperations } from './mcp-operations'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'porcelain-mcp-handlers-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const PROJECT = 'proj-1'
const WORKTREE = 'wt-1'

/** Only the operations the tools reach; anything else is deliberately absent. */
function operations(overrides: Record<string, unknown> = {}) {
  const calls: { name: string; input: unknown }[] = []
  const record = (name: string, value: unknown) => {
    calls.push({ name, input: value })
  }
  const ops = {
    files: {
      worktreeProfile: async () => ({
        worktreeId: WORKTREE,
        base: { pinnedPaths: ['README.md'], hiddenPaths: ['dist'], layers: [] },
        override: null,
        resolved: { pinnedPaths: ['README.md'], hiddenPaths: ['dist'], layers: [] },
      }),
      setProjectProfile: async (repoPath: string, profile: unknown) => {
        record('setProjectProfile', { repoPath, profile })
      },
      setWorktreeProfile: async (repoPath: string, profile: unknown) => {
        record('setWorktreeProfile', { repoPath, profile })
      },
      ...(overrides.files ?? {}),
    },
    projects: {
      listHubInventory: async () => ({
        ok: true,
        value: {
          projects: [
            {
              id: PROJECT,
              name: 'porcelain',
              originUrl: null,
              path: root,
              worktrees: [
                {
                  id: WORKTREE,
                  projectId: PROJECT,
                  path: root,
                  name: 'main',
                  branch: 'main',
                  isPrimary: true,
                },
              ],
            },
          ],
        },
      }),
      listCanvases: async () => ({ ok: true, value: [] }),
      findCanvasByTemplate: async () => ({ ok: true, value: null }),
      forgetCanvas: async (input: unknown) => {
        record('forgetCanvas', input)
        return { ok: true, value: undefined }
      },
      writeCanvas: async (input: unknown) => {
        record('writeCanvas', input)
        return { ok: true, value: { id: 'canvas-1', title: 'Active review' } }
      },
      promoteCanvas: async (input: unknown) => {
        record('promoteCanvas', input)
        return { ok: true, value: { bundlePath: `${root}/.porcelain/canvases/canvas-1` } }
      },
      promoteOverrides: async (input: unknown) => {
        record('promoteOverrides', input)
        return { ok: true, value: {} }
      },
      ...(overrides.projects ?? {}),
    },
    review: {
      listReviewComments: async () => ({
        ok: true,
        value: [
          { id: 'c-1', path: 'a.ts', body: 'why?', resolved: false },
          { id: 'c-2', path: 'b.ts', body: 'done', resolved: true },
        ],
      }),
      readReviewedPaths: async () => ['a.ts'],
      answerReviewComment: async (input: unknown) => {
        record('answerReviewComment', input)
        return { ok: true, value: undefined }
      },
      ...(overrides.review ?? {}),
    },
    tasks: {
      listTasks: async () => ({
        ok: true,
        value: [
          { id: 'task-1', shortId: 'T-1', title: 'open', status: 'todo' },
          { id: 'task-2', shortId: 'T-2', title: 'shipped', status: 'done' },
        ],
      }),
      createTask: async (input: unknown) => {
        record('createTask', input)
        return { ok: true, value: { id: 'task-3', shortId: 'T-3', title: 'new' } }
      },
      updateTask: async (input: unknown) => {
        record('updateTask', input)
        return { ok: true, value: { id: 'task-1', shortId: 'T-1' } }
      },
      ...(overrides.tasks ?? {}),
    },
    actions: {
      listActions: async () => ({ ok: true, value: [] }),
      addAction: async (input: unknown) => {
        record('addAction', input)
        return { ok: true, value: { id: 'action-1', title: 'Ship' } }
      },
      updateAction: async (input: unknown) => {
        record('updateAction', input)
        return { ok: true, value: undefined }
      },
      deleteAction: async (input: unknown) => {
        record('deleteAction', input)
        return { ok: true, value: undefined }
      },
      ...(overrides.actions ?? {}),
    },
  }
  return { ops: ops as McpOperations, calls }
}

function handlers(overrides: Record<string, unknown> = {}) {
  const { ops, calls } = operations(overrides)
  return {
    calls,
    tools: createMcpToolHandlers({
      operations: ops,
      canvasBundleDir: (projectId, canvasId) => join(root, projectId, canvasId),
    }),
  }
}

describe('workspace resolution', () => {
  it('refuses a call with no workspace, naming what to pass', async () => {
    const { tools } = handlers()
    const result = await tools.call('porcelain_context', {})
    expect(result.isError).toBe(true)
    expect(result.text).toMatch(/workspace is required/)
  })

  it('refuses a checkout the daemon has not opened', async () => {
    const { tools } = handlers()
    const result = await tools.call('porcelain_context', { workspace: '/definitely/not/here' })
    expect(result.isError).toBe(true)
  })
})

describe('porcelain_context', () => {
  it('returns open comments and reviewed marks by default — the channels the CLI never had', async () => {
    const { tools } = handlers()
    const result = await tools.call('porcelain_context', { workspace: root })
    expect(result.isError).toBeUndefined()
    const body = JSON.parse(result.text) as {
      comments: { id: string }[]
      reviewedPaths: string[]
      tasks?: unknown
    }
    // The resolved comment is dropped: an agent about to act needs the open ones.
    expect(body.comments.map((comment) => comment.id)).toEqual(['c-1'])
    expect(body.reviewedPaths).toEqual(['a.ts'])
    // Tasks are daemon-wide and were not asked for.
    expect(body.tasks).toBeUndefined()
  })

  it('returns only unfinished Tasks when asked, so the board does not flood the context', async () => {
    const { tools } = handlers()
    const result = await tools.call('porcelain_context', {
      workspace: root,
      include: ['tasks'],
    })
    const body = JSON.parse(result.text) as { tasks: { shortId: string }[] }
    expect(body.tasks.map((task) => task.shortId)).toEqual(['T-1'])
  })

  it('finds one Task by its short id', async () => {
    const { tools } = handlers()
    const result = await tools.call('porcelain_context', {
      workspace: root,
      include: ['tasks'],
      taskId: 'T-2',
    })
    const body = JSON.parse(result.text) as { tasks: { shortId: string }[] }
    expect(body.tasks.map((task) => task.shortId)).toEqual(['T-2'])
  })
})

describe('porcelain_profile', () => {
  it('reads the selected level and replaces it as one document', async () => {
    const { tools, calls } = handlers()
    const read = await tools.call('porcelain_profile', {
      workspace: root,
      level: 'project',
      op: 'get',
    })
    expect(JSON.parse(read.text)).toMatchObject({ pinnedPaths: ['README.md'] })

    const written = await tools.call('porcelain_profile', {
      workspace: root,
      level: 'worktree',
      op: 'set',
      profile: { pinnedPaths: ['src'], hiddenPaths: [], unhiddenPaths: [], layers: null },
    })
    expect(written.isError).toBeUndefined()
    expect(calls).toContainEqual({
      name: 'setWorktreeProfile',
      input: {
        repoPath: root,
        profile: { pinnedPaths: ['src'], hiddenPaths: [], unhiddenPaths: [], layers: null },
      },
    })
  })

  it('rejects a malformed whole profile', async () => {
    const { tools } = handlers()
    const result = await tools.call('porcelain_profile', {
      workspace: root,
      level: 'project',
      op: 'set',
      profile: { pinnedPaths: 'README.md' },
    })
    expect(result.isError).toBe(true)
  })
})

describe('porcelain_review', () => {
  it('publishes a Review carrying the review template so it can be found again', async () => {
    const { tools, calls } = handlers()
    const result = await tools.call('porcelain_review', {
      workspace: root,
      mode: 'replace',
      name: 'Plugin track',
      thesis: 'One writer.',
      files: [{ path: 'apps/daemon/src/server.ts', source: 'changed' }],
    })
    expect(result.isError).toBeUndefined()
    const written = calls.find((call) => call.name === 'writeCanvas')?.input as {
      template: string
      projectId: string
      source: { files: { path: string }[] }
    }
    expect(written.template).toBe('review')
    expect(written.projectId).toBe(PROJECT)
    expect(written.source.files.map((file) => file.path)).toContain('review.json')
  })

  it('accepts a name and thesis with no files — Intent-first is a valid start', async () => {
    const { tools, calls } = handlers()
    const result = await tools.call('porcelain_review', {
      workspace: root,
      mode: 'replace',
      name: 'Just the intent',
      thesis: 'Before a line is written.',
    })
    expect(result.isError).toBeUndefined()
    expect(calls.some((call) => call.name === 'writeCanvas')).toBe(true)
  })

  it('refuses to append when no Review exists, instead of inventing one', async () => {
    const { tools } = handlers()
    const result = await tools.call('porcelain_review', {
      workspace: root,
      mode: 'append',
      files: [{ path: 'a.ts' }],
    })
    expect(result.isError).toBe(true)
    expect(result.text).toMatch(/no Review to append to/i)
  })

  it('clears nothing gracefully when there is no Review', async () => {
    const { tools, calls } = handlers()
    const result = await tools.call('porcelain_review', { workspace: root, mode: 'clear' })
    expect(result.isError).toBeUndefined()
    expect(calls.some((call) => call.name === 'forgetCanvas')).toBe(false)
  })
})

describe('porcelain_action', () => {
  it('creates as the agent, and says the command is untrusted', async () => {
    const { tools, calls } = handlers()
    const result = await tools.call('porcelain_action', {
      workspace: root,
      op: 'save',
      title: 'Ship',
      command: 'make ship',
    })
    expect(result.isError).toBeUndefined()
    expect(result.text).toMatch(/UNTRUSTED/)
    const input = calls.find((call) => call.name === 'addAction')?.input as { authoredBy: string }
    expect(input.authoredBy).toBe('agent')
  })

  it('edits as the agent too, so the changed command loses its trust', async () => {
    const { tools, calls } = handlers()
    await tools.call('porcelain_action', {
      workspace: root,
      op: 'save',
      id: 'action-1',
      command: 'make ship --force',
    })
    const input = calls.find((call) => call.name === 'updateAction')?.input as {
      authoredBy: string
    }
    expect(input.authoredBy).toBe('agent')
  })
})

describe('porcelain_task', () => {
  it('creates a Task referencing the resolved checkout', async () => {
    const { tools, calls } = handlers()
    await tools.call('porcelain_task', { workspace: root, title: 'Wire the tools' })
    const input = calls.find((call) => call.name === 'createTask')?.input as {
      references: { projectId: string; worktreeId: string }
    }
    expect(input.references).toEqual({ projectId: PROJECT, worktreeId: WORKTREE })
  })

  it('updates when given an id rather than creating a duplicate', async () => {
    const { tools, calls } = handlers()
    await tools.call('porcelain_task', { workspace: root, id: 'task-1', status: 'done' })
    expect(calls.some((call) => call.name === 'createTask')).toBe(false)
    expect(calls.some((call) => call.name === 'updateTask')).toBe(true)
  })

  it('needs a title to create', async () => {
    const { tools } = handlers()
    const result = await tools.call('porcelain_task', { workspace: root })
    expect(result.isError).toBe(true)
  })
})

describe('porcelain_reply', () => {
  it('answers a comment and says the human still owns resolving it', async () => {
    const { tools, calls } = handlers()
    const result = await tools.call('porcelain_reply', {
      workspace: root,
      commentId: 'c-1',
      body: 'Renamed it, see the Review.',
    })
    expect(result.isError).toBeUndefined()
    expect(result.text).toMatch(/only the human can resolve/i)
    expect(calls.find((call) => call.name === 'answerReviewComment')?.input).toMatchObject({
      commentId: 'c-1',
      body: 'Renamed it, see the Review.',
    })
  })
})

describe('porcelain_promote', () => {
  it('promotes into the resolved checkout without staging anything', async () => {
    const { tools, calls } = handlers()
    const result = await tools.call('porcelain_promote', {
      workspace: root,
      what: 'canvas',
      canvasId: 'canvas-1',
    })
    expect(result.text).toMatch(/nothing staged or committed/i)
    expect(calls.find((call) => call.name === 'promoteCanvas')?.input).toMatchObject({
      projectId: PROJECT,
      canvasId: 'canvas-1',
      path: root,
    })
  })

  it('needs a canvasId when promoting a Canvas', async () => {
    const { tools } = handlers()
    const result = await tools.call('porcelain_promote', { workspace: root, what: 'canvas' })
    expect(result.isError).toBe(true)
  })
})

describe('unknown tools', () => {
  it('are refused by name', async () => {
    const { tools } = handlers()
    const result = await tools.call('porcelain_nope', { workspace: root })
    expect(result.isError).toBe(true)
  })
})
