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
const path = require('node:path');
const args = process.argv.slice(2);
let prompt = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { prompt += chunk; });
process.stdin.on('end', () => {
  const schema = ${input.provider === 'codex' ? "fs.readFileSync(args[args.indexOf('--output-schema') + 1], 'utf8')" : "args[args.indexOf('--json-schema') + 1]"};
  const files = ${input.provider === 'codex' ? "['--output-schema', '--output-last-message'].map(flag => { const argument = args[args.indexOf(flag) + 1]; return { argument, name: path.basename(argument), parent: fs.realpathSync(path.dirname(argument)) }; })" : '[]'};
  fs.writeFileSync(${JSON.stringify(input.receipt)}, JSON.stringify({ args, prompt, schema: JSON.parse(schema), cwd: process.cwd(), files }));
  if (${input.exitCode ?? 0}) { process.exitCode = ${input.exitCode ?? 0}; return; }
  const reply = ${JSON.stringify(input.reply)};
  ${input.provider === 'codex' ? `fs.writeFileSync(args[args.indexOf('--output-last-message') + 1], ${input.resultBytes ? `'x'.repeat(${input.resultBytes})` : 'JSON.stringify(reply)'});` : 'process.stdout.write(JSON.stringify({ structured_output: reply }));'}
});
`;
}
