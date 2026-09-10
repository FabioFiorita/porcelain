import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function seedPlaygroundChanges(
  worktree: string,
  review: (...args: string[]) => Promise<unknown>,
) {
  // A saved experiment is available to inspect and apply through Git actions.
  await writeFile(
    join(worktree, 'src/filters.mjs'),
    "export const activeTasks = (tasks) => tasks.filter((task) => task.status !== 'done');\n",
  );
  await review(
    'stash',
    'push',
    '--include-untracked',
    '-m',
    'Experiment with active task filtering',
  );
  const readme = await readFile(join(worktree, 'README.md'), 'utf8');
  await writeFile(
    join(worktree, 'README.md'),
    `${readme}\nReview focus: release readiness.\n`,
  );
  await review('mv', 'docs/launch-checklist.md', 'docs/release-checklist.md');
  await writeFile(
    join(worktree, 'docs/accessibility.md'),
    '# Accessibility review\n\n- Check keyboard navigation\n- Verify status announcements\n',
  );
  await review('add', 'README.md', 'docs/accessibility.md');
  await writeFile(
    join(worktree, 'README.md'),
    `${readme}\nReview focus: release readiness.\nPending: complete the accessibility walkthrough.\n`,
  );
  await writeFile(
    join(worktree, 'src/styles.css'),
    `${await readFile(join(worktree, 'src/styles.css'), 'utf8')}\narticle { border: 1px solid #d6ded7; }\n`,
  );
  await rm(join(worktree, 'docs/legacy-plan.md'));
  await writeFile(
    join(worktree, 'notes.txt'),
    'Review notes\n\nVerify empty boards and task summaries before release.\n',
  );
  await mkdir(join(worktree, 'assets'));
  await writeFile(
    join(worktree, 'assets/board-preview.png'),
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    ),
  );
  await mkdir(join(worktree, '.cache'));
  await writeFile(
    join(worktree, '.cache/local.txt'),
    'Ignored preview cache stays outside the stash.\n',
  );
}
