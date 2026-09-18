import { cp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { seedPlaygroundChanges } from './seed-playground-changes.ts';

/**
 * Commits the Fieldnotes story. With `base`, the story continues a cached
 * synthetic history: the remote and project start as clones of it (objects are
 * hard-linked), and the story's ignore rules extend the workspace ones.
 */
export async function seedPlaygroundProject(
  project: string,
  worktree: string,
  remote: string,
  git: (...args: string[]) => Promise<unknown>,
  base?: string,
) {
  const run = (...args: string[]) => git('-C', project, ...args);
  // Large checkouts use every core; the setting is not persisted.
  const checkout = base ? ['-c', 'checkout.workers=0'] : [];
  if (base) {
    await git('clone', '--quiet', '--bare', base, remote);
    await git(...checkout, 'clone', '--quiet', remote, project);
  } else {
    await git('init', '--bare', remote);
    await git('init', '-b', 'main', project);
  }
  await run('config', 'user.name', 'Playground');
  await run('config', 'user.email', 'playground@example.invalid');
  const ignored = base
    ? await readFile(join(project, '.gitignore'), 'utf8')
    : '';
  await cp(
    new URL('../../../../../playgrounds/review-project/', import.meta.url),
    project,
    { recursive: true },
  );
  if (ignored)
    await writeFile(
      join(project, '.gitignore'),
      `${ignored}${await readFile(join(project, '.gitignore'), 'utf8')}`,
    );
  await run('add', '.gitignore', 'README.md', 'docs');
  await run('commit', '-m', 'Plan Fieldnotes launch workspace');
  await run('add', 'data', 'src/task-store.mjs', 'tests');
  await run('commit', '-m', 'Model launch tasks and completion summaries');
  await run('add', 'server.mjs');
  await run('commit', '-m', 'Serve task data through a local JSON endpoint');
  await run('add', 'app.html', 'src');
  await run('commit', '-m', 'Build responsive launch board');
  if (!base) await run('remote', 'add', 'origin', remote);
  await run('push', '-u', 'origin', 'main');
  await run(...checkout, 'worktree', 'add', '-b', 'review', worktree);
  const review = (...args: string[]) => git('-C', worktree, ...args);
  await review('push', '-u', 'origin', 'review');
  await writeFile(
    join(worktree, 'docs/review-guide.md'),
    '# Review guide\n\nCheck the board at narrow widths and verify task counts.\n',
  );
  await review('add', 'docs/review-guide.md');
  await review('commit', '-m', 'Document launch board review workflow');
  // Main advances independently so history and branch comparisons have real divergence.
  await writeFile(
    join(project, 'docs/release-notes.md'),
    '# Release notes\n\nFieldnotes launch board is ready for internal review.\n',
  );
  await run('add', 'docs/release-notes.md');
  await run('commit', '-m', 'Prepare internal release notes');
  await run('push');
  await seedPlaygroundChanges(worktree, review);
}
