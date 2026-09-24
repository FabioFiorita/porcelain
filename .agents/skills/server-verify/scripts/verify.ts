import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { loadFeatures, loadNegatives, reachesOf } from './catalogue.ts';
import {
  isRecord,
  list,
  record,
  UnassertedExchanges,
  type Checks,
  type Feature,
} from './feature.ts';
import { contractSchemas } from './contracts.ts';
import { expectedWeakness, Provenance, type Claim } from './provenance.ts';
import { IsolatedServer, Recorder, type Step } from './session.ts';
import { buildIsolatedServer } from '../../../../scripts/dev-server.ts';

type Assertion = {
  name: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  sources: string[];
  weak?: string;
};
type CaseEvidence = {
  name: string;
  passed: boolean;
  error?: string;
  unasserted?: string;
  assertionCount: number;
  steps: Step[];
  assertions: Assertion[];
  serverStderr: string;
  durationMs: number;
};
type RouteCoverage = {
  registered: readonly string[];
  unreached: string[];
  unregistered: string[];
};
type FeatureResult = {
  feature: string;
  intent: Feature['intent'];
  passed: boolean;
  cases: number;
  assertions: number;
  passedAssertions: number;
  weakAssertions: number;
  failures: string[];
  rejection: string[];
  evidence: string;
  routes: readonly string[];
  durationMs: number;
  durations: { case: string; durationMs: number }[];
};

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, '../../../..');
const usage =
  'Usage: node .agents/skills/server-verify/scripts/verify.ts <feature>|--all|--list\n';

function routePattern(reach: string): RegExp {
  const escaped = reach
    .split(/(:[A-Za-z]+)/)
    .map((part) =>
      part.startsWith(':')
        ? '[^/?]+'
        : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('\\*', '.*'),
    )
    .join('');
  return new RegExp(`^${escaped}(?:\\?.*)?$`);
}

function template(route: string): string {
  return route.replace(/:[A-Za-z]+/g, ':');
}

function routeCoverage(
  registered: readonly string[],
  features: readonly Feature[],
): RouteCoverage {
  const reached = new Set(features.flatMap(reachesOf).map(template));
  const answered = new Set(registered.map(template));
  return {
    registered,
    unreached: registered.filter((route) => !reached.has(template(route))),
    unregistered: [...new Set(features.flatMap(reachesOf))].filter(
      (reach) => !answered.has(template(reach)),
    ),
  };
}

function requestedRoute(step: Step): string | undefined {
  if (step.kind === 'live') return 'GET /api/live';
  if (step.kind !== 'http' || step.phase !== 'request') return undefined;
  const target = step.target === 'owner' ? 'owner ' : '';
  return `${target}${step.request.method} ${step.request.path}`;
}

function partial(expected: unknown, actual: unknown): boolean {
  if (expected === null || typeof expected !== 'object')
    return isDeepStrictEqual(expected, actual);
  if (Array.isArray(expected))
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((entry, index) => partial(entry, actual[index]))
    );
  if (!isRecord(expected) || !isRecord(actual)) return false;
  return Object.entries(expected).every(
    ([key, value]) => key in actual && partial(value, actual[key]),
  );
}

