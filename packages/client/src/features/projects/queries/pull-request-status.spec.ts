import { expect, it } from 'vite-plus/test';
import {
  clientFixtures,
  idleClientAtoms,
} from '../../../../spec/kit/client-fixture.ts';
import type { PageActivity } from '../ports/page-activity.ts';
import { watchPullStatusView } from './pull-request-status.ts';

const create = clientFixtures();

function fakeActivity() {
  let active = false;
  const listeners = new Set<() => void>();
  const activity: PageActivity = {
    isActive: () => active,
    subscribe: (changed) => {
      listeners.add(changed);
      return () => listeners.delete(changed);
    },
  };
  return {
    activity,
    set: (value: boolean) => {
      active = value;
      for (const changed of [...listeners]) changed();
    },
  };
}

const status = {
  kind: 'available',
  status: {
    number: 7,
    state: 'open',
    draft: false,
    headSha: 'a'.repeat(40),
    mergeable: 'MERGEABLE',
    requestedReviewers: [],
    canRerun: true,
    checks: [],
    checksTruncated: false,
  },
};

it('reads pull request status only while its page is active, and again on return', async () => {
  const reads: string[] = [];
  const subject = create((path) => {
    reads.push(path);
    return Promise.resolve(Response.json(status));
  });
  const page = fakeActivity();
  const atom = watchPullStatusView({
    connection: subject.connection,
    projectId: 'project',
    number: 7,
    activity: page.activity,
  });
  const stop = subject.registry.mount(atom);
  try {
    await idleClientAtoms(subject.registry);
    expect(reads).toEqual([]);
    page.set(true);
    await expect.poll(() => subject.registry.get(atom).status?.number).toBe(7);
    expect(reads).toEqual(['/api/projects/project/pull-requests/7/status']);
    page.set(false);
    await idleClientAtoms(subject.registry);
    expect(reads).toHaveLength(1);
    page.set(true);
    await expect.poll(() => reads.length).toBe(2);
  } finally {
    stop();
  }
});
