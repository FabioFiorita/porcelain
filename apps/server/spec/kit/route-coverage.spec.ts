import { expect, test } from 'vitest';
import { routeCoverage, handlerCoverage } from './route-coverage.ts';

test('a complete selection counts only executed modules for route logs', () => {
  expect(
    routeCoverage(
      ['server/a', 'server/b'],
      [
        { path: 'server/a', executed: true },
        { path: 'server/b', executed: true },
        { path: 'skills/native', executed: false },
      ],
      2,
    ),
  ).toEqual({ selected: 2, complete: true });
});

test('a partial selection does not judge route coverage', () => {
  expect(
    routeCoverage(
      ['server/a', 'server/b'],
      [
        { path: 'server/a', executed: true },
        { path: 'skills/native', executed: true },
      ],
      2,
    ),
  ).toEqual({ selected: 1, complete: false });
});

test('a complete selection requires logs from every executed module', () => {
  expect(
    routeCoverage(
      ['server/a'],
      [
        { path: 'server/a', executed: true },
        { path: 'skills/native', executed: true },
      ],
      2,
    ),
  ).toEqual({ selected: 1, complete: true });
});

test('a complete selection rejects a missing route log', () => {
  expect(() =>
    routeCoverage(['server/a'], [{ path: 'server/a', executed: true }], 0),
  ).toThrow('Route coverage: 1 integration files ran but 0 wrote a route log');
});

test('a complete selection rejects an extra route log', () => {
  expect(() =>
    routeCoverage(['server/a'], [{ path: 'server/a', executed: true }], 2),
  ).toThrow('Route coverage: 1 integration files ran but 2 wrote a route log');
});

const registeredHandlers = {
  registered: ['owner POST /mcp'],
  requested: ['owner POST /mcp'],
  registeredTools: ['read_review', 'list_comments'],
  invokedTools: ['read_review'],
};

test('reaching the MCP route leaves an uninvoked registered tool missing', () => {
  expect(() => handlerCoverage([registeredHandlers])).toThrow(
    'Route coverage: no integration test reached MCP tool list_comments;',
  );
});

test('actual tool invocations across files cover the registered toolkit', () => {
  expect(() =>
    handlerCoverage([
      registeredHandlers,
      { ...registeredHandlers, invokedTools: ['list_comments'] },
    ]),
  ).not.toThrow();
});

test('missing HTTP routes and MCP tools are named together without duplicates', () => {
  const missing = {
    ...registeredHandlers,
    requested: [],
    invokedTools: [],
  };
  expect(() => handlerCoverage([missing, missing])).toThrow(
    'Route coverage: no integration test reached MCP tool list_comments, MCP tool read_review, owner POST /mcp;',
  );
});
