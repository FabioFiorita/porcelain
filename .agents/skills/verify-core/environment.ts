export function verificationEnvironment(
  source: NodeJS.ProcessEnv,
  codingToolDirectory = 'none',
): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const [name, value] of Object.entries(source))
    if (value !== undefined && !/^(ANTHROPIC|OPENAI|CODEX|CLAUDE)_/i.test(name))
      environment[name] = value;
  environment.PORCELAIN_CODING_TOOL_DIRECTORY = codingToolDirectory || 'none';
  return environment;
}
