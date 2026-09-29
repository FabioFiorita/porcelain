import {
  defineCase,
  defineFeature,
  list,
  record,
  text,
  type Session,
} from '../scripts/feature.ts';
import { read, worktreePath } from '../scripts/fixture.ts';

const main = 'refs/heads/main';
const feature = 'refs/heads/feature';
const second = 'refs/heads/second';

async function fingerprints(session: Session, base?: string) {
  const body = await read(session, {
    method: 'GET',
    path: worktreePath(session, '/branch-changes'),
    ...(base === undefined ? {} : { query: { base } }),
  });
  return new Map(
    list(body.files).map((entry) => [
      text(record(entry).path),
      text(record(entry).fingerprint),
    ]),
  );
}

const featureMarks = (session: Session) =>
  read(session, {
    method: 'GET',
    path: worktreePath(session, '/reviewed'),
    query: { scope: 'branch', branch: feature },
  });

const markOf = (body: unknown, path: string) =>
  record(list(record(body).marks).find((mark) => record(mark).path === path))
    .fingerprint;

const fileOf = (body: unknown, path: string) =>
  record(list(record(body).files).find((file) => record(file).path === path))
    .fingerprint;

export default defineFeature({
  feature: 'reviews.branch-marks-over-time',
  reaches: [
    'GET /api/worktrees/:worktreeId/reviewed',
    'PUT /api/worktrees/:worktreeId/reviewed-bulk',
  ],
  paired: true,
  intent: 'intended',
  behaviour:
    "A branch mark stays current while the file's two sides stay the same: a commit that leaves a file alone keeps its mark, and comparing against another base only stales the files whose base side differs there. Marks belong to the branch they were made on, so another branch in the same worktree starts without marks and switching back finds them again.",
  cases: [
    defineCase({
      name: 'mark the files of the branch',
      async setup(session) {
        await session.git('switch', '-c', 'feature');
        await session.writeFile('notes.md', 'first\n');
        await session.git('add', 'notes.md');
        await session.git('commit', '-m', 'Add notes');
        await session.git('branch', 'checkpoint');
        await session.writeFile('notes.md', 'first\nsecond\n');
        await session.git('commit', '-am', 'Change notes and the readme');
        return fingerprints(session);
      },
      request: (session, shown) => ({
        method: 'PUT',
        path: worktreePath(session, '/reviewed-bulk'),
        body: {
          files: [...shown].map(([path, fingerprint]) => ({
            path,
            fingerprint,
          })),
          scope: 'branch',
          base: main,
        },
      }),
      expect({ response, session, check }) {
        check('status', 200, response.status);
        check(
          'both files are marked',
          [session.fixture.readme.path, 'notes.md'],
          record(response.body).marked,
        );
      },
    }),
    defineCase({
      name: 'a commit that leaves a file alone keeps its mark current',
      async setup(session) {
        await session.writeFile('other.md', 'other\n');
        await session.git('add', 'other.md');
        await session.git('commit', '-m', 'Add another file');
        return featureMarks(session);
      },
      request: (session) => ({
        method: 'GET',
        path: worktreePath(session, '/branch-changes'),
      }),
      expect({ response, state, check }) {
        check('status', 200, response.status);
        check(
          'the notes mark still matches the notes on the branch',
          markOf(state, 'notes.md'),
          fileOf(response.body, 'notes.md'),
        );
      },
    }),
    defineCase({
      name: 'another base stales only the files whose base side differs',
      setup: featureMarks,
      request: (session) => ({
        method: 'GET',
        path: worktreePath(session, '/branch-changes'),
        query: { base: 'refs/heads/checkpoint' },
      }),
      expect({ response, state, session, check, checkDiffers }) {
        check('status', 200, response.status);
        check(
          'the readme had the same base side, so its mark is current',
          markOf(state, session.fixture.readme.path),
          fileOf(response.body, session.fixture.readme.path),
        );
        checkDiffers(
          'the notes existed at the checkpoint, so their mark is stale',
          markOf(state, 'notes.md'),
          fileOf(response.body, 'notes.md'),
        );
      },
    }),
    defineCase({
      name: 'another branch starts without marks and switching back finds them',
      async setup(session) {
        await session.git('switch', '-c', 'second', 'main');
        await session.writeFile('notes.md', 'first\nsecond\n');
        await session.git('add', 'notes.md');
        await session.git('commit', '-m', 'Add the same notes');
        const shown = await fingerprints(session);
        return { notes: shown.get('notes.md') ?? '' };
      },
      request: (session, state) => [
        {
          method: 'GET',
          path: worktreePath(session, '/reviewed'),
          query: { scope: 'branch', branch: second },
        },
        {
          method: 'PUT',
          path: worktreePath(session, '/reviewed-bulk'),
          body: {
            files: [{ path: 'notes.md', fingerprint: state.notes }],
            scope: 'branch',
            base: main,
          },
        },
      ],
      async expect({ responses, session, check }) {
        check('first status', 200, responses[0]?.status);
        check(
          'the second branch has no marks yet',
          { worktreeId: session.worktreeId, marks: [] },
          responses[0]?.body,
        );
        check('mark status', 200, responses[1]?.status);
        check(
          'the second branch keeps its own mark',
          ['notes.md'],
          list(record(responses[1]?.body).marks).map(
            (mark) => record(mark).path,
          ),
        );
        await session.git('switch', 'feature');
        const back = await read(session, {
          method: 'GET',
          path: worktreePath(session, '/reviewed'),
          query: { scope: 'branch', branch: feature },
        });
        check(
          'switching back finds the feature marks',
          [session.fixture.readme.path, 'notes.md'],
          list(back.marks).map((mark) => record(mark).path),
        );
      },
    }),
  ],
});
