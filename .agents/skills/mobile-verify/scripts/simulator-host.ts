import { Schema } from 'effect';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  bootSimulator,
  releaseSimulator,
  resetApp,
  simulatorSchema,
} from '@porcelain/mobile/kit/simulator';
import {
  buildCommand,
  developmentClient,
  identity,
  nativeFingerprint,
} from '@porcelain/mobile/kit/development-client';

const requestSchema = Schema.Struct({
  action: Schema.Literals(['prepare', 'release']),
  kind: Schema.Literals(['iphone', 'ipad']),
  owner: Schema.String,
  fingerprint: Schema.String,
  udid: Schema.optional(Schema.String),
  limit: Schema.Finite,
});
export type HostRequest = typeof requestSchema.Type;
const inspectSchema = Schema.Struct({ action: Schema.Literal('inspect') });
export const inspectionSchema = Schema.Struct({
  fingerprint: Schema.String,
  client: Schema.Boolean,
});
async function inspectHost(): Promise<typeof inspectionSchema.Type> {
  const fingerprint = await nativeFingerprint();
  return {
    fingerprint,
    client: (await developmentClient(fingerprint)) !== undefined,
  };
}
export async function simulatorHost(request: HostRequest) {
  const file = join('/tmp/porcelain-simulator-pool', `${request.owner}.json`);
  if (request.action === 'release') {
    const simulator = Schema.decodeUnknownSync(simulatorSchema)(
      JSON.parse(await readFile(file, 'utf8')),
    );
    if (simulator.owner !== request.owner)
      throw new Error('The simulator claim belongs to another run.');
    await releaseSimulator(simulator);
    await rm(file);
    return { ...simulator, installed: false };
  }
  if ((await nativeFingerprint()) !== request.fingerprint)
    throw new Error(
      `The device-host checkout has different native inputs; check out the same commit here, then run ${buildCommand}.`,
    );
  const client = await developmentClient();
  if (client === undefined)
    throw new Error(
      `No development client matches these native inputs; run ${buildCommand} on the Mac before starting.`,
    );
  const simulator = await bootSimulator(
    request.kind,
    request.owner,
    request.udid,
    request.limit,
  );
  try {
    const installed = await resetApp(
      simulator.udid,
      client,
      identity.bundleIdentifier,
    );
    await writeFile(file, JSON.stringify(simulator), { mode: 0o600 });
    return { ...simulator, installed };
  } catch (error) {
    await releaseSimulator(simulator);
    throw error;
  }
}
if (process.argv[1] === import.meta.filename) {
  const request = Schema.decodeUnknownSync(
    Schema.Union([requestSchema, inspectSchema]),
  )(JSON.parse(process.argv[2] ?? '{}'));
  if (request.action === 'inspect')
    process.stdout.write(`${JSON.stringify(await inspectHost())}\n`);
  else {
    const simulator = await simulatorHost(request);
    process.stdout.write(`${JSON.stringify(simulator)}\n`);
    if (request.action === 'prepare') {
      process.stdin.resume();
      await new Promise<void>((done) => process.stdin.once('end', done));
      await simulatorHost({ ...request, action: 'release' });
    }
  }
}
