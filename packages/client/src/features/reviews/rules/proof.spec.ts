import { expect, it } from 'vitest';
import { orderedChecks, type ProofCheck } from './proof.ts';

it('orders failures before passes without modern array methods or changing the input', () => {
  const checks: readonly ProofCheck[] = Object.freeze([
    { name: 'first pass', result: 'pass' },
    { name: 'failure', result: 'fail' },
    { name: 'second pass', result: 'pass' },
  ]);
  const descriptor = Object.getOwnPropertyDescriptor(
    Array.prototype,
    'toSorted',
  );
  Reflect.deleteProperty(Array.prototype, 'toSorted');
  try {
    expect(orderedChecks(checks).map((check) => check.name)).toEqual([
      'failure',
      'first pass',
      'second pass',
    ]);
    expect(checks.map((check) => check.name)).toEqual([
      'first pass',
      'failure',
      'second pass',
    ]);
    expect(orderedChecks([])).toEqual([]);
  } finally {
    if (descriptor)
      Object.defineProperty(Array.prototype, 'toSorted', descriptor);
  }
});
