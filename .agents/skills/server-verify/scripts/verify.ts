import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import {
  isRecord,
  list,
  record,
  type Checks,
  type Feature,
} from './feature.ts';
import { IsolatedServer, Recorder, type Step } from './session.ts';

type Assertion = {
  name: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
};
type CaseEvidence = {
  name: string;
  passed: boolean;
  error?: string;
  assertionCount: number;
  steps: Step[];
  assertions: Assertion[];
};
type FeatureResult = {
  feature: string;
  intent: Feature['intent'];
  passed: boolean;
  cases: number;
  assertions: number;
  passedAssertions: number;
  failures: string[];
  evidence: string;
};

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, '../../../..');
const mapDirectory = resolve(here, '../feature-map');
const usage =
  'Usage: node .agents/skills/server-verify/scripts/verify.ts <feature>|--all|--list\n';

function isFeature(value: unknown): value is Feature {
  return (
    isRecord(value) &&
    typeof value.feature === 'string' &&
    (typeof value.reaches === 'string' || Array.isArray(value.reaches)) &&
    (value.intent === 'observed' || value.intent === 'intended') &&
    typeof value.behaviour === 'string' &&
    Array.isArray(value.cases)
  );
}

async function discover(): Promise<Feature[]> {
  const files = (await readdir(mapDirectory))
    .filter((name) => name.endsWith('.ts'))
    .sort();
  const features: Feature[] = [];
  for (const file of files) {
    const loaded: unknown = await import(
      pathToFileURL(join(mapDirectory, file)).href
    );
    const feature = isRecord(loaded) ? loaded.default : undefined;
    if (!isFeature(feature) || `${feature.feature}.ts` !== file)
      throw new Error(
        `${file} must default-export the feature named ${file.slice(0, -3)}`,
      );
    features.push(feature);
  }
  return features;
}

function reachesOf(feature: Feature): readonly string[] {
  return typeof feature.reaches === 'string'
    ? [feature.reaches]
    : feature.reaches;
}

function routePattern(reach: string): RegExp {
  const escaped = reach
    .split(/(:[A-Za-z]+)/)
    .map((part) =>
      part.startsWith(':')
        ? '[^/?]+'
        : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('');
  return new RegExp(`^${escaped}(?:\\?.*)?$`);
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

function checks(assertions: Assertion[]): Checks {
  return {
    check(name, expected, actual) {
      assertions.push({
        name,
        passed: isDeepStrictEqual(actual, expected),
        expected,
        actual,
      });
    },
    checkPartial(name, expected, actual) {
      assertions.push({
        name,
        passed: partial(expected, actual),
        expected,
        actual,
      });
    },
    checkContract(name, schema, actual) {
      const parsed = schema.safeParse(actual);
      assertions.push({
        name,
        passed: parsed.success,
        expected: 'satisfies the wire contract',
        actual: parsed.success
          ? actual
          : { value: actual, issues: parsed.error?.issues },
      });
    },
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fixtureIds(server: IsolatedServer, recorder: Recorder) {
  const inventory = await server.send(recorder, {
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
): Promise<CaseEvidence[]> {
  const ids = await fixtureIds(server, recorder);
  const cases: CaseEvidence[] = [];
  for (const testCase of feature.cases) {
    recorder.steps = [];
    recorder.cleanups.length = 0;
    const assertions: Assertion[] = [];
    const evidence: CaseEvidence = {
      name: testCase.name,
      passed: false,
      assertionCount: 0,
      steps: recorder.steps,
      assertions,
    };
    cases.push(evidence);
    try {
      await testCase.run(server.session(recorder, ids), {
        enter: (phase) => {
          recorder.phase = phase;
        },
        checks: checks(assertions),
      });
      if (assertions.length === 0)
        throw new Error('The case made no assertion');
    } catch (error) {
      evidence.error = message(error);
    } finally {
      for (const cleanup of recorder.cleanups) cleanup();
    }
    evidence.assertionCount = assertions.length;
    evidence.passed =
      evidence.error === undefined && assertions.every((entry) => entry.passed);
  }
  return cases;
}

async function runFeature(
  feature: Feature,
  evidenceDirectory: string,
): Promise<FeatureResult> {
  const recorder = new Recorder();
  let cases: CaseEvidence[] = [];
  let setupError: string | undefined;
  let server: IsolatedServer | undefined;
  try {
    server = await IsolatedServer.start(repositoryRoot);
    recorder.secret(server.credential);
    cases = await runCases(feature, server, recorder);
  } catch (error) {
    setupError = message(error);
  } finally {
    const stopError = await server?.stop();
    setupError ??= stopError;
  }

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
      ...entry.assertions
        .filter((assertion) => !assertion.passed)
        .map((assertion) => `${entry.name}: ${assertion.name}`),
    ]),
  ].map((failure) => recorder.scrub(failure));
  const passed = failures.length === 0 && assertions.length > 0;
  const passedAssertions = assertions.filter((entry) => entry.passed).length;
  const evidencePath = join(evidenceDirectory, `${feature.feature}.json`);
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
    session: server
      ? { address: server.address, repository: server.repository }
      : null,
    cases,
    logs: server?.logs() ?? { stdout: '', stderr: '' },
  });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
    mode: 0o600,
  });
  return {
    feature: feature.feature,
    intent: feature.intent,
    passed,
    cases: cases.length,
    assertions: assertions.length,
    passedAssertions,
    failures,
    evidence: evidencePath,
  };
}

const argument = process.argv[2];
if (process.argv.length !== 3 || !argument) {
  process.stderr.write(usage);
  process.exit(2);
}
const features = await discover();
if (argument === '--list') {
  for (const feature of features)
    process.stdout.write(
      `${feature.feature} (${feature.intent}, ${feature.cases.length} cases): ${reachesOf(feature).join(', ')}\n`,
    );
  process.exit(0);
}
const selected =
  argument === '--all'
    ? features
    : features.filter((feature) => feature.feature === argument);
if (selected.length === 0) {
  process.stderr.write(
    `Unknown feature ${argument}; --list shows the known ones.\n${usage}`,
  );
  process.exit(2);
}

const evidenceDirectory = await mkdtemp(
  join(tmpdir(), 'porcelain-server-verify-'),
);
let interrupted = false;
process.once('SIGINT', () => {
  interrupted = true;
});
const results: FeatureResult[] = [];
for (const feature of selected) {
  if (interrupted) break;
  const result = await runFeature(feature, evidenceDirectory);
  results.push(result);
  process.stdout.write(
    `${result.passed ? 'PASS' : 'FAIL'} ${result.feature}: ${result.passedAssertions}/${result.assertions} assertions in ${result.cases} cases\n`,
  );
  for (const failure of result.failures)
    process.stdout.write(`  - ${failure}\n`);
}
const passed =
  !interrupted &&
  results.length === selected.length &&
  results.every((entry) => entry.passed);
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
      results,
    },
    null,
    2,
  )}\n`,
  { mode: 0o600 },
);
process.stdout.write(
  `${passed ? 'PASS' : 'FAIL'} ${results.filter((entry) => entry.passed).length}/${selected.length} features, ${total((entry) => entry.passedAssertions)}/${total((entry) => entry.assertions)} assertions; evidence: ${evidenceDirectory}\n`,
);
if (!passed) process.exitCode = 1;
