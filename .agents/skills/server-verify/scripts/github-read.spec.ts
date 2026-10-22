import { describe, expect, it } from 'vitest';
import { githubReadArguments, permittedGitHubRead } from './github-read.ts';

const input = githubReadArguments([
  'example/project',
  '27',
  'reader',
  'other-reader',
]);

describe('GitHub live read arguments', () => {
  it('uses the supplied repository, PR and accounts', () => {
    expect(input).toEqual({
      repository: 'example/project',
      owner: 'example',
      repo: 'project',
      number: 27,
      accounts: ['reader', 'other-reader'],
    });
  });
  it.each([
    ['no inputs', []],
    ['empty inputs', ['', '', '']],
    ['missing PR', ['example/project']],
    ['missing account', ['example/project', '27']],
    ['repository URL', ['https://github.com/example/project', '27', 'reader']],
    ['missing owner', ['/project', '27', 'reader']],
    ['extra segment', ['example/project/extra', '27', 'reader']],
    ['zero PR', ['example/project', '0', 'reader']],
    ['negative PR', ['example/project', '-1', 'reader']],
    ['fractional PR', ['example/project', '1.5', 'reader']],
    ['unsafe PR', ['example/project', '9007199254740992', 'reader']],
    ['invalid account', ['example/project', '27', '--user']],
    ['empty second account', ['example/project', '27', 'reader', '']],
  ])('rejects %s before attaching an instance', (_name, args) => {
    expect(() => githubReadArguments(args)).toThrow('Usage: github-read');
  });
});

const query = [
  'api',
  '--hostname',
  'github.com',
  'graphql',
  '--method',
  'POST',
  '-f',
  'query=query PullRequestRead($owner:String!) { repository(owner:$owner) { name } }',
  '-f',
  'owner=example',
  '-f',
  'repo=project',
  '-F',
  'number=27',
];
it.each([
  [
    'account inventory',
    [
      'auth',
      'status',
      '--hostname',
      'github.com',
      '--json',
      'hosts',
      '--jq',
      '[.hosts["github.com"][]?.login]',
    ],
    true,
  ],
  [
    'selected account token',
    ['auth', 'token', '--hostname', 'github.com', '--user', 'other-reader'],
    true,
  ],
  [
    'unselected account token',
    ['auth', 'token', '--hostname', 'github.com', '--user', 'stranger'],
    false,
  ],
  [
    'repository read',
    [
      'api',
      '--hostname',
      'github.com',
      'repos/example/project',
      '--method',
      'GET',
    ],
    true,
  ],
  [
    'repository write',
    [
      'api',
      '--hostname',
      'github.com',
      'repos/example/project',
      '--method',
      'DELETE',
    ],
    false,
  ],
  [
    'another repository',
    [
      'api',
      '--hostname',
      'github.com',
      'repos/example/other',
      '--method',
      'GET',
    ],
    false,
  ],
  ['PR read', query, true],
  ['wrong PR', [...query.slice(0, -1), 'number=28'], false],
  [
    'list read',
    [
      ...query.slice(0, 7),
      'query=query PullRequestList($owner:String!) { repository(owner:$owner) { name } }',
      ...query.slice(8, 12),
    ],
    true,
  ],
  [
    'mutation',
    [
      ...query.slice(0, 7),
      'query=mutation Delete { deleteRepository }',
      ...query.slice(8),
    ],
    false,
  ],
  ['missing command', [], false],
  ['extra options', [...query, '--paginate'], false],
])('permits only the requested live reads: %s', (_name, args, expected) => {
  expect(permittedGitHubRead(args, input)).toBe(expected);
});
