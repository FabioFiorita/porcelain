export const SERVICE_UNIT_NAME = 'porcelain.service';
export const UPDATE_UNIT_NAME = 'porcelain-update.service';

export type ServicePlan = {
  nodeExecutable: string;
  entryPoint: string;
  dataDirectory: string;
  port: number;
  stdoutLog: string;
  stderrLog: string;
  searchPath: string;
};

function unitValue(value: string): string {
  let output = '';
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (character === '%') output += '%%';
    else if (character === '\\') output += '\\\\';
    else if (character === '"') output += '\\"';
    else if (code < 0x20 || code === 0x7f)
      output += `\\x${code.toString(16).padStart(2, '0')}`;
    else output += character;
  }
  return output;
}

export function unitArgument(value: string): string {
  return `"${unitValue(value)}"`;
}

function unitPath(value: string): string {
  return unitValue(value).replaceAll(' ', '\\x20');
}

export function renderSystemdUnit(plan: ServicePlan): string {
  const args = [
    plan.nodeExecutable,
    plan.entryPoint,
    'serve',
    '--data-directory',
    plan.dataDirectory,
    '--port',
    String(plan.port),
  ];
  return `[Unit]
Description=Porcelain review server
After=network.target

[Service]
Type=simple
Environment=${unitArgument(`PATH=${plan.searchPath}`)}
ExecStart=${args.map(unitArgument).join(' ')}
Restart=on-failure
RestartSec=2
StandardOutput=append:${unitPath(plan.stdoutLog)}
StandardError=append:${unitPath(plan.stderrLog)}

[Install]
WantedBy=default.target
`;
}
