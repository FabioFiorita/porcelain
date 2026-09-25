import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { webPolicyFindings } from '../architecture/web-policy.ts';

const root = 'apps/web/src';

function filesUnder(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory()
      ? filesUnder(path)
      : entry.isFile()
        ? [path]
        : [];
  });
}

const findings = [
  ...filesUnder(root),
  ...filesUnder('apps/web/spec/browser'),
].flatMap((file) => webPolicyFindings(file, readFileSync(file, 'utf8')));
for (const { rule, file, line, message } of findings)
  process.stderr.write(`${file}:${line} ${rule}: ${message}\n`);
process.stdout.write(`Web architecture: ${findings.length} finding(s)\n`);
if (findings.length > 0) process.exitCode = 1;