function checks(
  assertions: Assertion[],
  provenance: () => Provenance,
  contracts: ReadonlySet<unknown>,
): Checks {
  const assert = (
    name: string,
    expected: unknown,
    actual: unknown,
    claim: Claim,
    matches: boolean,
    recorded: unknown = actual,
  ) => {
    const judged = provenance().judge(actual, claim);
    const weak =
      (claim.kind === 'exact' || claim.kind === 'partial'
        ? expectedWeakness(claim.expected, claim.kind)
        : claim.kind === 'differs'
          ? expectedWeakness(expected, claim.kind)
          : undefined) ?? judged.weak;
    if (weak === undefined) judged.count();
    assertions.push({
      name,
      passed: matches && weak === undefined,
      expected,
      actual: recorded,
      sources: judged.sources,
      ...(weak === undefined ? {} : { weak }),
    });
  };
  return {
    check(name, expected, actual) {
      assert(
        name,
        expected,
        actual,
        { kind: 'exact', expected },
        isDeepStrictEqual(actual, expected),
      );
    },
    checkPartial(name, expected, actual) {
      assert(
        name,
        expected,
        actual,
        { kind: 'partial', expected },
        partial(expected, actual),
      );
    },
    checkMatch(name, pattern, actual) {
      assert(
        name,
        String(pattern),
        actual,
        { kind: 'match' },
        typeof actual === 'string' && pattern.test(actual),
      );
    },
    checkDiffers(name, previous, actual) {
      assert(
        name,
        { differsFrom: previous },
        actual,
        { kind: 'differs', baseline: previous },
        !isDeepStrictEqual(actual, previous),
      );
    },
    checkContract(name, schema, actual) {
      const parsed = schema.safeParse(actual);
      assert(
        name,
        'satisfies the wire contract',
        actual,
        { kind: 'contract', exported: contracts.has(schema) },
        parsed.success,
        parsed.success
          ? actual
          : { value: actual, issues: parsed.error?.issues },
      );
    },
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fixtureIds(server: IsolatedServer, recorder: Recorder) {
  const inventory = await server.read(recorder, {
    method: 'GET',
    path: '/api/inventory',
  });
  const projects = list(record(inventory.body).projects).map(record);
  const project = projects[0];
  const worktree = list(project?.worktrees)
    .map(record)
    .find((entry) => entry.main === true);
  if (
    inventory.status !== 200 ||
    projects.length !== 1 ||
    typeof project?.id !== 'string' ||
    typeof worktree?.id !== 'string'
  )
    throw new Error('The fixture inventory is not one registered project');
  return { projectId: project.id, worktreeId: worktree.id };
}

async function runCases(
  feature: Feature,
  server: IsolatedServer,
  recorder: Recorder,
  contracts: ReadonlySet<unknown>,
): Promise<CaseEvidence[]> {
  const ids = await fixtureIds(server, recorder);
  const cases: CaseEvidence[] = [];
  for (const testCase of feature.cases) {
    recorder.steps = [];
    recorder.provenance = new Provenance();
    recorder.cleanups.length = 0;
    const assertions: Assertion[] = [];
    const evidence: CaseEvidence = {
      name: testCase.name,
      passed: false,
      assertionCount: 0,
      steps: recorder.steps,
      assertions,
      serverStderr: '',
      durationMs: 0,
    };
    const startedAt = performance.now();
    const stderrFrom = server.logs().stderr.length;
    cases.push(evidence);
    try {
      await testCase.run(server.session(recorder, ids), {
        enter: (phase) => {
          recorder.phase = phase;
          recorder.provenance.enter();
        },
        checks: checks(assertions, () => recorder.provenance, contracts),
        problems: () => recorder.provenance.problems(),
      });
      if (assertions.length === 0)
        throw new Error('The case made no assertion');
    } catch (error) {
      if (error instanceof UnassertedExchanges)
        evidence.unasserted = message(error);
      else evidence.error = message(error);
    } finally {
      for (const cleanup of recorder.cleanups) cleanup();
      evidence.serverStderr = server.logs().stderr.slice(stderrFrom);
      evidence.durationMs = Math.round(performance.now() - startedAt);
    }
    evidence.assertionCount = assertions.length;
    evidence.passed =
      evidence.error === undefined &&
      evidence.unasserted === undefined &&
      assertions.every((entry) => entry.passed);
  }
  return cases;
}

async function runFeature(
  feature: Feature,
  evidenceFile: string,
  build: string,
  contracts: ReadonlySet<unknown>,
): Promise<FeatureResult> {
  const startedAt = performance.now();
  const recorder = new Recorder();
  let cases: CaseEvidence[] = [];
  let setupError: string | undefined;
  let server: IsolatedServer | undefined;
  try {
    server = await IsolatedServer.start(repositoryRoot, build);
    recorder.secret(server.credential);
    cases = await runCases(feature, server, recorder, contracts);
  } catch (error) {
    setupError = message(error);
  } finally {
    const stopError = await server?.stop();
    setupError ??= stopError;
  }

  const logs = server?.logs() ?? { stdout: '', stderr: '' };
  recorder.harvest({ cases, logs });
  const requested = cases
    .flatMap((entry) => entry.steps.map(requestedRoute))
    .filter((route) => route !== undefined);
  const unreached = reachesOf(feature).filter(
    (reach) => !requested.some((route) => routePattern(reach).test(route)),
  );
  const assertions = cases.flatMap((entry) => entry.assertions);
  const failures = [
    ...(setupError ? [`setup: ${setupError}`] : []),
    ...(cases.length === 0 ? ['no case ran'] : []),
    ...unreached.map((reach) => `no case requested ${reach}`),
    ...cases.flatMap((entry) => [
      ...(entry.error ? [`${entry.name}: ${entry.error}`] : []),
      ...(entry.unasserted ? [`${entry.name}: ${entry.unasserted}`] : []),
      ...entry.assertions
        .filter((assertion) => !assertion.passed)
        .map((assertion) =>
          assertion.weak
            ? `${entry.name}: ${assertion.name} is weak: ${assertion.weak}`
            : `${entry.name}: ${assertion.name}`,
        ),
    ]),
  ].map((failure) => recorder.scrub(failure));
  let passed = failures.length === 0 && assertions.length > 0;
  const passedAssertions = assertions.filter((entry) => entry.passed).length;
  const durations = cases.map((entry) => ({
    case: entry.name,
    durationMs: entry.durationMs,
  }));
  const durationMs = Math.round(performance.now() - startedAt);
  const weakAssertions = assertions.filter((entry) => entry.weak).length;
  const rejection = [
    ...(setupError ? [`setup: ${setupError}`] : []),
    ...(cases.length === 0 ? ['no case ran'] : []),
    ...cases.flatMap((entry) => [
      ...(entry.error ? [`${entry.name}: ${entry.error}`] : []),
      ...(entry.assertions.length === 0
        ? [`${entry.name}: made no assertion`]
        : []),
      ...entry.assertions
        .filter((assertion) => assertion.weak === undefined)
        .map((assertion) => `${entry.name}: ${assertion.name} counted`),
    ]),
  ].map((failure) => recorder.scrub(failure));
  const evidence = recorder.redact({
    feature: feature.feature,
    intent: feature.intent,
    behaviour: feature.behaviour,
    reaches: reachesOf(feature),
    ...(feature.locations ? { locations: feature.locations } : {}),
    capturedAt: new Date().toISOString(),
    passed,
    failures,
    assertionCount: assertions.length,
    passedAssertions,
    weakAssertions,
    durationMs,
    durations,
    session: server
      ? { address: server.address, repository: server.repository }
      : null,
    cases,
    logs,
  });
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  const leaked = recorder.leaks(serialized) > 0;
  if (leaked) {
    passed = false;
    failures.push('evidence withheld: a secret survived redaction');
  }
  await writeFile(
    evidenceFile,
    leaked
      ? `${JSON.stringify({ feature: feature.feature, passed, failures }, null, 2)}\n`
      : serialized,
    { mode: 0o600 },
  );
  return {
    feature: feature.feature,
    intent: feature.intent,
    passed,
    cases: cases.length,
    assertions: assertions.length,
    passedAssertions,
    weakAssertions,
    failures,
    rejection,
    evidence: evidenceFile,
    routes: server?.routes ?? [],
    durationMs,
    durations,
  };
}

const argument = process.argv[2];
if (process.argv.length !== 3 || !argument) {
  process.stderr.write(usage);
  process.exit(2);
}
const features = await loadFeatures();
const negatives = await loadNegatives();
if (argument === '--list') {
  for (const feature of features)
    process.stdout.write(
      `${feature.feature} (${feature.intent}${feature.paired ? ', paired' : ''}, ${feature.cases.length} cases): ${reachesOf(feature).join(', ')}\n`,
    );
  for (const negative of negatives)
    process.stdout.write(
      `${negative.feature} (negative, ${negative.cases.length} cases): ${reachesOf(negative).join(', ')}\n`,
    );
  process.exit(0);
}
const chosen = (entries: Feature[]) =>
  argument === '--all'
    ? entries
    : entries.filter((feature) => feature.feature === argument);
const selected = chosen(features);
const selectedNegatives = chosen(negatives);
if (selected.length === 0 && selectedNegatives.length === 0) {
  process.stderr.write(
    `Unknown feature ${argument}; --list shows the known ones.\n${usage}`,
  );
  process.exit(2);
}

const evidenceDirectory = await mkdtemp(
  join(tmpdir(), 'porcelain-server-verify-'),
);
const build = await mkdtemp(join(tmpdir(), 'porcelain-server-build-'));
await buildIsolatedServer(build);
const contracts = await contractSchemas();
let interrupted = false;
process.once('SIGINT', () => {
  interrupted = true;
});
const results: FeatureResult[] = [];
for (const feature of selected) {
  if (interrupted) break;
  const result = await runFeature(
    feature,
    join(evidenceDirectory, `${feature.feature}.json`),
    build,
    contracts,
  );
  results.push(result);
  process.stdout.write(
    `${result.passed ? 'PASS' : 'FAIL'} ${result.feature}: ${result.passedAssertions}/${result.assertions} assertions in ${result.cases} cases, ${result.durationMs} ms\n`,
  );
  for (const failure of result.failures)
    process.stdout.write(`  - ${failure}\n`);
}
const negativeResults: FeatureResult[] = [];
for (const negative of selectedNegatives) {
  if (interrupted) break;
  const result = await runFeature(
    negative,
    join(evidenceDirectory, `negative.${negative.feature}.json`),
    build,
    contracts,
  );
  negativeResults.push(result);
  const rejected = result.rejection.length === 0;
  process.stdout.write(
    `${rejected ? 'REJECTED' : 'FAIL'} negative ${result.feature}: ${result.weakAssertions}/${result.assertions} assertions weak in ${result.cases} cases${rejected ? '' : ', but a negative must have every assertion weak'}\n`,
  );
  for (const reason of result.rejection)
    process.stdout.write(`  - ${reason}\n`);
}
const slowest = results
  .flatMap((entry) =>
    entry.durations.map((timed) => ({ feature: entry.feature, ...timed })),
  )
  .sort((left, right) => right.durationMs - left.durationMs)
  .slice(0, 10);
process.stdout.write('Slowest cases:\n');
for (const timed of slowest)
  process.stdout.write(
    `  ${timed.durationMs} ms  ${timed.feature}: ${timed.case}\n`,
  );
const registered = [...results, ...negativeResults].find(
  (entry) => entry.routes.length > 0,
)?.routes;
const coverage = registered
  ? routeCoverage(registered, features)
  : { registered: [], unreached: [], unregistered: [] };
for (const route of coverage.unreached)
  process.stdout.write(
    `  - route ${route} is registered but no feature reaches it\n`,
  );
for (const reach of coverage.unregistered)
  process.stdout.write(
    `  - ${reach} is reached by a feature but no route is registered for it\n`,
  );
const passed =
  !interrupted &&
  registered !== undefined &&
  coverage.unreached.length === 0 &&
  coverage.unregistered.length === 0 &&
  results.length === selected.length &&
  results.every((entry) => entry.passed) &&
  negativeResults.length === selectedNegatives.length &&
  negativeResults.every((entry) => entry.rejection.length === 0);
const total = (pick: (entry: FeatureResult) => number) =>
  results.reduce((sum, entry) => sum + pick(entry), 0);
await writeFile(
  join(evidenceDirectory, 'summary.json'),
  `${JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      passed,
      features: results.length,
      cases: total((entry) => entry.cases),
      assertions: total((entry) => entry.assertions),
      passedAssertions: total((entry) => entry.passedAssertions),
      weakAssertions: total((entry) => entry.weakAssertions),
      durationMs: total((entry) => entry.durationMs),
      slowest,
      routes: coverage,
      results: results.map(
        ({
          routes: _routes,
          durations: _durations,
          rejection: _rejection,
          ...entry
        }) => entry,
      ),
      negatives: negativeResults.map((entry) => ({
        feature: entry.feature,
        rejected: entry.rejection.length === 0,
        cases: entry.cases,
        assertions: entry.assertions,
        weakAssertions: entry.weakAssertions,
        rejection: entry.rejection,
        evidence: entry.evidence,
      })),
    },
    null,
    2,
  )}\n`,
  { mode: 0o600 },
);
process.stdout.write(
  `${passed ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry.passed).length}/${selected.length} features, ${total((entry) => entry.cases)} cases, ${total((entry) => entry.passedAssertions)}/${total((entry) => entry.assertions)} assertions, ${total((entry) => entry.weakAssertions)} weak, ${coverage.registered.length - coverage.unreached.length}/${coverage.registered.length} routes reached, ${negativeResults.filter((entry) => entry.rejection.length === 0).length}/${selectedNegatives.length} negatives rejected; evidence: ${evidenceDirectory}\n`,
);
await rm(build, { recursive: true, force: true });
if (!passed) process.exitCode = 1;
