import { describe, expect, it } from 'vitest';
import { fixture } from '../../../spec/fixtures/fixture.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';
import { parseFileCommits } from './parse-file-commits.ts';

const timeline = fixture('log/file-timeline.txt');

describe('parseFileCommits', () => {
  it('reads each commit that touched the file with the path it had there, newest first', () => {
    expect(
      parseFileCommits(timeline, gitLimits).map((entry) => ({
        subject: entry.commit.subject,
        path: entry.path,
        previousPath: entry.previousPath,
        status: entry.status,
      })),
    ).toEqual([
      {
        subject: 'extend docs',
        path: 'docs name.txt',
        previousPath: null,
        status: 'modified',
      },
      {
        subject: 'rename notes',
        path: 'docs name.txt',
        previousPath: 'notes.txt',
        status: 'renamed',
      },
      {
        subject: 'extend notes',
        path: 'notes.txt',
        previousPath: null,
        status: 'modified',
      },
      {
        subject: 'add notes',
        path: 'notes.txt',
        previousPath: null,
        status: 'added',
      },
    ]);
  });

  it('keeps the whole commit summary of each entry', () => {
    const [newest, , extended] = parseFileCommits(timeline, gitLimits);
    expect(newest?.commit).toEqual({
      oid: '09e1f2867a2b75c13619abd29fdfe4dc730d133e',
      parentOids: ['72f1cdb4e30dbb6fc6b44b7602e442196ba5be02'],
      author: { name: 'T', timestamp: '2026-09-23T19:00:17-03:00' },
      subject: 'extend docs',
      subjectTruncated: false,
      body: null,
      bodyTruncated: false,
      refs: ['main'],
    });
    expect(extended?.commit.body).toBe('Body line');
  });

  it('reads no commits from empty output', () => {
    expect(parseFileCommits(Buffer.alloc(0), gitLimits)).toEqual([]);
  });

  it('refuses output cut inside a commit', () => {
    expect(() =>
      parseFileCommits(fixture('log/file-timeline-truncated.txt'), gitLimits),
    ).toThrow('History contains unsupported data');
  });
});
