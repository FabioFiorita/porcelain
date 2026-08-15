import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { taskSchema } from '@porcelain/contracts/tasks'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  attachFile,
  createTask,
  describeTasks,
  normalizeTags,
  normalizeTaskStatus,
  readTasks,
  type Task,
  updateTask,
} from './tasks-file'

let root = ''
let repoPath = ''
let homeDir = ''
let filesDir = ''
const prevHome = process.env.PORCELAIN_HOME

/** The Hub inventory the daemon writes when a repo is first opened in Porcelain. */
function seedInventory(): void {
  const commonGitDir = realpathSync(join(repoPath, '.git'))
  mkdirSync(homeDir, { recursive: true })
  writeFileSync(
    join(homeDir, 'hub-inventory.json'),
    JSON.stringify({
      version: 1,
      value: {
        projects: [
          {
            id: 'proj-1',
            commonGitDir,
            groupingKey: 'name:repo',
            name: 'repo',
            worktrees: [{ id: 'wt-1', gitDir: commonGitDir }],
          },
        ],
      },
    }),
  )
}

function readEnvelope(): { version: number; value: { tasks: Task[] } } {
  return JSON.parse(readFileSync(join(homeDir, 'tasks', 'tasks.json'), 'utf8')) as {
    version: number
    value: { tasks: Task[] }
  }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'porcelain-tasks-cli-'))
  repoPath = join(root, 'repo')
  homeDir = join(root, 'home')
  filesDir = join(root, 'files')
  mkdirSync(repoPath, { recursive: true })
  mkdirSync(filesDir, { recursive: true })
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: repoPath })
  process.env.PORCELAIN_HOME = homeDir
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  if (prevHome === undefined) delete process.env.PORCELAIN_HOME
  else process.env.PORCELAIN_HOME = prevHome
})

describe('normalizeTaskStatus', () => {
  it('accepts the four statuses and rejects anything else', () => {
    expect(normalizeTaskStatus('todo')).toBe('todo')
    expect(normalizeTaskStatus('blocked')).toBe('blocked')
    expect(normalizeTaskStatus('backlog')).toBeNull()
    expect(normalizeTaskStatus(7)).toBeNull()
  })
})

describe('normalizeTags', () => {
  it('trims, drops blanks, and de-duplicates', () => {
    expect(normalizeTags(' infra , , flaky ,infra')).toEqual(['infra', 'flaky'])
  })
  it('reads an absent flag as no tags', () => {
    expect(normalizeTags(undefined)).toEqual([])
  })
})

describe('createTask + readTasks', () => {
  it('round-trips through the daemon envelope with todo as the default status', () => {
    seedInventory()
    const task = createTask({ repoPath, title: 'Chase the flake' })

    expect(task.status).toBe('todo')
    expect(task.createdAt).toBe(task.updatedAt)
    expect(task.references).toEqual({ projectId: 'proj-1', worktreeId: 'wt-1' })

    const envelope = readEnvelope()
    expect(envelope.version).toBe(1)
    expect(envelope.value.tasks).toEqual([task])
    expect(readTasks()).toEqual([task])
  })

  it('writes a row the daemon parses against taskSchema, with notes omitted when absent', () => {
    seedInventory()
    createTask({ repoPath, title: 'Chase the flake', tags: ['infra'] })
    const [written] = readEnvelope().value.tasks

    const parsed = taskSchema.safeParse(written)
    expect(parsed.error?.message ?? 'valid').toBe('valid')
    expect(written === undefined ? [] : Object.keys(written)).not.toContain('notes')
  })

  it('keeps notes, tags, links, and an explicit status on the parsed row', () => {
    seedInventory()
    const task = createTask({
      repoPath,
      title: 'Ship the table',
      notes: '## why\nbecause',
      status: 'doing',
      tags: ['infra', 'ui'],
      link: { url: 'https://example.com/issue/23', label: 'issue 23' },
    })

    expect(task.notes).toBe('## why\nbecause')
    expect(task.status).toBe('doing')
    expect(task.tags).toEqual(['infra', 'ui'])
    expect(task.links).toEqual([{ url: 'https://example.com/issue/23', label: 'issue 23' }])
    expect(taskSchema.safeParse(readEnvelope().value.tasks[0]).success).toBe(true)
  })

  it('labels a link with its URL when no label is given', () => {
    seedInventory()
    const task = createTask({ repoPath, title: 'Read it', link: { url: 'https://example.com/a' } })
    expect(task.links).toEqual([{ url: 'https://example.com/a', label: 'https://example.com/a' }])
  })

  it('degrades to no references outside a Porcelain-known repo', () => {
    const task = createTask({ repoPath, title: 'Global chore' })
    expect(task.references).toEqual({})
    expect(taskSchema.safeParse(readEnvelope().value.tasks[0]).success).toBe(true)
  })

  it('honours explicit --project-id / --worktree-id over the checkout', () => {
    seedInventory()
    const task = createTask({
      repoPath,
      title: 'Elsewhere',
      projectId: 'proj-9',
      worktreeId: 'wt-9',
    })
    expect(task.references).toEqual({ projectId: 'proj-9', worktreeId: 'wt-9' })
  })

  it('refuses a worktree reference without its Project', () => {
    expect(() => createTask({ repoPath, title: 'Orphan', worktreeId: 'wt-9' })).toThrow(
      /--worktree-id requires --project-id/,
    )
  })

  it('refuses a blank title', () => {
    expect(() => createTask({ repoPath, title: '   ' })).toThrow(/title is required/)
  })

  it('appends rather than replacing', () => {
    createTask({ repoPath, title: 'First' })
    createTask({ repoPath, title: 'Second' })
    expect(readTasks().map((task) => task.title)).toEqual(['First', 'Second'])
  })
})

