import { execFileSync, spawnSync } from 'node:child_process';
import {
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
  kind?: 'directory' | 'symlink';
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
      reports: [{ name: 'Electron_2026-10-21.ips' }],
      expected: ['Electron_2026-10-21.ips'],
    },
    {
      name: 'our Porcelain Dev process with spaces',
      reports: [{ name: 'Porcelain Dev_2026-10-21 120000.crash' }],
      expected: ['Porcelain Dev_2026-10-21 120000.crash'],
    },
    ...[
      'Electron-2026-10-21-120000.ips',
      'Porcelain Dev-2026-10-21-120000.ips',
      'Electron Helper (Renderer)-2026-10-21-120000.ips',
      'Porcelain Dev Helper (GPU)-2026-10-21-120000.ips',
      'Electron Helper_2026-10-21.crash',
      'Electron Helper (Renderer)_2026-10-21.ips',
      'Electron Helper (GPU)_2026-10-21.ips',
      'Porcelain Dev Helper_2026-10-21.ips',
      'Porcelain Dev Helper (Renderer)_2026-10-21.crash',
      'Porcelain Dev Helper (GPU)_2026-10-21.ips',
    ].map((name) => ({ name, reports: [{ name }], expected: [name] })),
    {
      name: 'unrelated processes and prefix collisions',
      reports: [
        { name: 'Safari_2026-10-21.ips' },
        { name: 'ElectronOther_2026-10-21.ips' },
        { name: 'ElectronOther-2026-10-21-120000.ips' },
        { name: 'Porcelain Dev Other-2026-10-21-120000.ips' },
        { name: 'Porcelain_2026-10-21.ips' },
        { name: 'Porcelain Dev Other_2026-10-21.crash' },
        { name: 'Other Electron_2026-10-21.ips' },
      ],
      expected: [],
    },
    {
      name: 'a report older than the job',
      reports: [{ name: 'Electron_2026-10-21.ips', time: 'old' }],
      expected: [],
    },
    {
      name: 'a report at the job timestamp',
      reports: [{ name: 'Electron_2026-10-21.ips', time: 'same' }],
      expected: [],
    },
    {
      name: 'a missing job timestamp fails closed',
      missingStart: true,
      reports: [{ name: 'Electron_2026-10-21.ips' }],
      expected: [],
    },
    {
      name: 'directories, nested reports and symlinks',
      reports: [
        { name: 'Electron_2026-10-21.ips', kind: 'directory' },
        { name: 'Electron_2026-10-21.ips/Porcelain Dev_2026-10-21.ips' },
        { name: 'Porcelain Dev_2026-10-21.ips', kind: 'symlink' },
      ],
      expected: [],
    },
    {
      name: 'unrecognized extensions',
      reports: [
        { name: 'Electron_2026-10-21.txt' },
        { name: 'Porcelain Dev_2026-10-21.ips.backup' },
      ],
      expected: [],
    },
    {
      name: 'mixed reports with no test-results directory',
      reports: [
        { name: 'Electron_2026-10-21.ips' },
        { name: 'Safari_2026-10-21.ips' },
        { name: 'Porcelain Dev_2026-10-21.crash', time: 'old' },
        { name: 'Porcelain Dev Helper (Renderer)_2026-10-21.ips' },
      ],
      expected: [
        'Electron_2026-10-21.ips',
        'Porcelain Dev Helper (Renderer)_2026-10-21.ips',
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
      writeFileSync(join(source, 'Electron_2026-10-21.ips'), 'Owned crash');
      if (state === 'destination is a file') writeFileSync(destination, '');
      else
        mkdirSync(join(destination, 'Electron_2026-10-21.ips'), {
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

it.each(['success', 'failure'])(
  'collects and uploads only on failure when the job is %s',
  (status) => {
    const upload = stepEntries.find(
      (entry) =>
        isMap(entry) &&
        String(entry.get('uses')).startsWith('actions/upload-artifact@'),
    );
    if (!isMap(upload)) throw new Error('The desktop job needs an upload step');
    expect(step('Collect desktop crash reports').get('if')).toBe('failure()');
    expect(upload.get('if')).toBe('failure()');
    const selected = upload.get('if') === 'failure()' && status === 'failure';
    expect(selected).toBe(status === 'failure');
    expect(upload.getIn(['with', 'path'])).toBe(
      'apps/desktop/test-results/\n${{ runner.temp }}/desktop-e2e-crashes/\n',
    );
    expect(upload.getIn(['with', 'name'])).toBe('desktop-e2e');
  },
);
