import { describe, expect, it } from 'vitest';
import {
  disabledFilterConfig,
  filterDrivers,
  parseConfigList,
  parseFilterAttributes,
} from './conversion-filters.ts';

const config = [
  'core.bare\nfalse',
  'filter.lfs.clean\ngit-lfs clean -- %f',
  'filter.lfs.smudge\ngit-lfs smudge -- %f',
  'filter.lfs.required\ntrue',
  'filter.empty.clean\n',
  'filter.My.Driver.process\nrun',
  'remote.origin.mirror',
  '',
].join('\0');

describe('parseConfigList', () => {
  it('splits each key from its value and keeps a bare key as empty', () => {
    expect(parseConfigList(config).slice(0, 2)).toEqual([
      { key: 'core.bare', value: 'false' },
      { key: 'filter.lfs.clean', value: 'git-lfs clean -- %f' },
    ]);
    expect(parseConfigList(config).at(-1)).toEqual({
      key: 'remote.origin.mirror',
      value: '',
    });
  });
});

describe('filterDrivers', () => {
  it('names each driver that runs a command, once, by its first key', () => {
    expect([...filterDrivers(config)]).toEqual([
      ['lfs', 'filter.lfs.clean'],
      ['My.Driver', 'filter.My.Driver.process'],
    ]);
  });

  it('finds no driver in a checkout without filters', () => {
    expect(filterDrivers('core.bare\nfalse\0').size).toBe(0);
  });
});

describe('parseFilterAttributes', () => {
  it('reads the filter attribute Git reports for each path', () => {
    expect(
      parseFilterAttributes(
        'model.bin\0filter\0lfs\0README.md\0filter\0unspecified\0',
      ),
    ).toEqual([
      { path: 'model.bin', filter: 'lfs' },
      { path: 'README.md', filter: 'unspecified' },
    ]);
  });

  it('ignores a truncated trailing record', () => {
    expect(parseFilterAttributes('model.bin\0filter\0')).toEqual([]);
  });
});

describe('disabledFilterConfig', () => {
  it('blanks every operation of every driver once', () => {
    expect(disabledFilterConfig(['lfs', 'lfs'])).toEqual([
      'filter.lfs.clean=',
      'filter.lfs.smudge=',
      'filter.lfs.process=',
    ]);
  });
});