describe('updateTask', () => {
  it('changes title, notes, status, and tags, keeping createdAt', () => {
    const task = createTask({ repoPath, title: 'Old' })
    const updated = updateTask(task.id, {
      title: 'New',
      notes: 'detail',
      status: 'blocked',
      tags: ['infra'],
    })

    expect(updated?.title).toBe('New')
    expect(updated?.notes).toBe('detail')
    expect(updated?.status).toBe('blocked')
    expect(updated?.tags).toEqual(['infra'])
    expect(updated?.createdAt).toBe(task.createdAt)
    expect(readTasks()).toEqual([updated])
  })

  it('returns null for an id nobody wrote, leaving the table alone', () => {
    const task = createTask({ repoPath, title: 'Only one' })
    expect(updateTask('00000000-0000-4000-8000-000000000099', { status: 'done' })).toBeNull()
    expect(readTasks()).toEqual([task])
  })

  it('is how `tasks done` marks a Task done', () => {
    const task = createTask({ repoPath, title: 'Finish' })
    expect(updateTask(task.id, { status: 'done' })?.status).toBe('done')
    expect(readTasks()[0]?.status).toBe('done')
  })

  it('refuses a blank title', () => {
    const task = createTask({ repoPath, title: 'Keep me' })
    expect(() => updateTask(task.id, { title: '  ' })).toThrow(/title is required/)
  })
})

describe('attachments', () => {
  it('copies the file into the Task attachment dir and stores a relative path', () => {
    const source = join(filesDir, 'shot.png')
    writeFileSync(source, 'fake-png')
    const task = createTask({ repoPath, title: 'With proof', attachPath: source })

    const attachment = task.attachments[0]
    expect(task.attachments).toHaveLength(1)
    expect(attachment?.name).toBe('shot.png')
    expect(attachment?.byteSize).toBe(8)
    expect(attachment?.mime).toBe('image/png')
    expect(attachment?.storedPath).toBe(`${task.id}/${attachment?.id}-shot.png`)

    const copied = join(homeDir, 'tasks', 'attachments', attachment?.storedPath ?? '')
    expect(readFileSync(copied, 'utf8')).toBe('fake-png')
    expect(taskSchema.safeParse(readEnvelope().value.tasks[0]).success).toBe(true)
  })

  it('falls back to application/octet-stream for an unknown extension', () => {
    const source = join(filesDir, 'trace.weird')
    writeFileSync(source, 'x')
    const task = createTask({ repoPath, title: 'Odd file', attachPath: source })
    expect(task.attachments[0]?.mime).toBe('application/octet-stream')
  })

  it('rejects a relative --attach', () => {
    expect(() => createTask({ repoPath, title: 'Bad', attachPath: 'relative/shot.png' })).toThrow(
      /must be an absolute path/,
    )
  })

  it('rejects a missing --attach', () => {
    expect(() =>
      createTask({ repoPath, title: 'Bad', attachPath: join(filesDir, 'nope.png') }),
    ).toThrow(/not found/)
  })

  it('rejects a --attach that is not a regular file', () => {
    const dir = join(filesDir, 'a-directory')
    mkdirSync(dir)
    expect(() => createTask({ repoPath, title: 'Bad', attachPath: dir })).toThrow(
      /must be a regular file/,
    )
  })

  // Unnormalized paths: `join` would collapse these, and the guard must hold on the raw
  // string the caller passed, exactly as the daemon's basename check does.
  it('rejects a --attach whose basename is . or ..', () => {
    expect(() => attachFile('task-1', `${filesDir}/.`)).toThrow(/unsafe file name/)
    expect(() => attachFile('task-1', `${filesDir}/..`)).toThrow(/unsafe file name/)
  })

  it('rejects an empty --attach path', () => {
    expect(() => createTask({ repoPath, title: 'Bad', attachPath: '' })).toThrow(
      /must be an absolute path/,
    )
  })

  it('rejects a --attach path containing a NUL byte', () => {
    expect(() => attachFile('task-1', `${filesDir}/sh\0ot.png`)).toThrow(/unsafe file name/)
  })

  it('follows a symlinked source but stores the copy inside the attachment root', () => {
    const real = join(filesDir, 'real.txt')
    writeFileSync(real, 'contents')
    const link = join(filesDir, 'link.txt')
    symlinkSync(real, link)

    const task = createTask({ repoPath, title: 'Linked', attachPath: link })
    const stored = task.attachments[0]?.storedPath ?? ''
    expect(stored.startsWith('..')).toBe(false)
    expect(readFileSync(join(homeDir, 'tasks', 'attachments', stored), 'utf8')).toBe('contents')
  })

  it('rejects a symlinked directory that points at a device', () => {
    const link = join(filesDir, 'dev-null')
    symlinkSync('/dev/null', link)
    expect(() => createTask({ repoPath, title: 'Bad', attachPath: link })).toThrow(
      /must be a regular file/,
    )
  })
})

describe('describeTasks', () => {
  it('explains an empty table', () => {
    expect(describeTasks([])).toContain('No Tasks on this daemon yet')
  })

  it('lists id, status, title, tags, and attachment/link counts', () => {
    const source = join(filesDir, 'shot.png')
    writeFileSync(source, 'fake-png')
    const task = createTask({
      repoPath,
      title: 'Chase the flake',
      status: 'doing',
      tags: ['infra'],
      link: { url: 'https://example.com/a' },
      attachPath: source,
    })

    const text = describeTasks(readTasks())
    expect(text).toContain(task.id)
    expect(text).toContain('(doing) Chase the flake')
    expect(text).toContain('[infra]')
    expect(text).toContain('1 attachment(s)')
    expect(text).toContain('1 link(s)')
  })
})
