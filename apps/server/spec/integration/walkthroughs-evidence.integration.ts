import { DatabaseSync } from 'node:sqlite';
import { expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '../kit/server-test.ts';
import { scriptedWalkthroughs } from '../kit/walkthrough-fixture.ts';
import { record, text } from '../kit/session.ts';
test('writes without evidence at another PR commit and attaches checks after push and Update', async ({
  session,
  server,
}) => {
  await session.git(
    'remote',
    'add',
    'origin',
    'https://github.com/fixture/project.git',
  );
  await session.git('branch', 'evidence-base');
  await session.writeFile('notes.md', 'Explain the local change.\n');
  await session.git('add', 'notes.md');
  await session.git('commit', '-m', 'Add local change');
  const writer = await scriptedWalkthroughs(session, server.manifestPath, {
    answer: 'Answer',
    costUsd: 0,
    failurePath: join(session.projectHome, 'failure'),
    postsPath: join(session.projectHome, 'posts'),
  });
  const manifest = record(
    JSON.parse(readFileSync(server.manifestPath, 'utf8')),
  );
  const gh = join(text(manifest.bin), 'gh');
  const matching = readFileSync(gh, 'utf8').replace(
    'commits:{nodes:[]}',
    "commits:{nodes:[{commit:{statusCheckRollup:{state:'SUCCESS',contexts:{nodes:[],pageInfo:{hasNextPage:false}}}}}]}",
  );
  writeFileSync(
    gh,
    matching.replace('headRefOid:head', "headRefOid:'another-commit'"),
  );
  const content = {
    outcome: 'worth_knowing' as const,
    title: 'Local change',
    summary: 'Explain local work.',
    checks: 'SUCCESS: ',
    growth: [],
    stops: [],
    onlyInTranscript: [],
    stillUnclear: [],
  };
  const input = { base: 'refs/heads/evidence-base', pullRequestNumber: 423 };
  const behind = await writer.write(content, input);
  expect(behind.state.status).toBe('ready');
  expect(behind).toMatchObject({
    evidenceUnavailable: 'head_mismatch',
    pullRequestNumber: 423,
    pullRequestRepository: { owner: 'fixture', repo: 'project' },
  });
  expect(
    behind.state.status === 'ready' && behind.state.content.checks,
  ).toBeUndefined();
  const database = new DatabaseSync(
    join(session.dataDirectory, 'inventory.sqlite'),
  );
  try {
    expect(
      database
        .prepare(
          'SELECT count(*) AS count FROM walkthrough_evidence WHERE run_id = ?',
        )
        .get(behind.id),
    ).toEqual({ count: 0 });
  } finally {
    database.close();
  }
  writeFileSync(gh, matching);
  const updated = await writer.write(content, input);
  expect(updated.id).not.toBe(behind.id);
  expect(updated.evidenceUnavailable).toBeUndefined();
  expect(updated.state.status === 'ready' && updated.state.content.checks).toBe(
    'SUCCESS: ',
  );
  for (const [reason, script] of [
    [
      'github_unavailable',
      `#!${process.execPath}\nconsole.error('GitHub unavailable');process.exit(1);`,
    ],
    ['github_account', `#!${process.execPath}\nconsole.log('[]');`],
  ] as const) {
    await session.writeFile('notes.md', `Explain ${reason}.\n`);
    writeFileSync(gh, script);
    const unavailable = await writer.write(content, input);
    expect(unavailable.evidenceUnavailable).toBe(reason);
    expect(unavailable.state.status).toBe('ready');
    expect(
      unavailable.state.status === 'ready' && unavailable.state.content.checks,
    ).toBeUndefined();
  }
});
