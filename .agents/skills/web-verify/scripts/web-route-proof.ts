import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webRouteFixtures } from './web-route-fixtures.ts';
import { calledRoutes, webCalls } from './web-routes.ts';

export function verifyWebRouteDiscovery(): void {
  for (const fixture of webRouteFixtures) {
    const root = mkdtempSync(join(tmpdir(), 'porcelain-web-route-proof-'));
    try {
      for (const [file, source] of Object.entries(fixture.files)) {
        const target = join(root, file);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, source);
      }
      const result = webCalls(root);
      const called = [
        ...new Set(result.calls.map((call) => `${call.method} ${call.path}`)),
      ].toSorted();
      if (
        JSON.stringify(called) !== JSON.stringify(fixture.called.toSorted()) ||
        result.problems.length > 0
      )
        throw new Error(
          `route discovery: ${fixture.name}: expected ${fixture.called.join(', ')}; found ${called.join(', ')}${result.problems.length === 0 ? '' : `; ${result.problems.join('; ')}`}`,
        );
      if (fixture.registered !== undefined) {
        const matched = calledRoutes(result.calls, fixture.registered);
        if (
          matched.problems.length !== 1 ||
          !matched.problems[0]?.endsWith(fixture.problem ?? '')
        )
          throw new Error(
            `route discovery: ${fixture.name}: the unregistered shared call was not rejected`,
          );
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyWebRouteDiscovery();
  process.stdout.write('PASS runtime client route discovery fixtures\n');
}
