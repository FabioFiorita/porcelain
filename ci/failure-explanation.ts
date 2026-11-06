import { stripVTControlCharacters } from 'node:util';
import { Schema } from 'effect';

export const Explanation = Schema.Struct({
  summary: Schema.String,
  jobs: Schema.Array(
    Schema.Struct({
      job: Schema.String,
      failing: Schema.String,
      cause: Schema.String,
      likely_flaky: Schema.Boolean,
      next_step: Schema.String,
      log_line: Schema.String,
    }),
  ),
});
export type Explanation = typeof Explanation.Type;

export const explanationJsonSchema = Schema.toJsonSchemaDocument(Explanation, {
  onExcessProperty: 'error',
}).schema;

export type FailedJob = {
  name: string;
  url: string;
  steps: readonly string[];
  excerpt: string;
};

export type FailedRun = {
  url: string;
  headSha: string;
  jobs: readonly FailedJob[];
};

const tailLines = 200;
const excerptCharacters = 40_000;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z /;
const failureLine = /##\[error\]|\bFAIL\b|\bError\b/;

export function failureExcerpt(log: string): string {
  const lines = stripVTControlCharacters(log)
    .split('\n')
    .map((line) => line.replace(timestamp, '').trimEnd());
  const tailStart = Math.max(0, lines.length - tailLines);
  const earlier = lines
    .slice(0, tailStart)
    .filter((line) => failureLine.test(line));
  const excerpt = [
    ...earlier,
    ...(earlier.length > 0 ? ['…'] : []),
    ...lines.slice(tailStart),
  ].join('\n');
  return excerpt.length > excerptCharacters
    ? excerpt.slice(excerpt.length - excerptCharacters)
    : excerpt;
}

export const failureCommentMarker = '<!-- porcelain-failure-explanation -->';

export function explanationComment(
  run: FailedRun,
  explanation: Explanation,
  model: string,
): string {
  const jobUrls = new Map(run.jobs.map((job) => [job.name, job.url]));
  return [
    failureCommentMarker,
    `### Why CI failed on \`${run.headSha.slice(0, 12)}\``,
    `[The run](${run.url}), explained by \`${model}\` from its failed job logs. ${explanation.summary}`,
    explanation.jobs
      .map((job) => {
        const url = jobUrls.get(job.job);
        const name = url ? `[${job.job}](${url})` : job.job;
        const flaky = job.likely_flaky ? ' (likely flaky)' : '';
        return `- **${name}**${flaky}: ${job.failing}\n\n  ${job.cause} ${job.next_step}\n\n  \`${job.log_line.replaceAll('`', "'")}\``;
      })
      .join('\n'),
  ].join('\n\n');
}
