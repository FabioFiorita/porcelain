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
  omittedJobs: number;
};

const tailLines = 200;
const excerptCharacters = 40_000;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z /;
const failureLine = /##\[error\]|\bFAIL\b|Error\b|\berror\b/;

export function failureExcerpt(log: string): string {
  const lines = stripVTControlCharacters(log.replace(/^\uFEFF/, ''))
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

function headMarker(headSha: string): string {
  return `<!-- porcelain-failure-head: ${headSha} -->`;
}

function explanationTitle(headSha: string): string {
  return `### CI Explainer: why CI failed on \`${headSha.slice(0, 12)}\``;
}

function commentHeading(headSha: string): readonly string[] {
  return [failureCommentMarker, headMarker(headSha), explanationTitle(headSha)];
}

export function hasExplanation(
  body: string | undefined,
  headSha: string,
): boolean {
  if (!body) return false;
  const identity = body.split('\n\n', 2)[1];
  return (
    identity === headMarker(headSha) || identity === explanationTitle(headSha)
  );
}

export function unavailableExplanationComment(
  run: Pick<FailedRun, 'url' | 'headSha'>,
): string {
  return [
    ...commentHeading(run.headSha),
    `Could not generate an explanation for [the failed run](${run.url}). See the explainer job log for details.`,
  ].join('\n\n');
}

export function explanationComment(
  run: FailedRun,
  explanation: Explanation,
  model: string,
): string {
  const jobUrls = new Map(run.jobs.map((job) => [job.name, job.url]));
  return [
    ...commentHeading(run.headSha),
    `[The run](${run.url}), explained from its failed job logs. ${explanation.summary}`,
    ...(run.omittedJobs > 0
      ? [
          `This explanation covers the first ${run.jobs.length} failed jobs. Another ${run.omittedJobs} can be inspected in the run.`,
        ]
      : []),
    explanation.jobs
      .map((job) => {
        const url = jobUrls.get(job.job);
        const name = url ? `[${job.job}](${url})` : job.job;
        const flaky = job.likely_flaky ? ' (likely flaky)' : '';
        return `- **${name}**${flaky}: ${job.failing}\n\n  ${job.cause} ${job.next_step}\n\n  \`${job.log_line.replaceAll('`', "'")}\``;
      })
      .join('\n'),
    `<sub>CI Explainer: \`${model}\` on the OpenAI Responses API.</sub>`,
  ].join('\n\n');
}
