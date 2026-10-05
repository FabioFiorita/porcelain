export function codingToolScript(input: {
  provider: 'codex' | 'claude';
  runner: string;
  receipt: string;
  reply: unknown;
  exitCode?: number;
  resultBytes?: number;
}): string {
  return `#!${input.runner}
const fs = require('node:fs');
const args = process.argv.slice(2);
let prompt = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { prompt += chunk; });
process.stdin.on('end', () => {
  const schema = ${input.provider === 'codex' ? "fs.readFileSync(args[args.indexOf('--output-schema') + 1], 'utf8')" : "args[args.indexOf('--json-schema') + 1]"};
  fs.writeFileSync(${JSON.stringify(input.receipt)}, JSON.stringify({ args, prompt, schema: JSON.parse(schema), cwd: process.cwd() }));
  if (${input.exitCode ?? 0}) { process.exitCode = ${input.exitCode ?? 0}; return; }
  const reply = ${JSON.stringify(input.reply)};
  ${input.provider === 'codex' ? `fs.writeFileSync(args[args.indexOf('--output-last-message') + 1], ${input.resultBytes ? `'x'.repeat(${input.resultBytes})` : 'JSON.stringify(reply)'});` : 'process.stdout.write(JSON.stringify({ structured_output: reply }));'}
});
`;
}
