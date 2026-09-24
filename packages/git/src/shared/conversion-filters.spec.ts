import { describe, expect, it } from 'vitest';
import { fixture } from '../../spec/fixtures/fixture.ts';
import {
  disabledFilterConfig,
  filterDrivers,
  parseConfigList,
  parseFilterAttributes,
} from './conversion-filters.ts';

const config = fixture('config/filters.txt').toString('utf8');
const plain = fixture('config/plain.txt').toString('utf8');
const attributes = fixture('attributes/filter.txt').toString('utf8');

describe('parseConfigList', () => {
  it('splits each key from its value and keeps a bare key as empty', () => {
    expect(parseConfigList(config)).toEqual(
      expect.arrayContaining([
        { key: 'core.bare', value: 'false' },
        { key: 'filter.lfs.clean', value: 'git-lfs clean -- %f' },
        { key: 'filter.empty.clean', value: '' },
        { key: 'remote.origin.mirror', value: '' },
      ]),
    );
  });

  it('reads every record in the order Git lists them', () => {
    expect(parseConfigList(plain)).toEqual([
      { key: 'core.repositoryformatversion', value: '0' },
      { key: 'core.filemode', value: 'true' },
      { key: 'core.bare', value: 'false' },
      { key: 'core.logallrefupdates', value: 'true' },
      { key: 'core.fsmonitor', value: 'false' },
      { key: 'core.untrackedcache', value: 'false' },
      { key: 'core.quotepath', value: 'true' },
      { key: 'diff.renamelimit', value: '2000' },
    ]);
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
    expect(filterDrivers(plain).size).toBe(0);
  });
});

describe('parseFilterAttributes', () => {
  it('reads the filter attribute Git reports for each path', () => {
    expect(parseFilterAttributes(attributes)).toEqual([
      { path: '.gitattributes', filter: 'unspecified' },
      { path: 'README.md', filter: 'unspecified' },
      { path: 'model.bin', filter: 'lfs' },
    ]);
  });

  it('ignores a truncated trailing record in malformed input', () => {
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
