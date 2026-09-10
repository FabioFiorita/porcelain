import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeTasks } from '../src/task-store.mjs';

test('counts only completed tasks', () => {
  assert.deepEqual(summarizeTasks([{ status: 'done' }, { status: 'active' }]), {
    total: 2,
    done: 1,
  });
});

test('supports an empty board', () => {
  assert.deepEqual(summarizeTasks([]), { total: 0, done: 0 });
});
