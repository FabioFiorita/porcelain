export function routeCoverage(
  expected: readonly string[],
  modules: readonly { path: string; executed: boolean }[],
  logs: number,
) {
  const selected = expected.filter((path) =>
    modules.some((module) => module.path === path),
  ).length;
  const executed = modules.filter((module) => module.executed).length;
  const complete = selected === expected.length;
  if (complete && logs !== executed)
    throw new Error(
      `Route coverage: ${executed} integration files ran but ${logs} wrote a route log; every executed file's server records the routes its tests reached.`,
    );
  return { selected, complete };
}

export function handlerCoverage(
  logs: readonly {
    registered: readonly string[];
    requested: readonly string[];
    registeredTools: readonly string[];
    invokedTools: readonly string[];
  }[],
) {
  const registered = new Set(logs.flatMap((log) => log.registered));
  const requested = new Set(logs.flatMap((log) => log.requested));
  const tools = new Set(logs.flatMap((log) => log.registeredTools));
  const invoked = new Set(logs.flatMap((log) => log.invokedTools));
  const missing = [
    ...[...registered].filter((route) => !requested.has(route)),
    ...[...tools]
      .filter((tool) => !invoked.has(tool))
      .map((tool) => `MCP tool ${tool}`),
  ].sort();
  if (missing.length > 0)
    throw new Error(
      `Route coverage: no integration test reached ${missing.join(', ')}; every registered route and MCP tool is reached, through its validated handler, by a request of at least one test in apps/server/spec/integration/.`,
    );
}
