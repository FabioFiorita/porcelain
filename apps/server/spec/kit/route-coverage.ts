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
