import { expect } from 'vitest';
import {
  closeStartedApplication,
  failOwnerStartup,
} from '../kit/application-start.ts';
import { test } from '../kit/server-test.ts';

const closedEvents = [
  'job-started',
  'job-stopping',
  'job-stopped',
  'components',
  'persistence',
];

test('the application owns network and private Unix listeners and concurrent closes wait for jobs and persistence', async () => {
  expect(await closeStartedApplication()).toEqual({
    networkBody: 'network',
    ownerBody: 'owner',
    ownerMode: 0o600,
    duringDrain: {
      firstPending: true,
      secondPending: true,
      networkListening: false,
      ownerListening: false,
      events: ['job-started', 'job-stopping'],
    },
    events: closedEvents,
    locked: false,
  });
});

test('an owner startup failure releases both listeners, started jobs, persistence and the directory lock', async () => {
  expect(await failOwnerStartup()).toEqual({
    failure: 'Owner routes failed',
    networkListening: false,
    ownerListening: false,
    events: closedEvents,
    locked: false,
  });
});
