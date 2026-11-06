import { describe, expect, it } from 'vitest';
import {
  pullRequestNumbers,
  releaseBody,
  whatAndWhy,
} from './release-notes-body.ts';

const generated = `## What's Changed
* Fix the watcher by @someone in https://github.com/owner/repo/pull/668
* Add handoffs by @someone in https://github.com/owner/repo/pull/669
* Mentioned again in https://github.com/owner/repo/pull/669
* Upstream change in https://github.com/owner/repository/pull/12

**Full Changelog**: https://github.com/owner/repo/compare/v1.0.0...v1.1.0`;

describe('pullRequestNumbers', () => {
  it('lists each pull request of this repository once', () => {
    expect(pullRequestNumbers('owner/repo', generated)).toEqual([668, 669]);
  });
});

describe('whatAndWhy', () => {
  it('reads only what and why from a pull request written from the template', () => {
    expect(
      whatAndWhy(
        '## What and why\n\n<!-- Two or three sentences. -->\nThe watcher froze; now it restarts.\n\nSurfaces: server only, driven locally.\n\n## Verified\n\nRan the server.',
      ),
    ).toBe('The watcher froze; now it restarts.');
  });
});

describe('releaseBody', () => {
  it('orders new, improved and fixed, skips empty groups and keeps every pull request', () => {
    const body = releaseBody(
      'owner/repo',
      {
        highlight: 'Handoffs arrive.',
        sections: [
          {
            kind: 'fixed',
            items: [{ text: 'The watcher recovers.', pulls: [668] }],
          },
          {
            kind: 'new',
            items: [{ text: 'Review handoffs.', pulls: [669, 9999] }],
          },
        ],
      },
      generated,
      'gpt-6.1-terra',
    );
    expect(body.indexOf('### New')).toBeLessThan(body.indexOf('### Fixed'));
    expect(body).not.toContain('### Improved');
    expect(body).toContain(
      '- The watcher recovers. ([#668](https://github.com/owner/repo/pull/668))',
    );
    expect(body).toContain(
      '- Review handoffs. ([#669](https://github.com/owner/repo/pull/669))',
    );
    expect(body).toContain('* Add handoffs by @someone');
  });
});
