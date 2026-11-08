import type { Session } from '@porcelain/server/kit/session';
import { execFileSync } from 'node:child_process';

export async function paginatedTimelineFixture(session: Session) {
  await session.writeFile('notes.txt', 'Oldest\n');
  await session.git('add', '--all');
  await session.git('commit', '--message', 'Timeline oldest');
  const oldest = (await session.git('rev-parse', 'HEAD')).trim();
  const input = Array.from({ length: 101 }, (_, offset) => {
    const index = offset + 1;
    const message = `Timeline note ${index}\n`;
    const text = `Note ${index}\n`;
    return [
      `commit refs/heads/${session.fixture.branch}`,
      `mark :${index}`,
      'committer Porcelain Verification <verify@example.invalid> 1767225600 +0000',
      `data ${Buffer.byteLength(message)}`,
      message,
      `from ${offset === 0 ? oldest : `:${offset}`}`,
      'M 100644 inline notes.txt',
      `data ${Buffer.byteLength(text)}`,
      text,
      '',
    ].join('\n');
  }).join('\n');
  execFileSync('git', ['fast-import', '--quiet'], {
    cwd: session.repository,
    input: `${input}\ndone\n`,
  });
  await session.git('reset', '--hard', 'HEAD');
  return '';
}
