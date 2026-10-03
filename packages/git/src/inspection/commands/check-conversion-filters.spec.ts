import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sessionConversionFilters } from './check-conversion-filters.ts';
import { gitLimits } from '../../../spec/fixtures/git-limits.ts';

let checkout: string;

const git = (...args: string[]) =>
  execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();

const write = (path: string, content: string) =>
  writeFileSync(join(checkout, path), content);

const session = (): Parameters<typeof sessionConversionFilters>[0] => ({
  path: checkout,
  verify: () => Promise.resolve(),
  confirm: () => Promise.resolve(),
  conversionFilters: (read) => read(),
});

const withoutAttributeListing = {
  ...gitLimits,
  inspection: { ...gitLimits.inspection, filterAttributesBytes: 1 },
};

const refused = { name: 'UnsupportedGitFiltersError' };

const machineEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
);

const driversAroundTheCheckout = () => {
  let names = '';
  try {
    names = execFileSync(
      'git',
      [
        '-C',
        checkout,
        'config',
        '--null',
        '--name-only',
        '--get-regexp',
        '^filter[.]',
      ],
      { encoding: 'utf8', env: machineEnvironment },
    );
  } catch {
    names = '';
  }
  const drivers = new Set(
    names
      .split('\0')
      .filter(Boolean)
      .map((name) => name.split('.').slice(1, -1).join('.')),
  );
  return [...drivers].flatMap((driver) =>
    ['clean', 'smudge', 'process'].map((step) => `filter.${driver}.${step}=`),
  );
};

beforeEach(() => {
  checkout = mkdtempSync(join(tmpdir(), 'porcelain-conversion-filters-'));
  execFileSync('git', ['init', '-q', '-b', 'main', checkout]);
  mkdirSync(join(checkout, 'nested', 'deep'), { recursive: true });
  write('a.txt', 'a\n');
  write('nested/deep/b.bin', 'b\n');
  git('add', '--all');
});

afterEach(() => {
  rmSync(checkout, { recursive: true, force: true });
  rmSync(`${checkout}.attributes`, { force: true });
});

describe('sessionConversionFilters', () => {
  it('disables only the drivers the machine configures in a checkout without filters', async () => {
    expect(await sessionConversionFilters(session(), gitLimits)).toEqual(
      driversAroundTheCheckout(),
    );
  });

  it('disables every configured driver when no attribute gives the filter a value', async () => {
    git('config', 'filter.lfs.clean', 'git-lfs clean -- %f');
    write('.gitattributes', '*.txt filter\n*.bin -filter\n');
    expect(await sessionConversionFilters(session(), gitLimits)).toEqual([
      'filter.lfs.clean=',
      'filter.lfs.smudge=',
      'filter.lfs.process=',
    ]);
  });

  it("decides without reading every tracked path's attributes when none gives the filter a value", async () => {
    write('.gitattributes', '*.txt text\n*.bin !filter\n');
    expect(
      await sessionConversionFilters(session(), withoutAttributeListing),
    ).toEqual(driversAroundTheCheckout());
  });

  it.each([
    {
      source: 'the top-level attributes file',
      place: () => write('.gitattributes', '*.bin filter=lfs\n'),
    },
    {
      source: 'an untracked nested attributes file',
      place: () => write('nested/deep/.gitattributes', '*.bin filter=lfs\n'),
    },
    {
      source: 'an ignored nested attributes file',
      place: () => {
        write('.gitignore', '.gitattributes\n');
        write('nested/.gitattributes', '** filter=lfs\n');
      },
    },
    {
      source: 'a staged attributes file missing from the working tree',
      place: () => {
        write('nested/.gitattributes', '** filter=lfs\n');
        git('add', 'nested/.gitattributes');
        rmSync(join(checkout, 'nested', '.gitattributes'));
      },
    },
    {
      source: "the repository's info/attributes",
      place: () =>
        writeFileSync(
          join(checkout, '.git', 'info', 'attributes'),
          'a.txt filter=lfs\n',
        ),
    },
    {
      source: 'the attributes file core.attributesFile names',
      place: () => {
        writeFileSync(`${checkout}.attributes`, 'a.txt filter=lfs\n');
        git('config', 'core.attributesFile', `${checkout}.attributes`);
      },
    },
    {
      source: 'a macro attribute',
      place: () =>
        write('.gitattributes', '[attr]tool filter=lfs\n*.txt tool\n'),
    },
  ])(
    'refuses a checkout whose filter is assigned by $source',
    async ({ place }) => {
      place();
      await expect(
        sessionConversionFilters(session(), gitLimits),
      ).rejects.toMatchObject(refused);
    },
  );

  it('refuses a filter assigned even when no driver is configured for it', async () => {
    write('.gitattributes', 'a.txt filter=secret\n');
    await expect(
      sessionConversionFilters(session(), gitLimits),
    ).rejects.toMatchObject(refused);
  });

  it('refuses a configured driver whose name Git reports like an attribute state', async () => {
    git('config', 'filter.set.clean', 'cat');
    write('.gitattributes', '*.txt filter\n');
    await expect(
      sessionConversionFilters(session(), gitLimits),
    ).rejects.toMatchObject(refused);
  });
});
