import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { cruise } from 'dependency-cruiser';
import { boundaryRules } from './boundary-rules.ts';

const inputs = ['apps', 'packages', 'scripts'].filter(existsSync);
const result = await cruise(
  inputs,
  {
    ...boundaryRules.options,
    ruleSet: boundaryRules,
    validate: true,
    outputType: process.argv.includes('--json') ? 'json' : 'err-long',
  },
  { alias: { '@/*': `${resolve('apps/web/src')}/*` } },
);
if (typeof result.output === 'string') process.stdout.write(result.output);
process.exitCode = result.exitCode;
