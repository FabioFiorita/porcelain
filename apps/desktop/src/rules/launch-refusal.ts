const debuggingSwitch = /^--?(?:remote-debugging|inspect|debug)(?:[-=]|$)/i;
const nodeEnvironment = ['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS'];

export function launchRefusal(launch: {
  packaged: boolean;
  arguments: readonly string[];
  environment: Readonly<Record<string, string | undefined>>;
}): string | undefined {
  if (!launch.packaged) return undefined;
  const debugging = launch.arguments.find((argument) =>
    debuggingSwitch.test(argument),
  );
  if (debugging !== undefined)
    return `Porcelain refuses to start with the debugging switch ${debugging.split('=')[0]}: the app keeps credentials a debugger could read.`;
  const variable = nodeEnvironment.find(
    (name) => (launch.environment[name] ?? '').trim() !== '',
  );
  if (variable !== undefined)
    return `Porcelain refuses to start with ${variable} set: the app never runs as Node or takes Node options.`;
  return undefined;
}
