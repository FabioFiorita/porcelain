import { execFileSync, spawnSync } from 'node:child_process';
import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isMap, isSeq, parseDocument } from 'yaml';

const workflow = parseDocument(
  readFileSync('.github/workflows/ci.yml', 'utf8'),
);
const steps = workflow.getIn(['jobs', 'desktop-e2e', 'steps']);
if (!isSeq(steps)) throw new Error('The desktop job needs steps');
const stepEntries = steps.items;

function step(name: string) {
  const found = stepEntries.find(
    (entry) => isMap(entry) && entry.get('name') === name,
  );
  if (!isMap(found)) throw new Error(`Missing desktop step: ${name}`);
  return found;
}

type Report = {
  name: string;
  time?: 'old' | 'same';
  kind?: 'directory' | 'symlink' | 'hardlink';
};
type Selection = {
  name: string;
  reports?: Report[];
  missingReports?: boolean;
  missingStart?: boolean;
  expected: string[];
};

describe('desktop crash evidence', () => {
  it.each<Selection>([
    { name: 'no crash report', expected: [] },
    { name: 'a missing report directory', missingReports: true, expected: [] },
    {
      name: 'our Electron process',
      reports: [{ name: 'Electron_2026-10-21-120000.ips' }],
      expected: ['Electron_2026-10-21-120000.ips'],
    },
    {
      name: 'our Porcelain Dev process with spaces',
      reports: [{ name: 'Porcelain Dev_2026-10-21-120000.crash' }],
      expected: ['Porcelain Dev_2026-10-21-120000.crash'],
    },
    ...[
      'Electron-2026-10-21-120000.ips',
      'Porcelain Dev-2026-10-21-120000.ips',
      'Electron Helper (Renderer)-2026-10-21-120000.ips',
      'Porcelain Dev Helper (GPU)-2026-10-21-120000.ips',
      'Electron_2026-10-21-120000_runner.crash',
      'Porcelain Dev Helper (Renderer)_2026-10-21-120000_Mac-1.crash',
      'Electron Helper_2026-10-21-120000.crash',
      'Electron Helper (Renderer)_2026-10-21-120000.ips',
      'Electron Helper (GPU)_2026-10-21-120000.ips',
      'Electron Helper (Plugin)_2026-10-21-120000.ips',
      'Porcelain Dev Helper_2026-10-21-120000.ips',
      'Porcelain Dev Helper (Renderer)_2026-10-21-120000.crash',
      'Porcelain Dev Helper (GPU)_2026-10-21-120000.ips',
      'Porcelain Dev Helper (Plugin)-2026-10-21-120000.ips',
    ].map((name) => ({ name, reports: [{ name }], expected: [name] })),
    {
      name: 'underscore process names',
      reports: [
        { name: 'Electron_Notes-2026-10-21-120000.ips' },
        { name: 'Porcelain Dev_Backup-2026-10-21-120000.ips' },
      ],
      expected: [],
    },
    ...[
      'Electron Helper (odd\nname)-2026-10-21-120000.ips',
      'Electron Helper ([*?])-2026-10-21-120000.ips',
      'Porcelain Dev Helper (odd\rname)_2026-10-21-120000.ips',
      'Porcelain Dev Helper (host:port)_2026-10-21-120000.ips',
      'Electron_odd\nname.ips',
      'Electron_[*?].ips',
      'Electron_2026-10-21-120000_*.ips',
      'Electron_2026-10-21-120000_?.ips',
      'Electron_2026-10-21-120000_[host].ips',
      'Electron_2026-10-21-120000_host].ips',
      'Electron_2026-10-21-120000_odd\nname.ips',
      'Electron_2026-10-21-120000_odd\rname.ips',
      'Electron_2026-10-21-120000_[*?].ips',
      'Electron_2026-10-21-120000_host:port.ips',
      'Electron_2026-10-21-120000_"host".ips',
      'Electron_2026-10-21-120000_<host>.ips',
      'Electron_2026-10-21-120000_host|other.ips',
    ].map((name) => ({
      name: `an unsafe upload filename ${JSON.stringify(name)}`,
      reports: [{ name }],
      expected: [],
    })),
    {
      name: 'ambiguous filenames without a full timestamp',
      reports: [
        { name: 'Electron_NoTimestamp.ips' },
        { name: 'Electron_2026-10-21.ips' },
        { name: 'Porcelain Dev_2026-10-21-120000_extra-2026-10-21-120000.ips' },
      ],
      expected: [],
    },
    {
      name: 'unrelated processes and prefix collisions',
      reports: [
        { name: 'Safari_2026-10-21-120000.ips' },
        { name: 'ElectronOther_2026-10-21-120000.ips' },
        { name: 'ElectronOther-2026-10-21-120000.ips' },
        { name: 'Porcelain Dev Other-2026-10-21-120000.ips' },
        { name: 'Porcelain_2026-10-21-120000.ips' },
        { name: 'Porcelain Dev Other_2026-10-21-120000.crash' },
        { name: 'Other Electron_2026-10-21-120000.ips' },
        { name: 'Electron Helper (Unknown)-2026-10-21-120000.ips' },
        { name: 'Porcelain Dev Helper (Unknown)_2026-10-21-120000.ips' },
      ],
      expected: [],
    },
    {
      name: 'a report older than the job',
      reports: [{ name: 'Electron_2026-10-21-120000.ips', time: 'old' }],
      expected: [],
    },
    {
      name: 'a report at the job timestamp',
      reports: [{ name: 'Electron_2026-10-21-120000.ips', time: 'same' }],
      expected: [],
    },
    {
      name: 'a missing job timestamp fails closed',
      missingStart: true,
      reports: [{ name: 'Electron_2026-10-21-120000.ips' }],
      expected: [],
    },
    {
      name: 'directories, nested reports and symlinks',
      reports: [
        { name: 'Electron_2026-10-21-120000.ips', kind: 'directory' },
        {
          name: 'Electron_2026-10-21-120000.ips/Porcelain Dev_2026-10-21-120000.ips',
        },
        { name: 'Porcelain Dev_2026-10-21-120000.ips', kind: 'symlink' },
      ],
      expected: [],
    },
    {
      name: 'hard links to outside contents',
      reports: [{ name: 'Electron_2026-10-21-120000.ips', kind: 'hardlink' }],
      expected: [],
    },
    {
      name: 'unrecognized extensions',
      reports: [
        { name: 'Electron_2026-10-21-120000.txt' },
        { name: 'Porcelain Dev_2026-10-21-120000.ips.backup' },
      ],
      expected: [],
    },
    {
      name: 'mixed matching, unrelated and stale reports',
      reports: [
        { name: 'Electron_2026-10-21-120000.ips' },
        { name: 'Safari_2026-10-21-120000.ips' },
        { name: 'Porcelain Dev_2026-10-21-120000.crash', time: 'old' },
        { name: 'Porcelain Dev Helper (Renderer)_2026-10-21-120000.ips' },
      ],
      expected: [
        'Electron_2026-10-21-120000.ips',
        'Porcelain Dev Helper (Renderer)_2026-10-21-120000.ips',
      ],
    },
  ])('selects $name', ({ reports, missingReports, missingStart, expected }) => {
    const folder = mkdtempSync(join(tmpdir(), 'desktop-artifacts-'));
    try {
      const source = join(folder, 'Diagnostic Reports');
      const marker = join(folder, 'started');
      const destination = join(folder, 'collected crashes');
      if (!missingReports) mkdirSync(source);
      if (!missingStart) {
        writeFileSync(marker, '');
        utimesSync(marker, 100, 100);
      }
      for (const report of reports ?? []) {
        const path = join(source, report.name);
        if (report.kind === 'directory') mkdirSync(path);
        else if (report.kind === 'symlink') {
          const target = join(folder, 'unrelated.ips');
          writeFileSync(target, 'Unrelated crash');
          symlinkSync(target, path);
        } else if (report.kind === 'hardlink') {
          const target = join(folder, 'outside.ips');
          writeFileSync(target, 'Outside contents');
          linkSync(target, path);
        } else writeFileSync(path, 'Owned crash');
        if (report.kind !== 'symlink') {
          const time =
            report.time === 'old' ? 99 : report.time === 'same' ? 100 : 101;
          utimesSync(path, time, time);
        }
      }
      execFileSync('bash', [
        'scripts/collect-desktop-crashes.sh',
        source,
        marker,
        destination,
      ]);
      expect(readdirSync(destination).sort()).toEqual(expected);
      expect(
        readdirSync(destination)
          .sort()
          .map((name) => ({
            name,
            content: readFileSync(join(destination, name), 'utf8'),
          })),
      ).toEqual(expected.map((name) => ({ name, content: 'Owned crash' })));
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});

it.each(['destination is a file', 'copy target is a directory'])(
  'surfaces a filesystem failure when %s',
  (state) => {
    const folder = mkdtempSync(join(tmpdir(), 'desktop-artifact-error-'));
    try {
      const source = join(folder, 'reports');
      const started = join(folder, 'started');
      const destination = join(folder, 'collected');
      mkdirSync(source);
      writeFileSync(started, '');
      utimesSync(started, 100, 100);
      writeFileSync(
        join(source, 'Electron_2026-10-21-120000.ips'),
        'Owned crash',
      );
      if (state === 'destination is a file') writeFileSync(destination, '');
      else
        mkdirSync(join(destination, 'Electron_2026-10-21-120000.ips'), {
          recursive: true,
        });
      const result = spawnSync('bash', [
        'scripts/collect-desktop-crashes.sh',
        source,
        started,
        destination,
      ]);
      expect(result.status).toBe(1);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  },
);

it('records the timestamp before checkout and scopes uploads without extra permissions', () => {
  expect(stepEntries[0]).toEqual(step('Record desktop job start'));
  expect(step('Record desktop job start').get('run')).toBe(
    'touch "$RUNNER_TEMP/desktop-e2e-started"',
  );
  expect(step('Collect desktop crash reports').get('run')).toBe(
    'bash scripts/collect-desktop-crashes.sh \\\n  "$HOME/Library/Logs/DiagnosticReports" \\\n  "$RUNNER_TEMP/desktop-e2e-started" \\\n  "$RUNNER_TEMP/desktop-e2e-crashes"\n',
  );
  expect(workflow.getIn(['permissions', 'contents'])).toBe('read');
  expect(
    workflow.getIn(['jobs', 'desktop-e2e', 'permissions']),
  ).toBeUndefined();
});

it('uploads test evidence before collecting and separately uploading crashes', () => {
  const tests = step('Upload desktop test results');
  const crashes = step('Upload desktop crash reports');
  const collection = step('Collect desktop crash reports');
  expect(tests.get('if')).toBe('failure()');
  expect(collection.get('if')).toBe('failure()');
  expect(crashes.get('if')).toBe('failure()');
  expect(tests.getIn(['with', 'path'])).toBe('apps/desktop/test-results/');
  expect(crashes.getIn(['with', 'path'])).toBe(
    '${{ runner.temp }}/desktop-e2e-crashes/',
  );
  expect(tests.getIn(['with', 'name'])).toBe('desktop-e2e');
  expect(crashes.getIn(['with', 'name'])).toBe('desktop-e2e-crashes');
  expect(crashes.get('uses')).toBe(tests.get('uses'));
  expect(stepEntries.indexOf(tests)).toBeLessThan(
    stepEntries.indexOf(collection),
  );
  expect(stepEntries.indexOf(collection)).toBeLessThan(
    stepEntries.indexOf(crashes),
  );
});
