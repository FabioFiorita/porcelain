import { execFile, spawn } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { describe, expect, it, onTestFinished } from 'vitest';
import { createPlayground } from './create-playground.ts';

describe('Disposable playground', () => {
  it('seeds linked worktrees, review changes and a local remote without using personal Git configuration', async () => {
    const fixture = await createPlayground();
    onTestFinished(() => rm(fixture.root, { recursive: true, force: true }));
    const git = async (...args: string[]) =>
      (
        await promisify(execFile)('git', ['-C', fixture.worktree, ...args], {
          env: fixture.environment,
        })
      ).stdout;
    expect(await git('worktree', 'list', '--porcelain')).toContain(
      fixture.project,
    );
    expect(await git('worktree', 'list', '--porcelain')).toContain(
      fixture.worktree,
    );
    expect(await git('status', '--porcelain')).toContain('MM README.md');
    expect(await git('status', '--porcelain')).toContain('?? notes.txt');
    expect(await git('remote', 'get-url', 'origin')).toBe(
      `${fixture.remote}\n`,
    );
    expect(await git('log', '--format=%s')).toContain(
      'Model launch tasks and completion summaries',
    );
    expect(
      await git('log', '--format=%s', '--', 'src/task-store.mjs'),
    ).toContain('Model launch tasks and completion summaries');
    expect(await git('show', 'HEAD:docs/review-guide.md')).toContain(
      'verify task counts',
    );
    expect(await git('status', '--porcelain')).toContain(
      'R  docs/launch-checklist.md -> docs/release-checklist.md',
    );
    expect(await git('status', '--porcelain')).toContain(
      ' D docs/legacy-plan.md',
    );
    expect(await git('status', '--porcelain')).toContain(
      'A  docs/accessibility.md',
    );
    expect(await git('diff', '--', 'src/styles.css')).toContain('+article');
    expect(
      await git('rev-list', '--left-right', '--count', 'main...review'),
    ).toBe('1\t1\n');
    expect(await git('rev-list', '--count', '@{upstream}..HEAD')).toBe('1\n');
    expect(await git('stash', 'list')).toContain(
      'Experiment with active task filtering',
    );
    await git('stash', 'apply', 'stash@{0}');
    expect(
      await readFile(`${fixture.worktree}/src/filters.mjs`, 'utf8'),
    ).toContain('activeTasks');
    expect(
      await git('ls-files', '--others', '--exclude-standard'),
    ).not.toContain('.cache/');
    const checks = await promisify(execFile)(
      process.execPath,
      ['--test', '--test-reporter=tap', 'tests/task-store.spec.mjs'],
      { cwd: fixture.worktree },
    );
    expect(checks.stdout).toContain('# fail 0');
    expect(await readFile(fixture.tokenFile, 'utf8')).toBe(fixture.token);
  });
  it('runs the sample application with real task data and browser assets', async () => {
    const fixture = await createPlayground();
    onTestFinished(() => rm(fixture.root, { recursive: true, force: true }));
    const child = spawn(process.execPath, ['server.mjs', '0'], {
      cwd: fixture.worktree,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const exited = new Promise<void>((resolve) =>
      child.once('close', () => resolve()),
    );
    onTestFinished(async () => {
      child.kill('SIGTERM');
      await exited;
    });
    const address = await new Promise<string>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', () =>
        reject(new Error('Sample app exited before listening')),
      );
      child.stdout.once('data', (chunk: Buffer) =>
        resolve(chunk.toString().trim().replace('Fieldnotes: ', '')),
      );
    });
    const board = await fetch(address);
    expect(await board.text()).toContain('Launch board');
    expect(await (await fetch(`${address}/api/tasks`)).json()).toMatchObject({
      tasks: [{ id: 'design' }, { id: 'docs' }, { id: 'release' }],
      summary: { total: 3, done: 1 },
    });
    expect((await fetch(`${address}/src/app.mjs`)).status).toBe(200);
    expect((await fetch(`${address}/src/styles.css`)).status).toBe(200);
    expect((await fetch(`${address}/missing`)).status).toBe(404);
  });
});
